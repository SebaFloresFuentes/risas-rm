import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";

const root = new URL("../", import.meta.url);
const container = `radarrisas-db-test-${randomUUID().slice(0, 8)}`;
const image = "postgres:17-alpine";
const password = "radarrisas-local-test";

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: "utf8",
    ...options,
  });

  if (result.status !== 0 && !options.allowFailure) {
    throw new Error(
      `${command} ${args.join(" ")} failed\n${result.stdout ?? ""}${result.stderr ?? ""}`
    );
  }

  return result;
}

function applySql(sql) {
  run(
    "docker",
    ["exec", "-i", container, "psql", "-v", "ON_ERROR_STOP=1", "-U", "postgres"],
    { input: sql }
  );
}

try {
  run("docker", [
    "run", "--detach", "--rm", "--name", container,
    "--env", `POSTGRES_PASSWORD=${password}`, image,
  ]);

  let ready = false;
  let consecutiveReadyChecks = 0;
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const check = run(
      "docker",
      ["exec", container, "pg_isready", "-U", "postgres"],
      { allowFailure: true }
    );
    if (check.status === 0) {
      consecutiveReadyChecks += 1;
      if (consecutiveReadyChecks >= 3) {
        ready = true;
        break;
      }
    } else {
      consecutiveReadyChecks = 0;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  if (!ready) throw new Error("Local PostgreSQL test container did not become ready");

  for (const path of [
    "supabase/tests/fixtures/production-base.sql",
    "supabase/migrations/202611250001_add_event_commercial_availability.sql",
    "supabase/migrations/202611250002_add_automation_rpcs.sql",
    "supabase/migrations/202611250003_harden_automation_privileges.sql",
    "supabase/migrations/202611250004_add_automation_auth_hook.sql",
    "supabase/migrations/202611250005_fix_legacy_archive_rpc.sql",
    "supabase/tests/database/automation.sql",
  ]) {
    applySql(await readFile(new URL(path, root), "utf8"));
  }

  const denied = run(
    "docker",
    [
      "exec", container, "psql", "-v", "ON_ERROR_STOP=1", "-U", "postgres",
      "-c", "set role anon; select public.radarrisas_archive_expired_events_v1();",
    ],
    { allowFailure: true }
  );

  if (denied.status === 0 || !/permission denied/i.test(denied.stderr)) {
    throw new Error("Anonymous invocation was not rejected as expected");
  }

  console.log("Supabase integration: all local database assertions passed.");
  console.log("Anonymous and unauthorized RPC invocation: rejected.");
} finally {
  run("docker", ["rm", "--force", container], { allowFailure: true });
}

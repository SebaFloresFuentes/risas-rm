import { readFile, writeFile } from "node:fs/promises";
import {
  automationWritesEnabled,
  callAutomationRpc,
  candidateRpcPayload,
  observationRpcPayload,
} from "./lib/supabase-automation.mjs";

const dataUrl = new URL("../data/", import.meta.url);
const plan = JSON.parse(
  await readFile(new URL("supabase-sync-plan.json", dataUrl), "utf8")
);
const writeEnabled = automationWritesEnabled();
const results = [];
const errors = [];

async function execute(kind, key, rpc, body) {
  if (!writeEnabled) {
    results.push({ kind, key, status: "dry_run" });
    return;
  }

  try {
    const result = await callAutomationRpc(rpc, body);
    results.push({ kind, key, status: "completed", result });
  } catch (error) {
    errors.push({ kind, key, message: error.message });
  }
}

for (const action of plan.candidateActions ?? []) {
  if (action.action !== "candidate_pending") continue;
  await execute(
    "candidate",
    action.idempotencyKey,
    "radarrisas_ingest_candidate_v1",
    { p_candidate: candidateRpcPayload(action) }
  );
}

for (const observation of plan.historyObservations ?? []) {
  await execute(
    "commercial_observation",
    observation.observationKey,
    "radarrisas_apply_commercial_observation_v1",
    { p_observation: observationRpcPayload(observation) }
  );
}

const report = {
  generatedAt: new Date().toISOString(),
  mode: writeEnabled ? "write" : "dry-run",
  writesEnabled: writeEnabled,
  summary: {
    planned: results.length + errors.length,
    completed: results.filter((item) => item.status === "completed").length,
    dryRun: results.filter((item) => item.status === "dry_run").length,
    errors: errors.length,
  },
  results,
  errors,
};

await writeFile(
  new URL("supabase-sync-result.json", dataUrl),
  `${JSON.stringify(report, null, 2)}\n`,
  "utf8"
);

console.table(report.summary);
console.log(`Modo: ${report.mode}.`);

if (errors.length > 0) {
  process.exitCode = 1;
}

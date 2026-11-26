import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import {
  automationWritesEnabled,
  callAutomationRpc,
  observationRpcPayload,
} from "./lib/supabase-automation.mjs";

const dataUrl = new URL("../data/", import.meta.url);
const verification = JSON.parse(
  await readFile(new URL("commercial-verification.json", dataUrl), "utf8")
);
const writeEnabled = automationWritesEnabled();
const errorsByUrl = new Map(
  (verification.failures ?? []).map((failure) => [failure.sourceUrl, failure.reason])
);
const results = [];
const errors = [];

for (const item of verification.observations ?? []) {
  const attemptedAt = item.observed.availabilityCheckedAt ?? verification.generatedAt;
  const status = item.observed.availabilityStatus ?? "unknown";
  const price = item.observed.priceFrom ?? null;
  const observationKey = createHash("sha256")
    .update([item.eventId, attemptedAt, item.provider, status, price].join("|"))
    .digest("hex");
  const observation = {
    observationKey,
    eventId: item.eventId,
    provider: item.provider,
    sourceUrl: item.sourceUrl,
    priceFrom: price,
    availabilityStatus: status,
    availabilitySource: item.observed.availabilitySource,
    availabilityEvidence: item.observed.availabilityEvidence,
    attemptedAt,
    verifiedAt: item.observed.availabilityVerifiedAt,
    errorCode: errorsByUrl.get(item.sourceUrl) ?? null,
  };

  if (!writeEnabled) {
    results.push({ eventId: item.eventId, observationKey, status: "dry_run" });
    continue;
  }

  try {
    const result = await callAutomationRpc(
      "radarrisas_apply_commercial_observation_v1",
      { p_observation: observationRpcPayload(observation) }
    );
    results.push({ eventId: item.eventId, observationKey, status: "completed", result });
  } catch (error) {
    errors.push({ eventId: item.eventId, observationKey, message: error.message });
  }
}

let archiveResult = { status: "dry_run" };
if (writeEnabled) {
  try {
    archiveResult = {
      status: "completed",
      result: await callAutomationRpc("radarrisas_archive_expired_events_v1"),
    };
  } catch (error) {
    archiveResult = { status: "error", message: error.message };
    errors.push({ kind: "archive", message: error.message });
  }
}

const report = {
  generatedAt: new Date().toISOString(),
  mode: writeEnabled ? "write" : "dry-run",
  writesEnabled: writeEnabled,
  summary: {
    planned: results.length + errors.filter((item) => item.eventId).length,
    completed: results.filter((item) => item.status === "completed").length,
    dryRun: results.filter((item) => item.status === "dry_run").length,
    errors: errors.length,
  },
  archiveResult,
  results,
  errors,
};

await writeFile(
  new URL("commercial-sync-result.json", dataUrl),
  `${JSON.stringify(report, null, 2)}\n`,
  "utf8"
);

console.table(report.summary);
console.log(`Modo: ${report.mode}.`);
if (errors.length > 0) process.exitCode = 1;

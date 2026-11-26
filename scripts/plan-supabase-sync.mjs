import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import {
  eventIdentity,
  normalizePrice,
} from "./lib/event-normalization.mjs";

const dataUrl = new URL("../data/", import.meta.url);
const feed = JSON.parse(
  await readFile(new URL("unified-review-feed.json", dataUrl), "utf8")
);
const normalized = JSON.parse(
  await readFile(new URL("normalized-candidates.json", dataUrl), "utf8")
);

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error("Faltan las variables públicas de Supabase.");
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const published = [];
const pageSize = 500;

for (let from = 0; ; from += pageSize) {
  const { data, error } = await supabase
    .from("events")
    .select(
      "id,event_date,event_time,ticket_url,price_from,sold_out,source_checked_at"
    )
    .eq("verified", true)
    .order("id")
    .range(from, from + pageSize - 1);

  if (error) throw new Error(`Supabase: ${error.message}`);
  published.push(...(data ?? []));
  if ((data ?? []).length < pageSize) break;
}

const publishedByIdentity = new Map(
  published
    .map((event) => [eventIdentity(event), event])
    .filter(([identity]) => identity)
);

const candidateActions = [];

for (const candidate of normalized.candidates ?? []) {
  const identity = eventIdentity(candidate);

  if (!identity) {
    candidateActions.push({
      action: "blocked",
      reason: "identity_incomplete",
      candidate,
    });
    continue;
  }

  const existing = publishedByIdentity.get(identity);

  candidateActions.push({
    action: existing ? "skip_existing_published" : "candidate_pending",
    idempotencyKey: identity,
    existingEventId: existing?.id ?? null,
    candidate,
  });
}

const commercialUpdates = [];
const historyObservations = [];

for (const observation of feed.events ?? []) {
  const identity = eventIdentity(observation);
  const existing = identity ? publishedByIdentity.get(identity) : null;
  if (!existing) continue;

  const changes = {};
  const observedPrice = normalizePrice(observation.priceFrom);
  const status = observation.availabilityStatus ?? "unknown";
  const confirmedAvailability = ["available", "limited", "sold_out"].includes(status);
  const attemptedAt = observation.availabilityCheckedAt ?? feed.generatedAt;
  const transition =
    existing.sold_out && ["available", "limited"].includes(status)
      ? "restocked"
      : null;

  if (observedPrice !== null && observedPrice !== existing.price_from) {
    changes.price_from = observedPrice;
  }

  if (confirmedAvailability) {
    changes.availability_status = status;
    changes.availability_source = observation.availabilitySource ?? null;
    changes.availability_evidence = observation.availabilityEvidence ?? [];
    changes.availability_verified_at = observation.availabilityVerifiedAt;
    changes.sold_out = status === "sold_out";

  }

  if (attemptedAt) changes.availability_last_attempt_at = attemptedAt;

  const successfulCheck =
    observation.availabilityVerifiedAt ??
    (observedPrice !== null ? observation.availabilityCheckedAt : null);

  if (successfulCheck) changes.source_checked_at = successfulCheck;

  if (Object.keys(changes).length > 0) {
    commercialUpdates.push({
      action: "update_commercial_fields",
      eventId: existing.id,
      idempotencyKey: identity,
      transition,
      changes,
    });
  }

  const observationKey = createHash("sha256")
    .update(
      [existing.id, attemptedAt, observation.source, status, observedPrice].join("|")
    )
    .digest("hex");

  historyObservations.push({
    action: "record_commercial_observation",
    observationKey,
    eventId: existing.id,
    provider: observation.source,
    sourceUrl: observation.url,
    priceFrom: observedPrice,
    priceCurrency: observation.priceCurrency ?? null,
    availabilityStatus: status,
    availabilitySource: observation.availabilitySource ?? null,
    availabilityEvidence: observation.availabilityEvidence ?? [],
    attemptedAt,
    verifiedAt: observation.availabilityVerifiedAt ?? null,
  });
}

const output = {
  generatedAt: new Date().toISOString(),
  mode: "dry-run",
  writesPerformed: 0,
  summary: {
    publishedRead: published.length,
    candidatesPending: candidateActions.filter(
      (item) => item.action === "candidate_pending"
    ).length,
    candidatesSkipped: candidateActions.filter(
      (item) => item.action === "skip_existing_published"
    ).length,
    candidatesBlocked: candidateActions.filter(
      (item) => item.action === "blocked"
    ).length,
    commercialUpdates: commercialUpdates.length,
    historyObservations: historyObservations.length,
    restocks: commercialUpdates.filter(
      (item) => item.transition === "restocked"
    ).length,
  },
  candidateActions,
  commercialUpdates,
  historyObservations,
};

await writeFile(
  new URL("supabase-sync-plan.json", dataUrl),
  JSON.stringify(output, null, 2) + "\n",
  "utf8"
);

console.log("\n=== RADARRISAS SUPABASE SYNC ===\n");
console.table(output.summary);
console.log("Modo dry-run: no se ejecutaron escrituras ni RPC.");

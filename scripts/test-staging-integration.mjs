import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

const expectedProjectRef = "stckxqupsgcaifpwpshv";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/+$/, "");
const apiKey = process.env.SUPABASE_PUBLISHABLE_KEY;

if (process.env.RADARRISAS_STAGING_TEST_ENABLED !== "true") {
  throw new Error("Define RADARRISAS_STAGING_TEST_ENABLED=true para autorizar esta prueba.");
}
if (!url || new URL(url).hostname.split(".")[0] !== expectedProjectRef) {
  throw new Error(`La prueba solo puede escribir en staging ${expectedProjectRef}.`);
}

for (const name of [
  "SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_AUTOMATION_EMAIL",
  "SUPABASE_AUTOMATION_PASSWORD",
  "SUPABASE_TEST_ADMIN_EMAIL",
  "SUPABASE_TEST_ADMIN_PASSWORD",
]) {
  if (!process.env[name]) throw new Error(`Falta ${name}.`);
}

async function request(path, { token, method = "GET", body } = {}) {
  const response = await fetch(`${url}${path}`, {
    method,
    headers: {
      apikey: apiKey,
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(body === undefined ? {} : { "content-type": "application/json" }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const text = await response.text();
  let payload = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = text;
    }
  }
  return { response, payload };
}

async function signIn(email, password, expectedRole) {
  const { response, payload } = await request("/auth/v1/token?grant_type=password", {
    method: "POST",
    body: { email, password },
  });
  assert.equal(response.status, 200, `Falló autenticación: ${payload?.message ?? response.status}`);
  const claims = JSON.parse(
    Buffer.from(payload.access_token.split(".")[1], "base64url").toString("utf8")
  );
  assert.equal(claims.role, expectedRole);
  assert.ok(claims.exp - claims.iat > 0 && claims.exp - claims.iat <= 3600);
  return payload.access_token;
}

async function rpc(name, body, token) {
  return request(`/rest/v1/rpc/${name}`, { method: "POST", body, token });
}

const automationToken = await signIn(
  process.env.SUPABASE_AUTOMATION_EMAIL,
  process.env.SUPABASE_AUTOMATION_PASSWORD,
  "radarrisas_automation"
);
const adminToken = await signIn(
  process.env.SUPABASE_TEST_ADMIN_EMAIL,
  process.env.SUPABASE_TEST_ADMIN_PASSWORD,
  "authenticated"
);

const unauthorized = await rpc("radarrisas_archive_expired_events_v1", {}, adminToken);
assert.ok([401, 403, 404].includes(unauthorized.response.status));
const anonymous = await rpc("radarrisas_archive_expired_events_v1", {});
assert.ok([401, 403, 404].includes(anonymous.response.status));

const runId = randomUUID();
const futureDate = new Date(Date.now() + 180 * 86400000).toISOString().slice(0, 10);
const candidate = {
  idempotency_key: `staging-integration-${runId}`,
  comedian: `RadarRisas Staging QA ${runId.slice(0, 8)}`,
  show: "Validación de automatización",
  event_date: futureDate,
  event_time: "20:30",
  venue: "Teatro de staging",
  venue_address: "Dirección de prueba",
  comuna: "Santiago",
  price_from: 10000,
  ticket_provider: "Ticketplus",
  ticket_url: `https://example.com/staging/tickets/${runId}`,
  source_url: `https://example.com/staging/source/${runId}`,
  editorial_notes: "Dato sintético exclusivo de staging.",
};

const concurrentIngest = await Promise.all(
  Array.from({ length: 4 }, () =>
    rpc("radarrisas_ingest_candidate_v1", { p_candidate: candidate }, automationToken)
  )
);
for (const result of concurrentIngest) assert.equal(result.response.status, 200);
assert.equal(
  concurrentIngest.filter((item) => item.payload.status === "inserted").length,
  1
);
const candidateId = concurrentIngest[0].payload.id;
assert.ok(concurrentIngest.every((item) => item.payload.id === candidateId));

const automationCandidateRead = await request(
  `/rest/v1/event_candidates?id=eq.${candidateId}`,
  { token: automationToken }
);
assert.ok([401, 403, 404].includes(automationCandidateRead.response.status));

const candidateRead = await request(
  `/rest/v1/event_candidates?id=eq.${candidateId}&select=id,review_status,published_event_id`,
  { token: adminToken }
);
assert.equal(candidateRead.response.status, 200);
assert.equal(candidateRead.payload[0].review_status, "pending");

const automationPublish = await rpc(
  "publish_event_candidate",
  { p_candidate_id: candidateId },
  automationToken
);
assert.ok([401, 403, 404].includes(automationPublish.response.status));

const publication = await rpc(
  "publish_event_candidate",
  { p_candidate_id: candidateId },
  adminToken
);
assert.equal(publication.response.status, 200);
const eventId = publication.payload;

const candidateAfterPublish = await request(
  `/rest/v1/event_candidates?id=eq.${candidateId}&select=review_status,published_event_id`,
  { token: adminToken }
);
assert.equal(candidateAfterPublish.payload[0].review_status, "approved");
assert.equal(candidateAfterPublish.payload[0].published_event_id, eventId);

async function event() {
  const result = await request(
    `/rest/v1/events?id=eq.${eventId}&select=id,slug,comedian,show,event_date,event_time,venue,comuna,ticket_url,price_from,featured,verified,sold_out,availability_status,availability_verified_at,availability_last_attempt_at,archived_at`
  );
  assert.equal(result.response.status, 200);
  assert.equal(result.payload.length, 1);
  return result.payload[0];
}

const editorialBefore = await event();
const editorialFields = [
  "slug", "comedian", "show", "event_date", "event_time", "venue", "comuna",
  "ticket_url", "featured", "verified",
];

let sequence = 0;
async function observe(status, { price, verified = true, errorCode = null, key } = {}) {
  sequence += 1;
  const at = new Date(Date.now() + sequence * 1000).toISOString();
  return rpc(
    "radarrisas_apply_commercial_observation_v1",
    {
      p_observation: {
        observation_key: key ?? `${runId}-${sequence}`,
        event_id: eventId,
        provider: "Ticketplus",
        source_url: candidate.ticket_url,
        price_from: price ?? null,
        availability_status: status,
        availability_source: verified ? "staging_fixture" : null,
        availability_evidence: verified ? [{ kind: "staging_test", status }] : [],
        attempted_at: at,
        verified_at: verified ? at : null,
        error_code: errorCode,
      },
    },
    automationToken
  );
}

const available = await observe("available", { price: 12000 });
assert.equal(available.response.status, 200);
assert.equal((await event()).availability_status, "available");

const soldOut = await observe("sold_out");
assert.equal(soldOut.response.status, 200);
let current = await event();
assert.equal(current.availability_status, "sold_out");
assert.equal(current.sold_out, true);
assert.equal(current.price_from, 12000);
const confirmedAt = current.availability_verified_at;

const failure = await observe("unknown", {
  verified: false,
  errorCode: "staging_timeout",
});
assert.equal(failure.response.status, 200);
current = await event();
assert.equal(current.availability_status, "sold_out");
assert.equal(current.availability_verified_at, confirmedAt);
assert.equal(current.price_from, 12000);

const restocked = await observe("available", { price: 15000 });
assert.equal(restocked.response.status, 200);
assert.equal(restocked.payload.transition, "restocked");
current = await event();
assert.equal(current.availability_status, "available");
assert.equal(current.sold_out, false);
assert.equal(current.price_from, 15000);

const duplicateKey = `${runId}-concurrent-observation`;
const concurrentObservation = await Promise.all(
  Array.from({ length: 4 }, () =>
    observe("limited", { price: 15500, key: duplicateKey })
  )
);
assert.ok(concurrentObservation.every((item) => item.response.status === 200));
assert.equal(
  concurrentObservation.filter((item) => item.payload.status === "applied").length,
  1
);
assert.equal(
  concurrentObservation.filter((item) => item.payload.status === "duplicate").length,
  3
);

const editorialAfter = await event();
for (const field of editorialFields) {
  assert.deepEqual(editorialAfter[field], editorialBefore[field], `Cambió ${field}`);
}
assert.equal(editorialAfter.availability_status, "limited");
assert.equal(editorialAfter.price_from, 15500);

console.log(
  JSON.stringify({
    projectRef: expectedProjectRef,
    runId,
    candidateId,
    eventId,
    assertions: {
      shortLivedAutomationRole: true,
      unauthorizedCallsRejected: true,
      idempotentCandidateIngestion: true,
      manualApproval: true,
      priceAndAvailabilityTransitions: true,
      transientFailurePreservesConfirmedState: true,
      restockDetected: true,
      commercialObservationConcurrency: true,
      editorialFieldsPreserved: true,
    },
  }, null, 2)
);

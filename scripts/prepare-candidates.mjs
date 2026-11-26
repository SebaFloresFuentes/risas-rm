
import { readFile, writeFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";

const base = new URL("../data/", import.meta.url);

const discovery = JSON.parse(
  await readFile(new URL("discovered-events.json", base), "utf8")
);

const sources = JSON.parse(
  await readFile(new URL("event-sources.json", base), "utf8")
);

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !key) {
  throw new Error("Faltan las variables públicas de Supabase.");
}

const supabase = createClient(url, key, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

function normalizeText(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function normalizeUrl(value) {
  if (!value) return null;

  try {
    const parsed = new URL(value);

    if (parsed.protocol !== "https:") return null;

    return (
      parsed.hostname.toLowerCase().replace(/^www\./, "") +
      parsed.pathname.replace(/\/+$/, "").toLowerCase()
    );
  } catch {
    return null;
  }
}

function chileDateTime(value) {
  if (!value) return null;

  // Exigir zona horaria explícita.
  if (!/(Z|[+-]\d{2}:\d{2})$/i.test(value)) {
    return null;
  }

  const instant = new Date(value);
  if (Number.isNaN(instant.getTime())) return null;

  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/Santiago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(instant);

  const get = (type) =>
    parts.find((part) => part.type === type)?.value;

  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    time: `${get("hour")}:${get("minute")}`,
  };
}

const { data: published, error } = await supabase
  .from("events")
  .select(
    "id, comedian, show, event_date, event_time, venue, ticket_url"
  )
  .eq("verified", true)
  .limit(1000);

if (error) {
  throw new Error(`No se pudo consultar Supabase: ${error.message}`);
}

if ((published ?? []).length === 1000) {
  throw new Error(
    "Se alcanzó el límite de consulta. Implementar paginación antes de continuar."
  );
}

const proposals = [];

for (const event of discovery.events ?? []) {
  const configuredSource = sources.find(
    (source) =>
      normalizeUrl(source.url) === normalizeUrl(event.sourceUrl)
  );

  const localDateTime = chileDateTime(event.startDate);

  const candidate = {
    comedian: configuredSource?.comedian ?? null,
    show: configuredSource?.show ?? null,
    event_date: localDateTime?.date ?? null,
    event_time: localDateTime?.time ?? null,
    venue: event.location ?? null,
    comuna: configuredSource?.comuna ?? null,
    price_from: null,
    ticket_provider: configuredSource?.ticketProvider ?? null,
    ticket_url: event.url ?? event.sourceUrl ?? null,
    source_url: event.sourceUrl ?? null,
    editorial_notes:
      `Detección automática: ${event.name ?? "sin título"}. ` +
      "Revisar datos y disponibilidad antes de publicar.",
  };

  const eventUrl = normalizeUrl(candidate.ticket_url);

  const existingByUrl = (published ?? []).find(
    (item) =>
      eventUrl &&
      normalizeUrl(item.ticket_url) === eventUrl
  );

  const possibleMatches = (published ?? []).filter(
    (item) =>
      candidate.event_date &&
      candidate.event_time &&
      item.event_date === candidate.event_date &&
      item.event_time?.slice(0, 5) === candidate.event_time &&
      normalizeText(item.venue) ===
        normalizeText(candidate.venue)
  );

  let status = "new";

  if (existingByUrl) {
    status = "existing";
  } else if (possibleMatches.length > 0) {
    status = "review";
  }

  const missingFields = [
    "comedian",
    "show",
    "event_date",
    "event_time",
    "venue",
    "comuna",
    "source_url",
    "ticket_url",
  ].filter((field) => !candidate[field]);

  proposals.push({
    status,
    readyForReview:
      status === "new" && missingFields.length === 0,
    missingFields,
    originalName: event.name ?? null,
    candidate,
    existingEventId: existingByUrl?.id ?? null,
    possibleMatchIds: possibleMatches.map((item) => item.id),
  });
}


const readyProposals = proposals.filter(
  (proposal) =>
    proposal.status === "new" &&
    proposal.readyForReview &&
    proposal.missingFields.length === 0
);

const blockedProposals = proposals.filter(
  (proposal) => !readyProposals.includes(proposal)
);

await writeFile(
  new URL("ready-candidates.json", base),
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      total: readyProposals.length,
      candidates: readyProposals.map(
        (proposal) => proposal.candidate
      ),
    },
    null,
    2
  ) + "\n",
  "utf8"
);

console.log("\n--- PREPARACIÓN PARA INGESTA ---");
console.log(`Candidatos preparados: ${readyProposals.length}`);
console.log(`Eventos excluidos o pendientes: ${blockedProposals.length}`);
console.log("Supabase no fue modificado.");


const output = {
  generatedAt: new Date().toISOString(),
  total: proposals.length,
  existing: proposals.filter((p) => p.status === "existing").length,
  review: proposals.filter((p) => p.status === "review").length,
  new: proposals.filter((p) => p.status === "new").length,
  proposals,
};

await writeFile(
  new URL("candidate-proposals.json", base),
  JSON.stringify(output, null, 2) + "\n",
  "utf8"
);

console.log("\n--- PROPUESTAS NORMALIZADAS ---");
console.log(JSON.stringify(output, null, 2));

console.log(
  "\nArchivo generado: data/candidate-proposals.json"
);
console.log("Modo de solo lectura: Supabase no fue modificado.");

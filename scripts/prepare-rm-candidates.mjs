
import { readFile, writeFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";

const base = new URL("../data/", import.meta.url);

const input = JSON.parse(
  await readFile(new URL("rm-discovered.json", base), "utf8")
);

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error("Faltan las variables de Supabase.");
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

// Artistas identificados en esta primera prueba.
const knownArtists = ["Luis Slimming", "Paloma Salas"];

// Comunas identificadas explícitamente en las direcciones.
const knownComunas = [
  "San Bernardo",
  "Puente Alto",
  "San Miguel",
];

function normalize(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function normalizeUrl(value) {
  try {
    const url = new URL(value);

    if (url.protocol !== "https:") return null;

    return (
      url.hostname.toLowerCase().replace(/^www\./, "") +
      url.pathname.replace(/\/+$/, "").toLowerCase()
    );
  } catch {
    return null;
  }
}

function dateTimeChile(value) {
  if (
    typeof value !== "string" ||
    !/(Z|[+-]\d{2}:\d{2})$/i.test(value)
  ) {
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

  const get = (key) =>
    parts.find((part) => part.type === key)?.value;

  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    time: `${get("hour")}:${get("minute")}`,
  };
}

function identifyArtist(title) {
  const name = normalize(title);

  return (
    knownArtists.find((artist) =>
      name.includes(normalize(artist))
    ) ?? null
  );
}

function identifyComuna(address) {
  const segments = String(address ?? "")
    .split(",")
    .map((segment) => normalize(segment));

  return (
    knownComunas.find((comuna) =>
      segments.includes(normalize(comuna))
    ) ?? null
  );
}

function sameTime(a, b) {
  return String(a ?? "").slice(0, 5) ===
    String(b ?? "").slice(0, 5);
}

const { data: published, error } = await supabase
  .from("events")
  .select(
    "id, comedian, show, event_date, event_time, venue, ticket_url"
  )
  .eq("verified", true)
  .limit(1000);

if (error) {
  throw new Error(`Error consultando eventos: ${error.message}`);
}

if ((published ?? []).length === 1000) {
  throw new Error(
    "Se alcanzó el límite de consulta. Se requiere paginación."
  );
}

const proposals = [];

for (const event of input.events ?? []) {
  const dateTime = dateTimeChile(event.startDate);
  const artist = identifyArtist(event.name);
  const comuna = identifyComuna(event.venueAddress);

  const candidate = {
    comedian: artist,
    // Mantener el título original hasta revisión editorial.
    show: event.name ?? null,
    event_date: dateTime?.date ?? null,
    event_time: dateTime?.time ?? null,
    venue: event.location ?? null,
    venue_address: event.venueAddress ?? null,
    comuna,
    price_from: null,
    ticket_provider: "Ticketplus",
    ticket_url: event.url ?? null,
    source_url: event.sourceUrl ?? null,
    editorial_notes:
      "Detectado automáticamente desde Ticketplus. " +
      "Revisar artista, nombre del espectáculo, " +
      "recinto, fecha, entradas y disponibilidad.",
  };

  const urlKey = normalizeUrl(candidate.ticket_url);

  const exact = (published ?? []).find(
    (item) =>
      urlKey &&
      normalizeUrl(item.ticket_url) === urlKey &&
      item.event_date === candidate.event_date &&
      sameTime(item.event_time, candidate.event_time)
  );

  const possible = (published ?? []).filter(
    (item) =>
      item.event_date === candidate.event_date &&
      sameTime(item.event_time, candidate.event_time) &&
      normalize(item.venue) === normalize(candidate.venue)
  );

  const missingFields = [
    "comedian",
    "show",
    "event_date",
    "event_time",
    "venue",
    "comuna",
    "ticket_url",
    "source_url",
  ].filter((key) => !candidate[key]);

  let status = "needs_review";

  if (exact) {
    status = "existing";
  } else if (possible.length > 0) {
    status = "possible_duplicate";
  }

  proposals.push({
    status,
    missingFields,
    candidate,
    existingEventId: exact?.id ?? null,
    possibleMatchIds: possible.map((item) => item.id),
  });
}

const output = {
  generatedAt: new Date().toISOString(),
  total: proposals.length,
  existing: proposals.filter((p) => p.status === "existing").length,
  possibleDuplicates: proposals.filter(
    (p) => p.status === "possible_duplicate"
  ).length,
  needsReview: proposals.filter(
    (p) => p.status === "needs_review"
  ).length,
  proposals,
};

await writeFile(
  new URL("rm-candidate-review.json", base),
  JSON.stringify(output, null, 2) + "\n",
  "utf8"
);

console.log("\n🎭 RISAS RM - PROPUESTAS DE CARTELERA");
console.log("------------------------------------");
console.log(`Total analizado: ${output.total}`);
console.log(`Ya publicados: ${output.existing}`);
console.log(`Posibles duplicados: ${output.possibleDuplicates}`);
console.log(`Para revisión: ${output.needsReview}`);

for (const proposal of proposals) {
  const c = proposal.candidate;

  console.log(
    `\n[${proposal.status}] ${c.comedian ?? "Artista por identificar"}`
  );
  console.log(`Show: ${c.show}`);
  console.log(`Fecha: ${c.event_date} ${c.event_time}`);
  console.log(`Recinto: ${c.venue} (${c.comuna ?? "Sin comuna"})`);

  if (proposal.missingFields.length > 0) {
    console.log(
      `Faltan: ${proposal.missingFields.join(", ")}`
    );
  }
}

console.log(
  "\nArchivo: data/rm-candidate-review.json"
);
console.log("No se modificó Supabase.");

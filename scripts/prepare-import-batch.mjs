
import { readFile, writeFile } from "node:fs/promises";

const base = new URL("../data/", import.meta.url);

const audit = JSON.parse(
  await readFile(
    new URL("audited-review-feed.json", base),
    "utf8"
  )
);

// Datos ya confirmados en la bandeja privada de Supabase.
// Esta lista es una protección adicional, no sustituye
// la deduplicación que realiza la base de datos.
const existingCandidates = [
  {
    source: "Ticketplus",
    date: "2026-12-04",
    time: "20:30",
    venue: "Distrito San Ignacio",
  },
];

function normalize(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function isExistingCandidate(event) {
  return existingCandidates.some(
    (known) =>
      normalize(known.source) === normalize(event.source) &&
      known.date === event.date &&
      known.time === event.time &&
      normalize(known.venue) === normalize(event.venue)
  );
}

// Asignaciones editoriales basadas en los títulos
// extraídos de PuntoTicket. No se inventan nombres de shows.
const artistRules = [
  ["claudio michaux", "Claudio Michaux"],
  ["edo caroe", "Edo Caroe"],
  ["encuentros con kramer", "Stefan Kramer"],
  [
    "fernando larrain y nicolas larrain",
    "Fernando Larraín y Nicolás Larraín",
  ],
  [
    "pato pimienta y juan pablo flores",
    "Pato Pimienta y Juan Pablo Flores",
  ],
  ["bombo fica", "Bombo Fica"],
  [
    "magdalena max neef y josefina velasco",
    "Magdalena Max-Neef y Josefina Velasco",
  ],
  ["not panel show", "Not Panel Show"],
  ["rodrigo villegas", "Rodrigo Villegas"],
  ["leon murillo", "León Murillo"],
  ["fuente carrasco", "Fuente Carrasco"],
  ["lucho mellera", "Lucho Mellera"],
];

function identifyArtist(title) {
  const value = normalize(title);

  const found = artistRules.find(([keyword]) =>
    value.includes(keyword)
  );

  return found?.[1] ?? null;
}

// Usar solamente comunas explícitas en la dirección.
// No adivinar comunas por el nombre del recinto.
const communes = [
  "Providencia",
  "Santiago Centro",
  "Santiago",
  "San Miguel",
  "San Bernardo",
  "Puente Alto",
  "Ñuñoa",
  "La Reina",
  "Las Condes",
  "La Florida",
  "Maipú",
];

function getCommune(address) {
  const value = normalize(address);

  const match = communes.find((commune) =>
    new RegExp(
      `(^| )${normalize(commune)}( |$)`
    ).test(value)
  );

  if (!match) return null;

  return match === "Santiago Centro"
    ? "Santiago"
    : match;
}

function validUrl(value) {
  try {
    const url = new URL(value);

    return ["http:", "https:"].includes(url.protocol)
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

const eligible = (audit.events ?? []).filter(
  (event) =>
    event.auditStatus === "needs_manual_review" &&
    event.status === "review_candidate" &&
    event.region === "rm" &&
    event.source === "PuntoTicket" &&
    !isExistingCandidate(event)
);

const candidates = [];
const blocked = [];

for (const event of eligible) {
  const artist = identifyArtist(event.name);
  const commune = getCommune(event.address);
  const ticketUrl = validUrl(event.url);

  const missing = [];

  if (!artist) missing.push("artista");
  if (!event.date) missing.push("fecha");
  if (!event.time) missing.push("hora");
  if (!event.venue) missing.push("recinto");
  if (!commune) missing.push("comuna");
  if (!ticketUrl) missing.push("enlace");

  if (missing.length > 0) {
    blocked.push({
      name: event.name,
      missing,
    });
    continue;
  }

  candidates.push({
    comedian: artist,

    // Conservamos el título publicado por la ticketera.
    // El nombre editorial del espectáculo se puede
    // corregir posteriormente desde /admin.
    show: event.name,

    event_date: event.date,
    event_time: event.time,
    venue: event.venue,
    venue_address: event.address ?? null,
    comuna: commune,

    price_from: null,
    ticket_provider: "PuntoTicket",
    ticket_url: ticketUrl,
    source_url: ticketUrl,
    source_checked_at: new Date().toISOString(),

    editorial_notes:
      "Propuesta detectada automáticamente en PuntoTicket. " +
      "Revisar título del show, dirección, fecha, hora, " +
      "disponibilidad y posibles duplicados antes de aprobar.",
  });
}

const output = {
  candidates,
};

await writeFile(
  new URL("import-batch-puntoticket.json", base),
  JSON.stringify(output, null, 2) + "\n",
  "utf8"
);

console.log("\n🎭 RISAS RM — PREPARADOR DE IMPORTACIÓN");
console.log("---------------------------------------");
console.log("Auditoría original:", audit.summary?.analyzed);
console.log("Propuestas preparadas:", candidates.length);
console.log("Bloqueados por datos faltantes:", blocked.length);

for (const candidate of candidates) {
  console.log(
    `\n${candidate.event_date} ${candidate.event_time}`
  );
  console.log(
    `${candidate.comedian} | ${candidate.venue}`
  );
  console.log(
    `${candidate.comuna} | ${candidate.ticket_url}`
  );
}

if (blocked.length > 0) {
  console.log("\nREQUIEREN CORRECCIÓN:");

  for (const item of blocked) {
    console.log(
      `${item.name}: ${item.missing.join(", ")}`
    );
  }
}

console.log(
  "\nArchivo: data/import-batch-puntoticket.json"
);
console.log("Supabase no fue modificado.");

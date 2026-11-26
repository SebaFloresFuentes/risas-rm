
import { readFile, writeFile } from "node:fs/promises";
import { normalizeProvider } from "./lib/event-normalization.mjs";

const base = new URL("../data/", import.meta.url);

async function readOptional(filename) {
  try {
    return JSON.parse(
      await readFile(new URL(filename, base), "utf8")
    );
  } catch (error) {
    if (error.code === "ENOENT") {
      console.warn(`Archivo no encontrado: ${filename}`);
      return { events: [] };
    }
    throw error;
  }
}

function normalize(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const geography = await readOptional("rm-communes.json");

const rmComunas = [
  ...Object.values(geography.provinces).flat(),
  ...Object.keys(geography.aliases)
];

const outside = [
  "Arica", "Antofagasta", "Iquique",
  "Viña del Mar", "Valparaíso",
  "San Felipe", "La Serena", "Coquimbo",
  "Concepción", "Temuco", "Puerto Montt",
];

function containsPlace(text, place) {
  return (` ${normalize(text)} `)
    .includes(` ${normalize(place)} `);
}

function regionStatus(address) {
  if (!address) return "unknown";

  if (containsPlace(address, "Región Metropolitana")) {
    return "rm";
  }

  if (outside.some((place) => containsPlace(address, place))) {
    return "outside_rm";
  }

  if (rmComunas.some((place) => containsPlace(address, place))) {
    return "rm";
  }

  return "unknown";
}

const formatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Santiago",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const parts = formatter.formatToParts(new Date());
const part = (type) =>
  parts.find((p) => p.type === type)?.value;

const today = `${part("year")}-${part("month")}-${part("day")}`;

const ticketplus = await readOptional(
  "ticketplus-discovered.json"
);
const multisource = await readOptional(
  "multisource-discovered.json"
);
const comedypass = await readOptional(
  "comedypass-discovered.json"
);

const entries = [];

for (const event of ticketplus.events ?? []) {
  entries.push({
    source: normalizeProvider("Ticketplus"),
    name: event.name,
    date: event.startDate?.slice(0, 10) ?? null,
    time: event.startDate?.slice(11, 16) ?? null,
    venue: event.location ?? null,
    address: event.venueAddress ?? null,
    url: event.url,
    priceFrom: event.priceFrom ?? null,
    priceCurrency: event.priceCurrency ?? null,
    priceMethod: event.priceMethod ?? null,
    priceIssues: event.priceIssues ?? [],
    availabilityStatus: event.availabilityStatus ?? "unknown",
    availabilitySource: event.availabilitySource ?? null,
    availabilityEvidence: event.availabilityEvidence ?? [],
    availabilityCheckedAt: event.availabilityCheckedAt ?? null,
    availabilityVerifiedAt: event.availabilityVerifiedAt ?? null,
    issues: [],
  });
}

for (const event of multisource.events ?? []) {
  entries.push({
    source: normalizeProvider(event.source ?? event.sourceId),
    name: event.name,
    date: event.startDate?.slice(0, 10) ?? null,
    time: event.startDate?.slice(11, 16) ?? null,
    venue: event.location ?? null,
    address: event.venueAddress ?? null,
    url: event.url,
    priceFrom: event.priceFrom ?? null,
    priceCurrency: event.priceCurrency ?? null,
    priceMethod: event.priceMethod ?? null,
    priceIssues: event.priceIssues ?? [],
    availabilityStatus: event.availabilityStatus ?? "unknown",
    availabilitySource: event.availabilitySource ?? null,
    availabilityEvidence: event.availabilityEvidence ?? [],
    availabilityCheckedAt: event.availabilityCheckedAt ?? null,
    availabilityVerifiedAt: event.availabilityVerifiedAt ?? null,
    issues: [],
  });
}

for (const event of comedypass.events ?? []) {
  entries.push({
    source: normalizeProvider("Comedy Pass"),
    name: event.name,
    date: event.date?.date ?? null,
    day: event.date?.day ?? null,
    month: event.date?.month ?? null,
    time: event.eventTime ?? null,
    venue: event.location ?? null,
    address: event.venueAddress ?? null,
    url: event.url,
    priceFrom: event.priceFrom ?? null,
    priceCurrency: event.priceCurrency ?? null,
    priceMethod: event.priceMethod ?? null,
    priceIssues: event.priceIssues ?? [],
    availabilityStatus: event.availabilityStatus ?? "unknown",
    availabilitySource: event.availabilitySource ?? null,
    availabilityEvidence: event.availabilityEvidence ?? [],
    availabilityCheckedAt: event.availabilityCheckedAt ?? null,
    availabilityVerifiedAt: event.availabilityVerifiedAt ?? null,
    issues: [...(event.issues ?? [])],
  });
}

// Eliminar únicamente repeticiones exactas entre resultados.
const unique = [
  ...new Map(
    entries.map((event) => [
      [
        normalize(event.source),
        event.url,
        event.date ?? `${event.day}-${event.month}`,
        event.time,
      ].join("|"),
      event,
    ])
  ).values(),
];

const results = unique.map((event) => {
  const region = regionStatus(event.address);
  const issues = [...event.issues];

  if (!event.date && !issues.includes("year_not_confirmed")) {
    issues.push("date_not_confirmed");
  }

  if (!event.time) {
    issues.push("time_not_confirmed");
  }

  if (region === "unknown") {
    issues.push("region_not_confirmed");
  }

  const status =
    region === "outside_rm"
      ? "excluded"
      : event.date && event.date < today
        ? "past"
        : issues.length > 0
          ? "needs_verification"
          : "review_candidate";

  return { ...event, region, status, issues };
});

const summary = {
  total: results.length,
  reviewCandidates: results.filter(
    (e) => e.status === "review_candidate"
  ).length,
  needsVerification: results.filter(
    (e) => e.status === "needs_verification"
  ).length,
  excluded: results.filter(
    (e) => e.status === "excluded"
  ).length,
  past: results.filter(
    (e) => e.status === "past"
  ).length,
};

const output = {
  generatedAt: new Date().toISOString(),
  todayChile: today,
  summary,
  events: results,
};

await writeFile(
  new URL("unified-review-feed.json", base),
  JSON.stringify(output, null, 2) + "\n",
  "utf8"
);

console.log("\n🎭 RADARRISAS — CARTELERA UNIFICADA");
console.log("---------------------------------");
console.log("Total:", summary.total);
console.log("Para revisión:", summary.reviewCandidates);
console.log("Datos por verificar:", summary.needsVerification);
console.log("Fuera de la RM:", summary.excluded);
console.log("Eventos pasados:", summary.past);

console.log("\nPOR FUENTE:");

for (const source of [...new Set(results.map((e) => e.source))]) {
  console.log(
    source + ":",
    results.filter((e) => e.source === source).length
  );
}

console.log("\nArchivo: data/unified-review-feed.json");
console.log("Supabase no fue modificado.");

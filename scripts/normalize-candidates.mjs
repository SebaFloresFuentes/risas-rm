
import { readFile, writeFile } from "node:fs/promises";
import {
  eventIdentity,
  normalizeEventUrl,
  normalizePrice,
  normalizeProvider,
} from "./lib/event-normalization.mjs";

async function readJson(path) {
  return JSON.parse(
    await readFile(new URL(path, import.meta.url), "utf8")
  );
}

const comedians = await readJson("../data/comedians.json");
const geography = await readJson("../data/rm-communes.json");
const feed = await readJson("../data/audited-review-feed.json");

function normalize(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function clean(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function contains(text, term) {
  const a = normalize(text);
  const b = normalize(term);

  return Boolean(b) && ` ${a} `.includes(` ${b} `);
}

function todayChile() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Santiago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());

  const get = type => parts.find(p => p.type === type).value;

  return `${get("year")}-${get("month")}-${get("day")}`;
}

function detectComedian(title) {
  const matches = comedians.filter(artist =>
    [artist.name, ...artist.aliases].some(alias =>
      contains(title, alias)
    )
  );

  return matches.length
    ? matches.map(artist => artist.name).join(" + ")
    : null;
}

const communeNames = Object.values(
  geography.provinces
).flat();

const geographicTerms = [
  ...communeNames.map(name => ({
    term: name,
    commune: name
  })),
  ...Object.entries(geography.aliases).map(
    ([term, commune]) => ({ term, commune })
  )
].sort((a, b) => b.term.length - a.term.length);


function detectCommune(event) {
  function findMatches(value) {
    return [
      ...new Set(
        geographicTerms
          .filter(item => contains(value, item.term))
          .map(item => item.commune)
      )
    ];
  }

  // Priorizar componentes completos de la dirección.
  const addressParts = clean(event.address)
    .split(",")
    .map(part => normalize(part))
    .filter(Boolean);

  for (const part of addressParts.reverse()) {
    const exactMatches = [
      ...new Set(
        geographicTerms
          .filter(item => normalize(item.term) === part)
          .map(item => item.commune)
      )
    ];

    if (exactMatches.length === 1) {
      return exactMatches[0];
    }

    if (exactMatches.length > 1) {
      return null;
    }
  }

  // Buscar coincidencias en los campos restantes.
  for (const value of [
    event.address,
    event.venue,
    event.name
  ]) {
    const matches = findMatches(value);

    if (matches.length === 1) {
      return matches[0];
    }

    if (matches.length > 1) {
      return null;
    }
  }

  return null;
}


function normalizeVenue(value) {
  const venue = clean(value);

  if (!venue) return null;

  if (venue === venue.toUpperCase()) {
    return venue.toLocaleLowerCase("es-CL")
      .replace(/(^|\s)\p{L}/gu, letter =>
        letter.toLocaleUpperCase("es-CL")
      );
  }

  return venue;
}

function validDate(value) {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value)
  ) return false;

  const date = new Date(`${value}T00:00:00Z`);

  return !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value;
}

function normalizeTime(value) {
  const match = clean(value).match(
    /^([01]?\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?$/
  );

  if (!match) return null;

  return `${match[1].padStart(2, "0")}:${match[2]}`;
}

function detectShow(event) {
  if (clean(event.show)) {
    return clean(event.show);
  }

  // Nombre provisional: requiere revisión editorial.
  return "Stand-up comedy";
}

const today = todayChile();
const seenIdentities = new Set();
const seenPerformances = new Set();

const candidates = [];
const needsVerification = [];
const duplicates = [];
const excluded = [];

for (const event of feed.events) {
  if (event.auditStatus !== "needs_manual_review") {
    continue;
  }

  const issues = [...(event.issues ?? [])];

  const comedian = detectComedian(event.name);
  const comuna = detectCommune(event);
  const venue = normalizeVenue(event.venue);
  const date = validDate(event.date) ? event.date : null;
  const time = normalizeTime(event.time);
  const url = normalizeEventUrl(event.url);

  if (date && date < today) {
    excluded.push({
      name: event.name,
      reason: "past_event"
    });
    continue;
  }

  if (!comedian) issues.push("comedian_not_confirmed");
  if (!comuna) issues.push("commune_not_confirmed");
  if (!venue) issues.push("venue_not_confirmed");
  if (!date) issues.push("date_not_confirmed");
  if (!time) issues.push("time_not_confirmed");
  if (!url) issues.push("invalid_ticket_url");
  if (!clean(event.source)) issues.push("source_not_confirmed");

  if (event.region !== "rm") {
    issues.push("region_not_confirmed");
  }

  const candidate = {
    comedian,
    show: detectShow(event),
    event_date: date,
    event_time: time,
    venue,
    venue_address: clean(event.address) || null,
    comuna,
    price_from: normalizePrice(
      event.priceFrom ?? event.price_from
    ),
    ticket_provider: normalizeProvider(event.source),
    ticket_url: url,
    source_url: normalizeEventUrl(event.sourceUrl) ?? url,
    editorial_notes: `Título original: ${event.name}`
  };

  if (issues.length) {
    needsVerification.push({
      ...candidate,
      issues: [...new Set(issues)]
    });
    continue;
  }

  const identity = eventIdentity(candidate);

  const performanceKey = [
    normalize(comedian),
    normalize(venue),
    date,
    time
  ].join("|");

  if (
    (identity && seenIdentities.has(identity)) ||
    seenPerformances.has(performanceKey)
  ) {
    duplicates.push({
      ...candidate,
      reason: "possible_duplicate_in_batch"
    });
    continue;
  }

  if (identity) seenIdentities.add(identity);
  seenPerformances.add(performanceKey);

  candidates.push(candidate);
}

const output = {
  generatedAt: new Date().toISOString(),
  summary: {
    readyForReview: candidates.length,
    needsVerification: needsVerification.length,
    possibleDuplicates: duplicates.length,
    excluded: excluded.length
  },
  candidates,
  needsVerification,
  duplicates,
  excluded
};

await writeFile(
  new URL("../data/normalized-candidates.json", import.meta.url),
  JSON.stringify(output, null, 2) + "\n",
  "utf8"
);

console.log("\n=== RADARRISAS NORMALIZER ===\n");
console.table(output.summary);

console.table(candidates.map(event => ({
  comedian: event.comedian,
  date: event.event_date,
  time: event.event_time,
  venue: event.venue,
  comuna: event.comuna,
  source: event.ticket_provider
})));

console.log(
  "\nResultados guardados en data/normalized-candidates.json"
);

console.log("Modo local: Supabase no fue modificado.");

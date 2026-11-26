
import { readFile, writeFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";

const base = new URL("../data/", import.meta.url);

const feed = JSON.parse(
  await readFile(new URL("unified-review-feed.json", base), "utf8")
);

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error("Faltan las variables públicas de Supabase.");
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

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

    if (!["http:", "https:"].includes(url.protocol)) {
      return null;
    }

    return (
      url.hostname.toLowerCase().replace(/^www\./, "") +
      url.pathname.replace(/\/+$/, "").toLowerCase()
    );
  } catch {
    return null;
  }
}

function sameTime(a, b) {
  const x = String(a ?? "").slice(0, 5);
  const y = String(b ?? "").slice(0, 5);

  return Boolean(x && y && x === y);
}

const dateParts = new Intl.DateTimeFormat("en-GB", {
  timeZone: "America/Santiago",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).formatToParts(new Date());

const datePart = (type) =>
  dateParts.find((part) => part.type === type)?.value;

const today = [
  datePart("year"),
  datePart("month"),
  datePart("day"),
].join("-");

// Consultar todas las páginas de eventos públicos.
const published = [];
const pageSize = 500;

for (let from = 0; ; from += pageSize) {
  const { data, error } = await supabase
    .from("events")
    .select(
      "id, comedian, show, event_date, event_time, venue, ticket_url"
    )
    .eq("verified", true)
    .order("id")
    .range(from, from + pageSize - 1);

  if (error) {
    throw new Error(`Supabase: ${error.message}`);
  }

  published.push(...(data ?? []));

  if ((data ?? []).length < pageSize) break;
}

const candidates = (feed.events ?? []).filter(
  (event) => event.status === "review_candidate"
);

const results = [];

for (const event of candidates) {
  const urlKey = normalizeUrl(event.url);

  const exact = published.find(
    (item) =>
      item.event_date === event.date &&
      sameTime(item.event_time, event.time) &&
      urlKey &&
      normalizeUrl(item.ticket_url) === urlKey
  );

  const possible = published.filter(
    (item) =>
      item.event_date === event.date &&
      sameTime(item.event_time, event.time) &&
      normalize(item.venue) === normalize(event.venue)
  );

  let auditStatus = "needs_manual_review";

  if (event.date < today) {
    auditStatus = "past";
  } else if (exact) {
    auditStatus = "already_published";
  } else if (possible.length > 0) {
    auditStatus = "possible_duplicate";
  }

  results.push({
    ...event,
    auditStatus,
    existingEventId: exact?.id ?? null,
    possibleMatches: possible.map((item) => ({
      id: item.id,
      comedian: item.comedian,
      show: item.show,
      venue: item.venue,
    })),
  });
}

const summary = {
  analyzed: results.length,
  alreadyPublished: results.filter(
    (item) => item.auditStatus === "already_published"
  ).length,
  possibleDuplicates: results.filter(
    (item) => item.auditStatus === "possible_duplicate"
  ).length,
  needsManualReview: results.filter(
    (item) => item.auditStatus === "needs_manual_review"
  ).length,
  past: results.filter(
    (item) => item.auditStatus === "past"
  ).length,
};

await writeFile(
  new URL("audited-review-feed.json", base),
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      todayChile: today,
      summary,
      events: results,
    },
    null,
    2
  ) + "\n",
  "utf8"
);

console.log("\n🎭 RISAS RM — AUDITORÍA DE EVENTOS");
console.log("---------------------------------");
console.log("Eventos públicos consultados:", published.length);
console.log("Candidatos analizados:", summary.analyzed);
console.log("Ya publicados:", summary.alreadyPublished);
console.log("Posibles duplicados:", summary.possibleDuplicates);
console.log("Para revisión manual:", summary.needsManualReview);
console.log("Pasados:", summary.past);

for (const event of results) {
  console.log(
    `\n[${event.auditStatus}] ${event.date} ${event.time}`
  );
  console.log(`${event.name} — ${event.venue}`);

  if (event.possibleMatches.length > 0) {
    console.log(
      "Coincidencias:",
      event.possibleMatches.map(
        (item) => `${item.comedian} / ${item.show}`
      ).join("; ")
    );
  }
}

console.log("\nArchivo: data/audited-review-feed.json");
console.log("Modo de solo lectura: Supabase no fue modificado.");


import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Faltan las variables públicas de Supabase.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

const file = JSON.parse(
  await readFile(
    new URL("../data/discovered-events.json", import.meta.url),
    "utf8"
  )
);

function normalizeUrl(value) {
  if (!value) return null;

  try {
    const url = new URL(value);

    if (!["https:", "http:"].includes(url.protocol)) {
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

function normalizeText(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function getDateTime(value) {
  const match = String(value ?? "").match(
    /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/
  );

  return match
    ? { date: match[1], time: match[2] }
    : { date: null, time: null };
}

const { data: published, error } = await supabase
  .from("events")
  .select(
    "id, comedian, show, event_date, event_time, venue, ticket_url"
  )
  .eq("verified", true)
  .order("event_date", { ascending: false })
  .limit(1000);

if (error) {
  console.error("Error consultando eventos:", error.message);
  process.exit(1);
}

console.log(`Eventos públicos consultados: ${published.length}`);
console.log(`Eventos descubiertos: ${file.events.length}`);

const results = [];

for (const event of file.events) {
  const { date, time } = getDateTime(event.startDate);
  const discoveredUrl = normalizeUrl(event.url || event.sourceUrl);

  // Coincidencia fiable por URL exacta del evento.
  const exactMatch = published.find(
    (item) =>
      discoveredUrl &&
      normalizeUrl(item.ticket_url) === discoveredUrl
  );

  // Coincidencia posible, que requiere revisión humana.
  const possibleMatches = published.filter(
    (item) =>
      date &&
      time &&
      item.event_date === date &&
      String(item.event_time).slice(0, 5) === time &&
      normalizeText(item.venue) ===
        normalizeText(event.location)
  );

  let status = "new";
  let existing = null;

  if (exactMatch) {
    status = "existing";
    existing = exactMatch;
  } else if (possibleMatches.length > 0) {
    status = "review";
    existing = possibleMatches[0];
  }

  results.push({
    name: event.name,
    date,
    time,
    venue: event.location,
    status,
    existingEvent: existing
      ? {
          id: existing.id,
          comedian: existing.comedian,
          show: existing.show,
        }
      : null,
  });
}

console.log("\n--- COMPROBACIÓN DE DUPLICADOS ---");
console.log(JSON.stringify(results, null, 2));

console.log("\nResumen:");
console.log(
  "Existentes:",
  results.filter((e) => e.status === "existing").length
);
console.log(
  "Revisión manual:",
  results.filter((e) => e.status === "review").length
);
console.log(
  "Nuevos:",
  results.filter((e) => e.status === "new").length
);

console.log("\nModo de solo lectura: no se modificó Supabase.");


import { load } from "cheerio";
import { writeFile } from "node:fs/promises";

const CATEGORY_URL =
  "https://ticketplus.cl/taxons/stand-up-y-shows";

const MAX_EVENTS = 25;
const REQUEST_DELAY_MS = 400;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function download(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "RisasRM-Discovery/0.1",
        Accept: "text/html",
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return await response.text();
  } finally {
    clearTimeout(timeout);
  }
}

function collectEvents(value) {
  if (!value || typeof value !== "object") return [];

  if (Array.isArray(value)) {
    return value.flatMap(collectEvents);
  }

  const types = Array.isArray(value["@type"])
    ? value["@type"]
    : [value["@type"]];

  const result = types.some(
    (type) =>
      typeof type === "string" &&
      (type === "Event" || type.endsWith("Event"))
  )
    ? [value]
    : [];

  for (const field of [
    "@graph",
    "mainEntity",
    "itemListElement",
    "item",
  ]) {
    if (value[field]) {
      result.push(...collectEvents(value[field]));
    }
  }

  return result;
}

function extractEvents(html) {
  const $ = load(html);
  const events = [];

  $('script[type="application/ld+json"]').each((_, element) => {
    try {
      const json = JSON.parse($(element).html() ?? "");
      events.push(...collectEvents(json));
    } catch {
      // Ignorar bloques JSON-LD inválidos.
    }
  });

  return events;
}

function locationName(location) {
  if (typeof location === "string") return location;

  if (Array.isArray(location)) {
    return locationName(location[0]);
  }

  return location?.name ?? null;
}

function locationAddress(location) {
  const place = Array.isArray(location)
    ? location[0]
    : location;

  if (!place || typeof place !== "object") return null;

  const address = place.address;

  if (typeof address === "string") return address;

  return [
    address?.streetAddress,
    address?.addressLocality,
    address?.addressRegion,
    address?.addressCountry,
  ]
    .filter(Boolean)
    .join(", ") || null;
}

function getEventLinks(html) {
  const $ = load(html);
  const links = new Set();

  $('a[href]').each((_, element) => {
    const href = $(element).attr("href");

    if (!href) return;

    try {
      const url = new URL(href, CATEGORY_URL);

      if (
        url.protocol !== "https:" ||
        url.hostname !== "ticketplus.cl" ||
        !url.pathname.startsWith("/events/")
      ) {
        return;
      }

      url.search = "";
      url.hash = "";

      links.add(url.toString());
    } catch {
      // Ignorar enlaces inválidos.
    }
  });

  return [...links].slice(0, MAX_EVENTS);
}

console.log("🎭 RadarRisas - Descubrimiento Ticketplus");
console.log(`Cartelera: ${CATEGORY_URL}\n`);

const html = await download(CATEGORY_URL);
const links = getEventLinks(html);

console.log(`Enlaces encontrados: ${links.length}`);

const discovered = [];
const failures = [];

for (const [index, url] of links.entries()) {
  console.log(
    `\n[${index + 1}/${links.length}] Revisando ${url}`
  );

  try {
    const detailHtml = await download(url);
    const structuredEvents = extractEvents(detailHtml);

    if (structuredEvents.length === 0) {
      console.log("Sin datos Event JSON-LD.");
      failures.push({ url, reason: "no_json_ld" });
      continue;
    }

    for (const event of structuredEvents) {
      const name =
        typeof event.name === "string"
          ? event.name.trim()
          : null;

      const startDate =
        typeof event.startDate === "string"
          ? event.startDate
          : null;

      if (!name || !startDate) {
        failures.push({
          url,
          reason: "missing_name_or_date",
        });
        continue;
      }

      // Excluir funciones que ya terminaron.
      const instant = new Date(startDate);

      if (
        Number.isNaN(instant.getTime()) ||
        instant.getTime() < Date.now()
      ) {
        continue;
      }

      const record = {
        source: "Ticketplus - Stand Up y Shows",
        sourceUrl: url,
        name,
        startDate,
        location: locationName(event.location),
        venueAddress: locationAddress(event.location),
        url,
      };

      discovered.push(record);

      console.log(
        `✅ ${record.name} | ${record.startDate}`
      );
    }
  } catch (error) {
    console.log(`⚠️ ${error.message}`);
    failures.push({
      url,
      reason: error.message,
    });
  }

  await sleep(REQUEST_DELAY_MS);
}

// Eliminar resultados repetidos dentro de esta extracción.
const unique = [
  ...new Map(
    discovered.map((event) => [
      `${event.url}|${event.startDate}`,
      event,
    ])
  ).values(),
];

const output = {
  generatedAt: new Date().toISOString(),
  categoryUrl: CATEGORY_URL,
  linksFound: links.length,
  total: unique.length,
  events: unique,
  failures,
};

await writeFile(
  new URL(
    "../data/ticketplus-discovered.json",
    import.meta.url
  ),
  JSON.stringify(output, null, 2) + "\n",
  "utf8"
);

console.log("\n--- RESUMEN ---");
console.log(`Enlaces revisados: ${links.length}`);
console.log(`Funciones detectadas: ${unique.length}`);
console.log(`Fichas con problemas: ${failures.length}`);
console.log(
  "Archivo: data/ticketplus-discovered.json"
);
console.log("Supabase no fue modificado.");

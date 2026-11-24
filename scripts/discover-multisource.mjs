
import { readFile, writeFile } from "node:fs/promises";
import { load } from "cheerio";

const sources = JSON.parse(
  await readFile(
    new URL("../data/multi-sources.json", import.meta.url),
    "utf8"
  )
);

const now = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Santiago",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).format(new Date());

function normalize(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

async function fetchHtml(url) {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    15000
  );

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: "text/html",
        "User-Agent": "RisasRM-Research/0.1",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return response.text();
  } finally {
    clearTimeout(timeout);
  }
}

function collectEvents(node) {
  if (!node || typeof node !== "object") return [];

  if (Array.isArray(node)) {
    return node.flatMap(collectEvents);
  }

  const types = Array.isArray(node["@type"])
    ? node["@type"]
    : [node["@type"]];

  const result = types.some(
    (type) =>
      typeof type === "string" &&
      (type === "Event" || type.endsWith("Event"))
  )
    ? [node]
    : [];

  for (const field of [
    "@graph",
    "mainEntity",
    "itemListElement",
    "item",
  ]) {
    if (node[field]) {
      result.push(...collectEvents(node[field]));
    }
  }

  return result;
}

function readEventData(html) {
  const $ = load(html);
  const events = [];

  $('script[type="application/ld+json"]').each(
    (_, element) => {
      try {
        const json = JSON.parse($(element).html());
        events.push(...collectEvents(json));
      } catch {
        // Datos estructurados ausentes o inválidos.
      }
    }
  );

  return events;
}

function getPlace(location) {
  const place = Array.isArray(location)
    ? location[0]
    : location;

  if (typeof place === "string") {
    return { name: place, address: null };
  }

  const address = place?.address;

  return {
    name: place?.name ?? null,
    address:
      typeof address === "string"
        ? address
        : [
            address?.streetAddress,
            address?.addressLocality,
            address?.addressRegion,
            address?.addressCountry,
          ].filter(Boolean).join(", ") || null,
  };
}

function listingLinks(html, source) {
  const $ = load(html);
  const links = new Set();

  $("a[href]").each((_, element) => {
    try {
      const url = new URL(
        $(element).attr("href"),
        source.listingUrl
      );

      const title = normalize($(element).text());

      if (
        url.protocol !== "https:" ||
        url.hostname.replace(/^www\./, "") !==
          source.host.replace(/^www\./, "") ||
        !url.pathname.startsWith(source.pathPrefix) ||
        url.pathname ===
          new URL(source.listingUrl).pathname
      ) {
        return;
      }

      if (
        source.linkKeywords &&
        !source.linkKeywords.some((keyword) =>
          title.includes(normalize(keyword))
        )
      ) {
        return;
      }

      url.search = "";
      url.hash = "";

      links.add(url.toString());
    } catch {
      // Enlace no utilizable.
    }
  });

  return [...links].slice(
    0,
    source.maxLinks ?? 20
  );
}

async function discoverWebsite(source) {
  if (source.mode === "known_urls") {
    return source.urls ?? [];
  }

  const html = await fetchHtml(source.listingUrl);

  return listingLinks(html, source);
}

function isFuture(value) {
  const date = String(value ?? "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(date) &&
    date >= now;
}

function recordFromJsonLd(event, source, url) {
  const place = getPlace(event.location);

  return {
    source: source.name,
    sourceId: source.id,
    sourceUrl: url,
    url,
    name: event.name ?? null,
    startDate: event.startDate ?? null,
    location: place.name,
    venueAddress: place.address,
    extractionMethod: "jsonld",
  };
}

async function discoverTicketmaster(source) {
  const key = process.env.TICKETMASTER_API_KEY;

  if (!key) {
    console.log(
      "Ticketmaster: falta TICKETMASTER_API_KEY; omitido."
    );
    return [];
  }

  const url = new URL(
    "https://app.ticketmaster.com/discovery/v2/events.json"
  );

  url.searchParams.set("apikey", key);
  url.searchParams.set("countryCode", "CL");
  url.searchParams.set("classificationName", "comedy");
  url.searchParams.set("size", "100");
  url.searchParams.set("sort", "date,asc");

  const response = await fetch(url, {
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    throw new Error(
      `Ticketmaster API: HTTP ${response.status}`
    );
  }

  const json = await response.json();
  const events = json._embedded?.events ?? [];

  return events.map((event) => {
    const venue = event._embedded?.venues?.[0];
    const start = event.dates?.start;

    return {
      source: source.name,
      sourceId: source.id,
      sourceUrl: event.url,
      url: event.url,
      name: event.name ?? null,
      startDate:
        start?.localDate && start?.localTime
          ? `${start.localDate}T${start.localTime}`
          : start?.localDate ?? null,
      location: venue?.name ?? null,
      venueAddress: [
        venue?.address?.line1,
        venue?.city?.name,
        venue?.state?.name,
        venue?.country?.name,
      ].filter(Boolean).join(", ") || null,
      extractionMethod: "ticketmaster_api",
    };
  });
}

const discovered = [];
const failures = [];

for (const source of sources.filter((s) => s.enabled)) {
  console.log(`\n🎟️ ${source.name}`);

  try {
    if (source.mode === "api") {
      const events = await discoverTicketmaster(source);
      discovered.push(...events.filter(
        (event) => isFuture(event.startDate)
      ));
      console.log(`Eventos: ${events.length}`);
      continue;
    }

    const urls = await discoverWebsite(source);
    console.log(`Fichas encontradas: ${urls.length}`);

    for (const url of urls) {
      try {
        const html = await fetchHtml(url);
        const events = readEventData(html);

        for (const event of events) {
          const record = recordFromJsonLd(
            event,
            source,
            url
          );

          if (
            record.name &&
            isFuture(record.startDate)
          ) {
            discovered.push(record);
          }
        }

        if (events.length === 0) {
          failures.push({
            source: source.id,
            url,
            reason: "Sin Event JSON-LD",
          });
        }
      } catch (error) {
        failures.push({
          source: source.id,
          url,
          reason: error.message,
        });
      }
    }
  } catch (error) {
    failures.push({
      source: source.id,
      reason: error.message,
    });
    console.log(`No disponible: ${error.message}`);
  }
}

const unique = [
  ...new Map(
    discovered.map((event) => [
      `${event.sourceId}|${event.url}|${event.startDate}`,
      event,
    ])
  ).values(),
];

const output = {
  generatedAt: new Date().toISOString(),
  total: unique.length,
  events: unique,
  failures,
};

await writeFile(
  new URL(
    "../data/multisource-discovered.json",
    import.meta.url
  ),
  JSON.stringify(output, null, 2) + "\n",
  "utf8"
);

console.log("\n--- RESUMEN MULTIFUENTE ---");

for (const source of sources) {
  const count = unique.filter(
    (event) => event.sourceId === source.id
  ).length;

  console.log(`${source.name}: ${count}`);
}

console.log(`Total: ${unique.length}`);
console.log(`Problemas de extracción: ${failures.length}`);
console.log(
  "Archivo: data/multisource-discovered.json"
);
console.log("Supabase no fue modificado.");

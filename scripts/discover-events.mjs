
import { readFile, writeFile } from "node:fs/promises";

const sources = JSON.parse(
  await readFile(
    new URL("../data/event-sources.json", import.meta.url),
    "utf8"
  )
);

function extractJsonLd(html) {
  const blocks = [
    ...html.matchAll(
      /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
    ),
  ];

  const results = [];

  for (const block of blocks) {
    try {
      results.push(JSON.parse(block[1]));
    } catch {
      console.warn("Se encontró JSON-LD no válido.");
    }
  }

  return results;
}

function collectEvents(value) {
  if (!value || typeof value !== "object") return [];

  if (Array.isArray(value)) {
    return value.flatMap(collectEvents);
  }

  const types = Array.isArray(value["@type"])
    ? value["@type"]
    : [value["@type"]];

  const found = types.some(
    (type) =>
      typeof type === "string" &&
      (type === "Event" || type.endsWith("Event"))
  )
    ? [value]
    : [];

  if (value["@graph"]) {
    found.push(...collectEvents(value["@graph"]));
  }

  if (value.mainEntity) {
    found.push(...collectEvents(value.mainEntity));
  }

  if (value.itemListElement) {
    found.push(...collectEvents(value.itemListElement));
  }

  if (value.item) {
    found.push(...collectEvents(value.item));
  }

  return found;
}

async function inspectSource(source) {
  console.log(`\n🔎 Revisando: ${source.name}`);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(source.url, {
      headers: {
        "User-Agent": "RisasRM-EventDiscovery/0.1",
        Accept: "text/html",
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      console.log(`No disponible: HTTP ${response.status}`);
      return [];
    }

    const html = await response.text();
    const jsonLd = extractJsonLd(html);
    const events = jsonLd.flatMap(collectEvents);

    if (events.length === 0) {
      console.log(
        "No se encontraron eventos estructurados JSON-LD."
      );
      console.log(
        "Esta fuente necesitará otro método de extracción."
      );
      return [];
    }

    console.log(`Eventos estructurados: ${events.length}`);

    return events.map((event) => ({
      source: source.name,
      sourceUrl: source.url,
      name: event.name ?? null,
      startDate: event.startDate ?? null,
      location: event.location?.name ?? null,
      url: event.url ?? source.url,
    }));
  } catch (error) {
    console.log(
      `No se pudo consultar la fuente: ${error.message}`
    );
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

const discovered = [];

for (const source of sources) {
  if (!source.enabled) continue;

  if (!source.url?.startsWith("https://")) {
    console.log(`URL inválida: ${source.name}`);
    continue;
  }

  const events = await inspectSource(source);
  discovered.push(...events);
}

console.log("\n--- RESULTADO DEL DESCUBRIMIENTO ---");
console.log(JSON.stringify(discovered, null, 2));
console.log(`\nTotal detectado: ${discovered.length}`);
console.log("Modo de prueba: no se modificó Supabase.");


const outputPath = new URL(
    "../data/discovered-events.json",
    import.meta.url
  );

  await writeFile(
    outputPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        sourceCount: sources.filter((s) => s.enabled).length,
        total: discovered.length,
        events: discovered,
      },
      null,
      2
    ) + "\n",
    "utf8"
  );

  console.log(
    "\n✅ Resultados guardados en data/discovered-events.json"
  );

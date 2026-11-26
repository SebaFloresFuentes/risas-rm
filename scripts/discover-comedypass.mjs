
import { writeFile } from "node:fs/promises";
import { load } from "cheerio";
import { fetchPage } from "./lib/http-client.mjs";
import { extractPrice } from "./lib/price-extractor.mjs";
import { extractAvailability } from "./lib/availability-extractor.mjs";

const LISTING_URL = "https://comedypass.online/santiago/";
const MAX_EVENTS = 30;

const months = {
  enero: 1, febrero: 2, marzo: 3, abril: 4,
  mayo: 5, junio: 6, julio: 7, agosto: 8,
  septiembre: 9, setiembre: 9, octubre: 10,
  noviembre: 11, diciembre: 12,
};

function clean(value) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function plain(value) {
  return clean(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

async function download(url) {
  return fetchPage(url, {
    timeoutMs: 15000,
    retries: 2,
    backoffMs: 500,
  });
}

function findDate(text) {
  const normalized = plain(text);

  const match = normalized.match(
    /\b(\d{1,2})\s+(?:de\s+)?(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)(?:\s+(?:de\s+)?(20\d{2}))?\b/
  );

  if (!match) return null;

  const day = Number(match[1]);
  const month = months[match[2]];
  const year = match[3] ? Number(match[3]) : null;

  if (day < 1 || day > 31) return null;

  if (year) {
    const date = new Date(Date.UTC(year, month - 1, day));

    if (
      date.getUTCFullYear() !== year ||
      date.getUTCMonth() !== month - 1 ||
      date.getUTCDate() !== day
    ) {
      return null;
    }
  }

  return {
    day,
    month,
    year,
    date: year
      ? `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
      : null,
  };
}

function findTime(text) {
  const normalized = plain(text);

  // Ejemplos: 20:00 hrs, 2000 hrs, 19:30 hrs
  const match = normalized.match(
    /\b([01]?\d|2[0-3])[:.]?([0-5]\d)\s*(?:hrs?\.?|horas?)\b/
  );

  if (!match) return null;

  return `${match[1].padStart(2, "0")}:${match[2]}`;
}


function findVenue(title, description) {
  const normalized = plain(title);

  // Recintos identificados en las fichas de Comedy Pass.
  // Estos nombres deben mantenerse actualizados y verificarse.
  const venues = [
    ["distrito 04", "Distrito 04"],
    ["happy people", "Happy People"],
    ["la cantera restobeer", "La Cantera Restobeer"],
    ["club suizo", "Club Suizo"],
    ["zermantt restaurant", "Zermatt Restaurant"],
    ["jardin teresa", "Jardín Teresa"],
    ["gales 6030", "Gales 6030 Restobar"],
    ["comedy restobar", "Comedy Restobar"],
    ["palermo teatro bar", "Palermo Teatro Bar"],
    ["fuente san miguelina", "Fuente San Miguelina"],
  ];

  for (const [keyword, venue] of venues) {
    if (normalized.includes(keyword)) {
      return venue;
    }
  }

  // Si el título no permite identificarlo, intentar
  // obtener el nombre desde la descripción.
  const match = clean(description).match(
    /\ben\s+(.{3,100}?)\s+ubicad[oa]\s+en\b/i
  );

  if (!match) return null;

  const value = clean(match[1]);

  return value.length <= 60 ? value : null;
}


function findAddress(description) {
  const match = clean(description).match(
    /\bubicad[oa]\s+en\s+(.{5,120}?)(?=\s+IMPORTANTE\b|\s+\*\*|$)/i
  );

  return match ? clean(match[1]) : null;
}

console.log("🎭 RADARRISAS - COMEDY PASS");

const { html: listingHtml } = await download(LISTING_URL);
const $listing = load(listingHtml);
const links = new Set();

$listing("a[href]").each((_, element) => {
  try {
    const url = new URL(
      $listing(element).attr("href"),
      LISTING_URL
    );

    if (
      url.protocol !== "https:" ||
      url.hostname !== "comedypass.online" ||
      !url.pathname.startsWith("/tienda/") ||
      url.pathname.replace(/\/+$/, "") === "/tienda"
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

const urls = [...links].slice(0, MAX_EVENTS);

console.log(`Fichas encontradas: ${urls.length}`);

const events = [];
const failures = [];

for (const [index, url] of urls.entries()) {
  console.log(`\n[${index + 1}/${urls.length}] ${url}`);

  try {
    const page = await download(url);
    const html = page.html;
    const $ = load(html);

    const title = clean($("h1").first().text());
    const description = clean(
      $(".woocommerce-product-details__short-description")
        .first()
        .text()
    );
    const ogDescription = clean(
      $('meta[property="og:description"]').attr("content")
    );

    const date = findDate(title) ??
      findDate(description);

    const time = findTime(title) ??
      findTime(description);

    const event = {
      source: "Comedy Pass",
      sourceId: "comedypass",
      sourceUrl: url,
      url,
      name: title || null,
      date,
      eventTime: time,
      location: findVenue(title, description),
      venueAddress: findAddress(description),
      description: description || ogDescription || null,
      extractionMethod: "woocommerce_html",
      reviewRequired: true,
      issues: [],
      ...extractPrice(html, page.finalUrl, {
        provider: "Comedy Pass",
      }),
      ...extractAvailability(html, {
        provider: "Comedy Pass",
        checkedAt: page.verifiedAt,
      }),
    };

    if (!event.name) event.issues.push("missing_title");
    if (!date) event.issues.push("missing_date");
    if (date && !date.year) {
      event.issues.push("year_not_confirmed");
    }
    if (!time) event.issues.push("missing_time");
    if (!event.location) {
      event.issues.push("venue_not_confirmed");
    }
    if (!event.venueAddress) {
      event.issues.push("address_not_confirmed");
    }

    events.push(event);

    console.log(`Título: ${event.name}`);
    console.log(
      `Fecha: ${date?.day ?? "?"}/${date?.month ?? "?"}/${date?.year ?? "sin año"}`
    );
    console.log(`Hora: ${time ?? "No encontrada"}`);
    console.log(`Recinto: ${event.location ?? "Por revisar"}`);
    console.log(`Dirección: ${event.venueAddress ?? "Por revisar"}`);
    console.log(`Precio: ${event.priceFrom ?? "No encontrado"}`);
    console.log(`Observaciones: ${event.issues.join(", ") || "Ninguna"}`);
  } catch (error) {
    failures.push({
      url,
      reason: error.message,
    });
    console.log(`Error: ${error.message}`);
  }

  // Reducir la frecuencia de solicitudes.
  await new Promise((resolve) => setTimeout(resolve, 500));
}

const output = {
  generatedAt: new Date().toISOString(),
  source: "Comedy Pass",
  total: events.length,
  events,
  failures,
};

await writeFile(
  new URL("../data/comedypass-discovered.json", import.meta.url),
  JSON.stringify(output, null, 2) + "\n",
  "utf8"
);

console.log("\n--- RESUMEN COMEDY PASS ---");
console.log(`Fichas revisadas: ${urls.length}`);
console.log(`Registros extraídos: ${events.length}`);
console.log(`Errores de consulta: ${failures.length}`);
console.log(
  `Con año sin confirmar: ${
    events.filter((e) => e.issues.includes("year_not_confirmed")).length
  }`
);
console.log("Archivo: data/comedypass-discovered.json");
console.log("Supabase no fue modificado.");

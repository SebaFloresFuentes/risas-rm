
import { readFile } from "node:fs/promises";
import { extractPrice } from "./lib/price-extractor.mjs";

const feed = JSON.parse(
  await readFile(
    "data/normalized-candidates.json",
    "utf8"
  )
);

const samples = [
  feed.candidates.find(
    e => e.ticket_provider === "Ticketplus"
  ),
  feed.candidates.find(
    e => e.ticket_provider === "PuntoTicket"
  )
].filter(Boolean);

const results = [];

for (const event of samples) {
  try {
    const response = await fetch(event.ticket_url, {
      headers: {
        "User-Agent": "Mozilla/5.0",
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "es-CL,es;q=0.9"
      },
      signal: AbortSignal.timeout(20000)
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const html = await response.text();

    const result = extractPrice(
      html,
      response.url
    );

    results.push({
      source: event.ticket_provider,
      comedian: event.comedian,
      ...result
    });

  } catch (error) {
    results.push({
      source: event.ticket_provider,
      comedian: event.comedian,
      error: error.message
    });
  }
}

console.log("\n=== RADARRISAS PRICE EXTRACTOR ===\n");

console.table(results);

console.log("\nSupabase no fue modificado.");

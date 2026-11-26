
import { readFile } from "node:fs/promises";
import * as cheerio from "cheerio";

const feed = JSON.parse(
  await readFile("data/normalized-candidates.json", "utf8")
);

const comedy = JSON.parse(
  await readFile("data/comedypass-discovered.json", "utf8")
);

const samples = [
  {
    source: "Ticketplus",
    url: feed.candidates.find(
      e => e.ticket_provider === "Ticketplus"
    )?.ticket_url
  },
  {
    source: "PuntoTicket",
    url: feed.candidates.find(
      e => e.ticket_provider === "PuntoTicket"
    )?.ticket_url
  },
  {
    source: "Comedy Pass",
    url: comedy.events[0]?.url
      ?? comedy.events[0]?.sourceUrl
      ?? comedy.events[0]?.ticketUrl
  }
];

for (const sample of samples) {
  console.log("\n" + "=".repeat(60));
  console.log(sample.source);
  console.log(sample.url);
  console.log("=".repeat(60));

  if (!sample.url) {
    console.log("URL no disponible");
    continue;
  }

  try {
    const response = await fetch(sample.url, {
      headers: {
        "User-Agent": "Mozilla/5.0",
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "es-CL,es;q=0.9"
      },
      signal: AbortSignal.timeout(20000)
    });

    console.log("HTTP:", response.status);
    console.log("URL final:", response.url);

    if (!response.ok) continue;

    const html = await response.text();
    const $ = cheerio.load(html);

    console.log("Tamaño HTML:", html.length);
    console.log("Título:", $("title").text());

    console.log("\n--- METADATOS DE PRECIO ---");

    $("meta").each((_, el) => {
      const attributes = el.attribs ?? {};

      if (
        /price|currency|amount|precio/i.test(
          JSON.stringify(attributes)
        )
      ) {
        console.log(attributes);
      }
    });

    console.log("\n--- JSON-LD ---");

    $('script[type="application/ld+json"]')
      .each((_, el) => {
        const content = $(el).text();

        try {
          const data = JSON.parse(content);

          function inspect(value, path = "root") {
            if (!value || typeof value !== "object") {
              return;
            }

            for (const [key, item] of Object.entries(value)) {
              if (
                /price|offers|currency|availability/i.test(key)
              ) {
                console.log(
                  `${path}.${key}:`,
                  JSON.stringify(item).slice(0, 1500)
                );
              }

              if (item && typeof item === "object") {
                inspect(item, `${path}.${key}`);
              }
            }
          }

          inspect(data);
        } catch {
          console.log("JSON-LD no interpretable");
        }
      });

    console.log("\n--- SELECTORES DE PRECIO ---");

    const selectors = [
      ".price",
      ".woocommerce-Price-amount",
      '[class*="price"]',
      '[class*="Price"]',
      '[class*="precio"]',
      '[itemprop="price"]',
      "[data-price]"
    ];

    for (const selector of selectors) {
      const values = $(selector)
        .map((_, el) => {
          return (
            $(el).attr("content")
            ?? $(el).attr("data-price")
            ?? $(el).text()
          ).trim();
        })
        .get()
        .filter(Boolean);

      if (values.length) {
        console.log(
          selector,
          [...new Set(values)].slice(0, 8)
        );
      }
    }

    console.log("\n--- PRECIOS EN TEXTO VISIBLE ---");

    $("script, style, noscript").remove();

    const body = $("body")
      .text()
      .replace(/\s+/g, " ");

    const amounts = body.match(
      /(?:CLP\s*|\$\s*)\d[\d.,]*/gi
    ) ?? [];

    console.log(
      [...new Set(amounts)].slice(0, 20)
    );

  } catch (error) {
    console.log("Error:", error.message);
  }
}

import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  extractAvailability,
  mergeCommercialObservation,
} from "../lib/availability-extractor.mjs";
import { extractPrice } from "../lib/price-extractor.mjs";
import {
  eventIdentity,
  normalizeEventUrl,
  normalizeProvider,
  santiagoEventInstant,
} from "../lib/event-normalization.mjs";

async function fixture(path) {
  return readFile(new URL(`../fixtures/${path}`, import.meta.url), "utf8");
}

const checkedAt = "2026-11-25T12:00:00.000Z";

test("un sector agotado no agota la función si otro está disponible", async () => {
  const html = await fixture("availability/available-mixed-sectors.html");
  const result = extractAvailability(html, {
    provider: "Ticketplus",
    startDate: "2026-12-10T20:00:00-03:00",
    checkedAt,
  });
  assert.equal(result.availabilityStatus, "available");
});

test("todos los sectores explícitamente agotados confirman sold_out", async () => {
  const html = await fixture("availability/sold-out-all-sectors.html");
  const result = extractAvailability(html, {
    startDate: "2026-12-10T20:00:00-03:00",
    checkedAt,
  });
  assert.equal(result.availabilityStatus, "sold_out");
});

test("un sector agotado y otro estado no reconocido producen unknown", async () => {
  const html = await fixture("availability/sector-sold-out-unknown-rest.html");
  const result = extractAvailability(html, { checkedAt });
  assert.equal(result.availabilityStatus, "unknown");
  assert.equal(result.availabilityVerifiedAt, null);
});

test("limited requiere una indicación explícita", async () => {
  const html = await fixture("availability/limited.html");
  assert.equal(
    extractAvailability(html, { checkedAt }).availabilityStatus,
    "limited"
  );
});

test("Comedy Pass usa evidencia explícita de stock", async () => {
  const html = await fixture("availability/comedypass-in-stock.html");
  assert.equal(
    extractAvailability(html, { provider: "Comedy Pass", checkedAt })
      .availabilityStatus,
    "available"
  );
});

test("funciones que comparten URL se seleccionan por fecha y hora", async () => {
  const html = await fixture("availability/two-performances.html");
  const first = extractAvailability(html, {
    startDate: "2026-12-10T20:00:00-03:00",
    checkedAt,
  });
  const second = extractAvailability(html, {
    startDate: "2026-12-11T20:00:00-03:00",
    checkedAt,
  });
  assert.equal(first.availabilityStatus, "sold_out");
  assert.equal(second.availabilityStatus, "available");
  assert.equal(
    extractPrice(html, "https://ticket.example/shared", {
      startDate: "2026-12-11T20:00:00-03:00",
    }).priceFrom,
    12000
  );
});

test("un fallo temporal conserva el último estado y precio confirmados", () => {
  const merged = mergeCommercialObservation(
    {
      priceFrom: 15000,
      priceCurrency: "CLP",
      availabilityStatus: "available",
      availabilityVerifiedAt: "2026-11-24T12:00:00.000Z",
      availabilityEvidence: ["json_ld:instock"],
    },
    {
      priceFrom: null,
      availabilityStatus: "unknown",
      availabilityCheckedAt: checkedAt,
    }
  );
  assert.equal(merged.priceFrom, 15000);
  assert.equal(merged.availabilityStatus, "available");
  assert.equal(merged.availabilityStale, true);
});

test("detecta reposición después de sold_out", () => {
  const merged = mergeCommercialObservation(
    { availabilityStatus: "sold_out" },
    {
      availabilityStatus: "available",
      availabilityCheckedAt: checkedAt,
      availabilityVerifiedAt: checkedAt,
    }
  );
  assert.equal(merged.availabilityTransition, "restocked");
});

test("Comedy Pass solo acepta un precio CLP visible y verificable", async () => {
  const html = await fixture("prices/comedypass-visible-clp.html");
  const result = extractPrice(html, "https://comedypass.online/tienda/demo", {
    provider: "Comedy Pass",
  });
  assert.equal(result.priceFrom, 12000);
  assert.equal(result.priceCurrency, "CLP");
  assert.equal(result.priceMethod, "provider_html");
});

test("normalización conserva funciones distintas y elimina tracking", () => {
  assert.equal(normalizeProvider("TicketPlus"), "Ticketplus");
  assert.equal(
    normalizeEventUrl("https://www.ticketplus.cl/events/demo/?utm_source=x#buy"),
    "https://ticketplus.cl/events/demo"
  );
  assert.notEqual(
    eventIdentity({
      ticket_url: "https://ticketplus.cl/events/shared",
      event_date: "2026-12-10",
      event_time: "20:00",
    }),
    eventIdentity({
      ticket_url: "https://ticketplus.cl/events/shared",
      event_date: "2026-12-11",
      event_time: "20:00",
    })
  );
});

test("fechas de funciones se interpretan en America/Santiago", () => {
  assert.equal(
    santiagoEventInstant("2026-12-10", "20:00")?.toISOString(),
    "2026-12-10T23:00:00.000Z"
  );
  assert.equal(
    santiagoEventInstant("2026-07-10", "20:00")?.toISOString(),
    "2026-07-11T00:00:00.000Z"
  );
});

import * as cheerio from "cheerio";

const CONFIRMED_STATES = new Set(["available", "limited", "sold_out"]);

function clean(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function schemaToken(value) {
  return clean(value).split("/").pop().toLowerCase();
}

function types(node) {
  return [node?.["@type"]].flat().filter(Boolean).map(schemaToken);
}

function availabilityToken(value) {
  return schemaToken(value);
}

function collectCommerceNodes(value, result = []) {
  if (!value || typeof value !== "object") return result;
  if (Array.isArray(value)) {
    value.forEach((item) => collectCommerceNodes(item, result));
    return result;
  }

  if (types(value).some((type) => type === "event" || type.endsWith("event"))) {
    result.push(value);
  }

  for (const key of ["@graph", "mainEntity", "itemListElement", "item"]) {
    if (value[key]) collectCommerceNodes(value[key], result);
  }

  return result;
}

function samePerformance(node, startDate) {
  if (!startDate) return true;
  if (!node?.startDate) return false;

  const expected = String(startDate).slice(0, 16);
  const actual = String(node.startDate).slice(0, 16);
  return actual === expected;
}

function readOfferSignals(offers) {
  const signals = [];

  for (const offer of [offers].flat()) {
    if (!offer || typeof offer !== "object") continue;

    if (offer.offers) {
      signals.push(...readOfferSignals(offer.offers));
    }

    const token = availabilityToken(offer.availability);
    if (token) signals.push(token);
  }

  return signals;
}

function classifySignals(signals) {
  const available = signals.filter((value) =>
    ["instock", "onlineonly", "preorder", "presale"].includes(value)
  ).length;
  const limited = signals.filter((value) => value === "limitedavailability").length;
  const unavailable = signals.filter((value) =>
    ["soldout", "outofstock", "discontinued"].includes(value)
  ).length;
  const recognized = available + limited + unavailable;

  if (available > 0) return "available";
  if (
    limited > 0 &&
    limited + unavailable === recognized &&
    recognized === signals.length
  ) {
    return "limited";
  }
  if (unavailable > 0 && unavailable === recognized && recognized === signals.length) {
    return "sold_out";
  }
  return "unknown";
}

function jsonLdAvailability($, startDate) {
  const matchingEvents = [];

  $('script[type="application/ld+json"]').each((_, element) => {
    try {
      const json = JSON.parse($(element).text());
      matchingEvents.push(
        ...collectCommerceNodes(json).filter((node) => samePerformance(node, startDate))
      );
    } catch {
      // Un bloque inválido no constituye evidencia de disponibilidad.
    }
  });

  const signals = matchingEvents.flatMap((event) => {
    const eventSignal = availabilityToken(event.availability);
    return [eventSignal, ...readOfferSignals(event.offers)].filter(Boolean);
  });

  return {
    status: classifySignals(signals),
    evidence: [...new Set(signals)].map((signal) => `json_ld:${signal}`),
  };
}

function htmlAvailability($, provider) {
  const normalizedProvider = clean(provider).toLowerCase();
  const stockText = clean($("p.stock, .stock, [class*='stock']").first().text()).toLowerCase();
  const primaryText = clean(
    $("main, .summary, article, .event-detail").first().text()
  ).toLowerCase();
  const statusText = clean(
    $(
      "[class*='sold-out'], [class*='soldout'], .event-status, .availability-status, p.stock"
    )
      .first()
      .text()
  ).toLowerCase();

  if (/últimas entradas|ultimas entradas|últimos tickets|ultimos tickets/.test(primaryText)) {
    return { status: "limited", evidence: ["html:explicit_last_tickets"] };
  }

  if (normalizedProvider.includes("comedy pass")) {
    if (/hay existencias|en stock/.test(stockText)) {
      return { status: "available", evidence: ["html:woocommerce_in_stock"] };
    }
    if (/agotado|sin existencias/.test(stockText)) {
      return { status: "sold_out", evidence: ["html:woocommerce_out_of_stock"] };
    }
  }

  const wholeEventMarkers = [
    "evento agotado",
    "función agotada",
    "funcion agotada",
    "entradas agotadas",
    "tickets agotados",
  ];

  if (wholeEventMarkers.some((marker) => statusText.includes(marker))) {
    return { status: "sold_out", evidence: ["html:explicit_whole_event_sold_out"] };
  }

  return { status: "unknown", evidence: [] };
}

export function extractAvailability(html, options = {}) {
  const checkedAt = options.checkedAt ?? new Date().toISOString();
  const $ = cheerio.load(html);
  const structured = jsonLdAvailability($, options.startDate);
  const fallback = htmlAvailability($, options.provider);
  const selected = structured.status !== "unknown" ? structured : fallback;

  return {
    availabilityStatus: selected.status,
    availabilitySource:
      selected.status === "unknown"
        ? null
        : structured.status !== "unknown"
          ? "json_ld"
          : "provider_html",
    availabilityEvidence: selected.evidence,
    availabilityCheckedAt: checkedAt,
    availabilityVerifiedAt:
      CONFIRMED_STATES.has(selected.status) ? checkedAt : null,
  };
}

export function mergeCommercialObservation(previous = {}, observation = {}) {
  const confirmed = CONFIRMED_STATES.has(observation.availabilityStatus);
  const priceConfirmed = Number.isSafeInteger(observation.priceFrom) && observation.priceFrom >= 0;

  return {
    ...previous,
    ...observation,
    priceFrom: priceConfirmed
      ? observation.priceFrom
      : previous.priceFrom ?? null,
    priceCurrency: priceConfirmed
      ? observation.priceCurrency ?? "CLP"
      : previous.priceCurrency ?? null,
    availabilityStatus: confirmed
      ? observation.availabilityStatus
      : previous.availabilityStatus ?? "unknown",
    availabilitySource: confirmed
      ? observation.availabilitySource
      : previous.availabilitySource ?? null,
    availabilityEvidence: confirmed
      ? observation.availabilityEvidence ?? []
      : previous.availabilityEvidence ?? [],
    availabilityVerifiedAt: confirmed
      ? observation.availabilityVerifiedAt ?? observation.availabilityCheckedAt
      : previous.availabilityVerifiedAt ?? null,
    availabilityCheckedAt:
      observation.availabilityCheckedAt ?? previous.availabilityCheckedAt ?? null,
    availabilityStale: !confirmed && Boolean(previous.availabilityVerifiedAt),
    availabilityTransition:
      confirmed &&
      previous.availabilityStatus === "sold_out" &&
      ["available", "limited"].includes(observation.availabilityStatus)
        ? "restocked"
        : null,
  };
}


import * as cheerio from "cheerio";

function parseCLP(value) {
  if (value === null || value === undefined) {
    return null;
  }

  const raw = String(value).trim();

  if (!/^\d+(?:\.0+)?$/.test(raw)) {
    return null;
  }

  const amount = Number(raw);

  return Number.isSafeInteger(amount) &&
    amount > 0 &&
    amount <= 2147483647
    ? amount
    : null;
}

function parseDisplayedCLP(value) {
  const raw = String(value ?? "").replace(/\s+/g, " ");
  const matches = [
    ...raw.matchAll(/(?:CLP\s*|\$\s*)(\d{1,3}(?:\.\d{3})+|\d{4,9})/gi),
  ];

  const prices = matches
    .map((match) => Number(match[1].replace(/\./g, "")))
    .filter((amount) => Number.isSafeInteger(amount) && amount > 0);

  return prices.length ? Math.min(...prices) : null;
}

function normalizeUrl(value, base) {
  try {
    const url = new URL(value, base);

    return (
      url.origin +
      url.pathname.replace(/\/+$/, "")
    );
  } catch {
    return null;
  }
}

function sameEventUrl(value, pageUrl) {
  if (!value) return false;

  return normalizeUrl(value, pageUrl) ===
    normalizeUrl(pageUrl);
}

function getTypes(value) {
  return [value?.["@type"]]
    .flat()
    .filter(Boolean)
    .map(type =>
      String(type).split("/").pop().toLowerCase()
    );
}

function isUnavailable(value) {
  return /soldout|outofstock|discontinued/i.test(
    String(value ?? "")
  );
}

function readOffers(offers, pageUrl, parentCurrency) {
  const prices = [];

  for (const offer of [offers].flat()) {
    if (!offer || typeof offer !== "object") {
      continue;
    }

    if (isUnavailable(offer.availability)) {
      continue;
    }

    if (offer.url && !sameEventUrl(offer.url, pageUrl)) {
      continue;
    }

    const currency = String(
      offer.priceCurrency ??
      offer.PriceCurrency ??
      parentCurrency ??
      ""
    ).toUpperCase();

    const types = getTypes(offer);

    if (types.includes("aggregateoffer")) {
      if (offer.offers) {
        prices.push(
          ...readOffers(
            offer.offers,
            pageUrl,
            currency
          )
        );
      } else if (currency === "CLP") {
        const price = parseCLP(offer.lowPrice);

        if (price !== null) prices.push(price);
      }

      continue;
    }

    if (currency !== "CLP") continue;

    const price = parseCLP(offer.price);

    if (price !== null) {
      prices.push(price);
    }
  }

  return prices;
}

function getStructuredPrices($, pageUrl, startDate) {
  const prices = [];

  function inspect(node) {
    if (!node || typeof node !== "object") {
      return;
    }

    if (Array.isArray(node)) {
      node.forEach(inspect);
      return;
    }

    const types = getTypes(node);

    const isEvent = types.some(type =>
      type === "event" || type.endsWith("event")
    );

    const isProduct = types.includes("product");

    const matchesPerformance =
      !startDate ||
      !isEvent ||
      String(node.startDate ?? "").slice(0, 16) ===
        String(startDate).slice(0, 16);

    const matchesPage =
      sameEventUrl(node.url, pageUrl) ||
      [node.offers].flat().some(offer =>
        sameEventUrl(offer?.url, pageUrl)
      );

    if (
      (isEvent || isProduct) &&
      matchesPage &&
      matchesPerformance &&
      !isUnavailable(node.eventStatus) &&
      node.offers
    ) {
      prices.push(
        ...readOffers(node.offers, pageUrl)
      );
    }

    if (node["@graph"]) {
      inspect(node["@graph"]);
    }

    if (node.mainEntity) {
      inspect(node.mainEntity);
    }
  }

  $('script[type="application/ld+json"]')
    .each((_, element) => {
      try {
        inspect(
          JSON.parse($(element).text())
        );
      } catch {
        // Ignorar bloques JSON-LD inválidos.
      }
    });

  return prices;
}

export function extractPrice(html, pageUrl, options = {}) {
  const $ = cheerio.load(html);

  const structuredPrices = [
    ...new Set(getStructuredPrices($, pageUrl, options.startDate))
  ];

  const metaAmount =
    $('meta[property="og:product:price:amount"]')
      .attr("content") ??
    $('meta[property="product:price:amount"]')
      .attr("content");

  const metaCurrency =
    $('meta[property="og:product:price:currency"]')
      .attr("content") ??
    $('meta[property="product:price:currency"]')
      .attr("content");

  const metaPrice =
    String(metaCurrency).toUpperCase() === "CLP"
      ? parseCLP(metaAmount)
      : null;

  const provider = String(options.provider ?? "").toLowerCase();
  const commerceText = $(
    ".summary .price, .summary .woocommerce-Price-amount, [itemprop='price']"
  )
    .map((_, element) =>
      $(element).attr("content") ?? $(element).text()
    )
    .get()
    .join(" ");

  const commercePrice =
    provider.includes("comedy pass") ||
    String(metaCurrency).toUpperCase() === "CLP"
      ? parseDisplayedCLP(commerceText)
      : null;

  if (structuredPrices.length) {
    const price = Math.min(...structuredPrices);

    return {
      priceFrom: price,
      priceCurrency: "CLP",
      priceMethod: "json_ld",
      priceIssues:
        metaPrice !== null && metaPrice !== price
          ? ["price_sources_mismatch"]
          : []
    };
  }

  if (metaPrice !== null) {
    return {
      priceFrom: metaPrice,
      priceCurrency: "CLP",
      priceMethod: "html_metadata",
      priceIssues: ["price_availability_unconfirmed"]
    };
  }

  if (commercePrice !== null) {
    return {
      priceFrom: commercePrice,
      priceCurrency: "CLP",
      priceMethod: "provider_html",
      priceIssues: ["price_availability_unconfirmed"]
    };
  }

  return {
    priceFrom: null,
    priceCurrency: null,
    priceMethod: null,
    priceIssues: ["price_not_found"]
  };
}

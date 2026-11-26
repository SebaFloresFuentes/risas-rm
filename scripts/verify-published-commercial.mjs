import { writeFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import { fetchPage } from "./lib/http-client.mjs";
import { extractPrice } from "./lib/price-extractor.mjs";
import {
  extractAvailability,
  mergeCommercialObservation,
} from "./lib/availability-extractor.mjs";
import {
  normalizeEventUrl,
  normalizeProvider,
  santiagoEventInstant,
} from "./lib/event-normalization.mjs";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error("Faltan las variables públicas de Supabase.");
}

const todayChile = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Santiago",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).format(new Date());

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data, error } = await supabase
  .from("events")
  .select(
    "id,event_date,event_time,ticket_provider,ticket_url,price_from,sold_out,source_checked_at"
  )
  .eq("verified", true)
  .gte("event_date", todayChile)
  .order("event_date")
  .order("event_time");

if (error) throw new Error(`Supabase: ${error.message}`);

const upcomingHours = Number(process.env.RADARRISAS_UPCOMING_HOURS ?? 0);
const now = Date.now();
const events = (data ?? []).filter((event) => {
  if (!normalizeEventUrl(event.ticket_url)) return false;
  if (!Number.isFinite(upcomingHours) || upcomingHours <= 0) return true;
  const instant = santiagoEventInstant(event.event_date, event.event_time);
  if (!instant) return false;
  const delta = instant.getTime() - now;
  return delta >= 0 && delta <= upcomingHours * 60 * 60 * 1000;
});
const groups = new Map();

for (const event of events) {
  const url = normalizeEventUrl(event.ticket_url);
  if (!groups.has(url)) groups.set(url, []);
  groups.get(url).push(event);
}

const observations = [];
const failures = [];

for (const [url, performances] of groups) {
  try {
    const page = await fetchPage(url, {
      timeoutMs: 20000,
      retries: 2,
      backoffMs: 600,
    });

    for (const event of performances) {
      const provider = normalizeProvider(event.ticket_provider);
      const startDate = `${event.event_date}T${String(event.event_time).slice(0, 5)}`;
      const price = extractPrice(page.html, page.finalUrl, {
        provider,
        startDate,
      });
      const availability = extractAvailability(page.html, {
        provider,
        startDate,
        checkedAt: page.verifiedAt,
      });
      const previous = {
        priceFrom: event.price_from,
        priceCurrency: event.price_from === null ? null : "CLP",
        availabilityStatus: event.sold_out ? "sold_out" : "unknown",
        availabilityVerifiedAt: event.sold_out ? event.source_checked_at : null,
      };
      const effective = mergeCommercialObservation(previous, {
        ...price,
        ...availability,
      });

      observations.push({
        eventId: event.id,
        provider,
        eventDate: event.event_date,
        eventTime: String(event.event_time).slice(0, 5),
        sourceUrl: url,
        observed: { ...price, ...availability },
        effective,
      });
    }
  } catch (requestError) {
    const attemptedAt = new Date().toISOString();

    for (const event of performances) {
      const effective = mergeCommercialObservation(
        {
          priceFrom: event.price_from,
          priceCurrency: event.price_from === null ? null : "CLP",
          availabilityStatus: event.sold_out ? "sold_out" : "unknown",
          availabilityVerifiedAt: event.sold_out ? event.source_checked_at : null,
        },
        {
          priceFrom: null,
          availabilityStatus: "unknown",
          availabilityCheckedAt: attemptedAt,
        }
      );

      observations.push({
        eventId: event.id,
        provider: normalizeProvider(event.ticket_provider),
        eventDate: event.event_date,
        eventTime: String(event.event_time).slice(0, 5),
        sourceUrl: url,
        observed: {
          priceFrom: null,
          availabilityStatus: "unknown",
          availabilityCheckedAt: attemptedAt,
        },
        effective,
      });
    }

    failures.push({
      sourceUrl: url,
      reason: requestError.message,
      attemptedAt,
      affectedPerformances: performances.length,
    });
  }

  await new Promise((resolve) => setTimeout(resolve, 350));
}

const output = {
  generatedAt: new Date().toISOString(),
  todayChile,
  upcomingHours: upcomingHours > 0 ? upcomingHours : null,
  mode: "dry-run",
  writesPerformed: 0,
  summary: {
    eventsRead: data?.length ?? 0,
    eventsWithTicketUrl: events.length,
    uniquePagesFetched: groups.size,
    confirmedAvailable: observations.filter(
      (item) => item.observed.availabilityStatus === "available"
    ).length,
    confirmedLimited: observations.filter(
      (item) => item.observed.availabilityStatus === "limited"
    ).length,
    confirmedSoldOut: observations.filter(
      (item) => item.observed.availabilityStatus === "sold_out"
    ).length,
    unknown: observations.filter(
      (item) => item.observed.availabilityStatus === "unknown"
    ).length,
    pricesObserved: observations.filter(
      (item) => item.observed.priceFrom !== null
    ).length,
    restocked: observations.filter(
      (item) => item.effective.availabilityTransition === "restocked"
    ).length,
    failures: failures.length,
  },
  observations,
  failures,
};

await writeFile(
  new URL("../data/commercial-verification.json", import.meta.url),
  JSON.stringify(output, null, 2) + "\n",
  "utf8"
);

console.log("\n=== RADARRISAS COMMERCIAL VERIFICATION ===\n");
console.table(output.summary);
console.log("Modo dry-run: Supabase no fue modificado.");

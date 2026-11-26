const PROVIDERS = new Map([
  ["ticketplus", "Ticketplus"],
  ["ticket plus", "Ticketplus"],
  ["puntoticket", "PuntoTicket"],
  ["punto ticket", "PuntoTicket"],
  ["comedypass", "Comedy Pass"],
  ["comedy pass", "Comedy Pass"],
  ["ticketmaster", "Ticketmaster Chile"],
  ["ticketmaster chile", "Ticketmaster Chile"],
  ["passline", "Passline"],
]);

const TRACKING_PARAMETERS = [
  "fbclid",
  "gclid",
  "mc_cid",
  "mc_eid",
  "utm_campaign",
  "utm_content",
  "utm_medium",
  "utm_source",
  "utm_term",
];

export function normalizeText(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function normalizeProvider(value) {
  const normalized = normalizeText(value);
  return PROVIDERS.get(normalized) ?? (String(value ?? "").trim() || null);
}

export function normalizeEventUrl(value) {
  try {
    const url = new URL(value);

    if (url.protocol !== "https:" || url.username || url.password) {
      return null;
    }

    url.hash = "";
    TRACKING_PARAMETERS.forEach((key) => url.searchParams.delete(key));
    url.hostname = url.hostname.toLowerCase().replace(/^www\./, "");
    url.pathname = url.pathname.replace(/\/{2,}/g, "/").replace(/\/+$/, "") || "/";
    url.searchParams.sort();

    return url.toString();
  } catch {
    return null;
  }
}

export function normalizeDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
    ? value
    : null;
}

export function normalizeTime(value) {
  const match = String(value ?? "").trim().match(
    /^([01]?\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?$/
  );

  return match ? `${match[1].padStart(2, "0")}:${match[2]}` : null;
}

export function chileDateTime(value) {
  if (
    typeof value !== "string" ||
    !/(Z|[+-]\d{2}:\d{2})$/i.test(value)
  ) {
    return null;
  }

  const instant = new Date(value);
  if (Number.isNaN(instant.getTime())) return null;

  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/Santiago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(instant);

  const get = (type) => parts.find((part) => part.type === type)?.value;

  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    time: `${get("hour")}:${get("minute")}`,
  };
}

function santiagoOffsetMs(instantMs) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Santiago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(instantMs));
  const get = (type) => Number(parts.find((part) => part.type === type)?.value);
  const wallClockMs = Date.UTC(
    get("year"), get("month") - 1, get("day"),
    get("hour"), get("minute"), get("second")
  );
  return wallClockMs - Math.trunc(instantMs / 1000) * 1000;
}

export function santiagoEventInstant(dateValue, timeValue) {
  const date = normalizeDate(dateValue);
  const time = normalizeTime(timeValue);
  if (!date || !time) return null;

  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const localWallClock = Date.UTC(year, month - 1, day, hour, minute);
  let instant = localWallClock;

  // Resolve the IANA-zone offset iteratively so DST is interpreted using
  // America/Santiago rather than the runner's system timezone.
  for (let iteration = 0; iteration < 3; iteration += 1) {
    instant = localWallClock - santiagoOffsetMs(instant);
  }

  return new Date(instant);
}

export function normalizePrice(value) {
  if (value === null || value === undefined || value === "") return null;
  const price = Number(value);

  return Number.isSafeInteger(price) && price >= 0 && price <= 2147483647
    ? price
    : null;
}

export function eventIdentity(event) {
  const date = normalizeDate(event.event_date ?? event.date);
  const time = normalizeTime(event.event_time ?? event.time);
  const url = normalizeEventUrl(
    event.ticket_url ?? event.url ?? event.sourceUrl
  );

  if (!date || !time) return null;

  if (url) {
    return `url|${url}|${date}|${time}`;
  }

  const artist = normalizeText(event.comedian ?? event.name);
  const venue = normalizeText(event.venue ?? event.location);
  const show = normalizeText(event.show);

  if (!artist || !venue) return null;
  return `performance|${artist}|${show}|${venue}|${date}|${time}`;
}

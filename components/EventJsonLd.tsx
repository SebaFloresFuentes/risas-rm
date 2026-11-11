
import { supabase } from "@/lib/supabase";

type Props = {
  params: Promise<{ slug: string }>;
};

function getChileOffset(date: string, time: string) {
  const [hour, minute] = time.split(":").map(Number);

  const reference = new Date(
    `${date}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00Z`
  );

  const localHour = Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "America/Santiago",
      hour: "2-digit",
      hourCycle: "h23",
    }).format(reference)
  );

  const offsetHours = ((localHour - hour + 36) % 24) - 12;

  return `${offsetHours < 0 ? "-" : "+"}${String(Math.abs(offsetHours)).padStart(2, "0")}:00`;
}

export default async function EventJsonLd({ params }: Props) {
  const { slug } = await params;

  const { data: event, error } = await supabase
    .from("events")
    .select(
      "slug, comedian, show, event_date, event_time, venue, comuna"
    )
    .eq("slug", slug)
    .eq("verified", true)
    .maybeSingle();

  if (error || !event) return null;

  const time = event.event_time?.slice(0, 8);

  const eventData = {
    "@context": "https://schema.org",
    "@type": "Event",
    name: `${event.comedian} — ${event.show}`,
    performer: {
      "@type": "Person",
      name: event.comedian,
    },
    description:
      `${event.show}, espectáculo de ${event.comedian} ` +
      `en ${event.venue}, ${event.comuna}, Chile.`,
    url: `https://risas-rm.vercel.app/eventos/${event.slug}`,
    startDate: time
      ? `${event.event_date}T${time}${getChileOffset(event.event_date, time)}`
      :  event.event_date,
    eventAttendanceMode:
      "https://schema.org/OfflineEventAttendanceMode",
    location: {
      "@type": "Place",
      name: event.venue,
      address: {
        "@type": "PostalAddress",
        addressLocality: event.comuna,
        addressRegion: "Región Metropolitana",
        addressCountry: "CL",
      },
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(eventData).replace(/</g, "\\u003c"),
      }}
    />
  );
}

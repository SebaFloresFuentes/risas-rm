import { Suspense } from "react";
import EventJsonLd from "@/components/EventJsonLd";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { supabase } from "@/lib/supabase";

type Props = {
  children: ReactNode;
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({
  params,
}: Props): Promise<Metadata> {
  const { slug } = await params;

  const { data: event, error } = await supabase
    .from("events")
    .select(
      "comedian, show, event_date, venue, comuna, verified"
    )
    .eq("slug", slug)
    .eq("verified", true)
    .maybeSingle();

  if (error || !event) {
    return {
      title: "Evento no encontrado",
      robots: { index: false, follow: false },
    };
  }

  const date = new Intl.DateTimeFormat("es-CL", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "America/Santiago",
  }).format(new Date(`${event.event_date}T12:00:00-03:00`));

  const title = `${event.comedian} en ${event.comuna} | ${event.show}`;

  const description =
    `${event.comedian} presenta ${event.show} ` +
    `el ${date} en ${event.venue}, ${event.comuna}. ` +
    "Revisa la información de la función en Risas RM.";

  const canonical = `/eventos/${slug}`;

  return {
    title,
    description,
    alternates: {
      canonical,
    },
    openGraph: {
      title: `${title} | Risas RM`,
      description,
      url: canonical,
      type: "website",
      locale: "es_CL",
      siteName: "Risas RM",
    },
    twitter: {
      card: "summary",
      title: `${title} | Risas RM`,
      description,
    },
  };
}

export default function EventLayout({
  children,
  params,
}: Props) {
  return (
    <>
      <Suspense fallback={null}>
        <EventJsonLd params={params} />
      </Suspense>

      {children}
    </>
  );

}

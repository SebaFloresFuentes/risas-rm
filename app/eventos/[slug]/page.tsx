"use client";

import { use, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Event } from "@/types/event";

type PageProps = {
  params: Promise<{
    slug: string;
  }>;
};

type SupabaseEvent = {
  id: string;
  slug: string;
  comedian: string;
  show: string;
  event_date: string;
  event_time: string;
  venue: string;
  comuna: string;
  price_from: number | null;
  ticket_provider: string | null;
  ticket_url: string | null;
  image_url: string | null;
  featured: boolean;
  sold_out: boolean;
  verified: boolean;
};

function formatPrice(price: number | null) {
  if (price === null) return "Por confirmar";

  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(price);
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat("es-CL", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(`${date}T12:00:00`));
}

export default function EventPage({ params }: PageProps) {
  const { slug } = use(params);

  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    async function loadEvent() {
      const { data, error } = await supabase
        .from("events")
        .select("*")
        .eq("slug", slug)
        .eq("verified", true)
        .maybeSingle();

      if (error || !data) {
        console.error(error);
        setNotFound(true);
        setLoading(false);
        return;
      }

      const item = data as SupabaseEvent;

      setEvent({
        id: item.id,
        slug: item.slug,
        comedian: item.comedian,
        show: item.show,
        date: item.event_date,
        time: item.event_time.slice(0, 5),
        venue: item.venue,
        comuna: item.comuna,
        priceFrom: item.price_from,
        ticketProvider: item.ticket_provider,
        ticketUrl: item.ticket_url,
        imageUrl: item.image_url,
        featured: item.featured,
        soldOut: item.sold_out,
        verified: item.verified,
      });

      setLoading(false);
    }

    loadEvent();
  }, [slug]);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#0d0d15] text-zinc-500">
        Cargando show...
      </main>
    );
  }

  if (notFound || !event) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-[#0d0d15] px-6 text-center text-white">
        <div className="text-6xl">🎭</div>

        <h1 className="mt-6 text-3xl font-black">
          No encontramos este show
        </h1>

        <a
          href="/#cartelera"
          className="mt-8 rounded-xl bg-purple-400 px-6 py-3 font-black text-purple-950"
        >
          Volver a la cartelera
        </a>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#0d0d15] text-white">
      <header className="border-b border-white/10">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <a href="/" className="text-xl font-black tracking-tight">
            RISAS<span className="text-purple-400">RM.</span>
          </a>

          <a
            href="/#cartelera"
            className="text-sm font-semibold text-zinc-400 transition hover:text-white"
          >
            ← Volver a cartelera
          </a>
        </div>
      </header>

      <section className="mx-auto grid max-w-7xl gap-12 px-6 py-16 lg:grid-cols-[1.1fr_0.9fr] lg:py-24">
        <div>
          <p className="text-sm font-black uppercase tracking-[0.25em] text-purple-400">
            {event.venue} · {event.comuna}
          </p>

          <h1 className="mt-5 text-5xl font-black tracking-tight md:text-7xl">
            {event.comedian}
          </h1>

          <h2 className="mt-4 text-2xl font-bold text-zinc-400 md:text-3xl">
            {event.show}
          </h2>

          <div className="mt-10 space-y-5 border-t border-white/10 pt-8 text-lg">
            <p>
              📅{" "}
              <span className="capitalize">{formatDate(event.date)}</span>
            </p>

            <p>🕗 {event.time} hrs</p>

            <p>
              📍 {event.venue} · {event.comuna}
            </p>

            {event.ticketProvider && (
              <p>
                🎟️ Entradas vía{" "}
                <strong>{event.ticketProvider}</strong>
              </p>
            )}
          </div>
        </div>

        <aside className="h-fit rounded-3xl border border-white/10 bg-[#181720] p-8 lg:sticky lg:top-8">
          <p className="text-sm text-zinc-500">Entradas desde</p>

          <p className="mt-2 text-4xl font-black">
            {formatPrice(event.priceFrom)}
          </p>

          {event.ticketUrl && !event.soldOut ? (
            <a
              href={event.ticketUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-8 flex w-full items-center justify-center rounded-xl bg-purple-400 px-6 py-4 font-black text-purple-950 transition hover:bg-purple-300"
            >
              Comprar entradas →
            </a>
          ) : (
            <button
              disabled
              className="mt-8 w-full cursor-not-allowed rounded-xl bg-white/5 px-6 py-4 font-bold text-zinc-600"
            >
              {event.soldOut ? "Entradas agotadas" : "Entradas por confirmar"}
            </button>
          )}

          <p className="mt-5 text-center text-xs leading-5 text-zinc-600">
            La compra se realiza directamente en la ticketera oficial.
          </p>
        </aside>
      </section>
    </main>
  );
}
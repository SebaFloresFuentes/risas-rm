"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Event } from "@/types/event";

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

function mapEvent(item: SupabaseEvent): Event {
  return {
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
  };
}

function formatShortDate(date: string) {
  return new Intl.DateTimeFormat("es-CL", {
    day: "numeric",
    month: "short",
  })
    .format(new Date(`${date}T12:00:00`))
    .replace(".", "")
    .toUpperCase();
}

function formatPrice(price: number | null) {
  if (price === null) return "Precio por confirmar";

  return `Desde ${new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(price)}`;
}

export default function FeaturedEvents() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadFeaturedEvents() {
      const today = new Date().toLocaleDateString("en-CA", {
        timeZone: "America/Santiago",
      });

      const { data, error } = await supabase
        .from("events")
        .select("*")
        .eq("verified", true)
        .eq("featured", true)
        .gte("event_date", today)
        .order("event_date", { ascending: true })
        .order("event_time", { ascending: true })
        .limit(2);

      if (error) {
        console.error("Error cargando destacados:", error);
        setEvents([]);
        setLoading(false);
        return;
      }

      setEvents(((data ?? []) as SupabaseEvent[]).map(mapEvent));
      setLoading(false);
    }

    loadFeaturedEvents();
  }, []);

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2].map((item) => (
          <div
            key={item}
            className="h-[128px] animate-pulse rounded-2xl border border-white/10 bg-white/[0.035]"
          />
        ))}
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-6">
        <p className="font-bold text-zinc-300">
          Estamos preparando nuevos destacados.
        </p>

        <p className="mt-2 text-sm text-zinc-500">
          Revisa la cartelera para ver todas las próximas funciones.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {events.map((event) => (
        <a
          key={event.id}
          href={`/eventos/${event.slug}`}
          className="group block rounded-2xl border border-white/10 bg-white/[0.035] p-5 transition hover:border-purple-400/40 hover:bg-purple-400/[0.06]"
        >
          <div className="flex items-start justify-between gap-5">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 text-xs font-bold uppercase tracking-wider text-purple-400">
                <span>{formatShortDate(event.date)}</span>
                <span className="text-zinc-700">·</span>
                <span>{event.time}</span>
              </div>

              <h3 className="mt-2 truncate text-xl font-black text-white">
                {event.comedian}
              </h3>

              <p className="mt-1 truncate text-sm font-semibold text-zinc-300">
                {event.show}
              </p>

              <p className="mt-2 text-sm text-zinc-500">
                {event.venue} · {event.comuna}
              </p>
            </div>

            <span className="mt-1 text-xl text-zinc-600 transition group-hover:translate-x-1 group-hover:text-purple-400">
              →
            </span>
          </div>

          <div className="mt-4 border-t border-white/10 pt-4 text-sm font-bold text-zinc-300">
            {formatPrice(event.priceFrom)}
          </div>
        </a>
      ))}
    </div>
  );
}
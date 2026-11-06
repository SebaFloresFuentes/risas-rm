"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import EventCard from "@/components/EventCard";
import EventFilters from "@/components/EventFilters";
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

export default function EventsGrid() {
  const searchParams = useSearchParams();

  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState(
    searchParams.get("search") ?? ""
  );
  const [comuna, setComuna] = useState("");
  const [venue, setVenue] = useState(
    searchParams.get("venue") ?? ""
  );
  const [sort, setSort] = useState("date");

  useEffect(() => {
    async function loadEvents() {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from("events")
        .select("*")
        .eq("verified", true)
        .order("event_date", { ascending: true })
        .order("event_time", { ascending: true });

      if (error) {
        console.error(error);
        setError("No pudimos cargar la cartelera.");
        setLoading(false);
        return;
      }

      const mappedEvents: Event[] = ((data ?? []) as SupabaseEvent[]).map(
        (item) => ({
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
        })
      );

      setEvents(mappedEvents);
      setLoading(false);
    }

    loadEvents();
  }, []);

  const comunas = useMemo(
    () => [...new Set(events.map((event) => event.comuna))].sort(),
    [events]
  );

  const venues = useMemo(
    () => [...new Set(events.map((event) => event.venue))].sort(),
    [events]
  );

  const filteredEvents = useMemo(() => {
    const result = events.filter((event) => {
      const query = search.toLowerCase().trim();

      const matchesSearch =
        !query ||
        event.comedian.toLowerCase().includes(query) ||
        event.show.toLowerCase().includes(query) ||
        event.venue.toLowerCase().includes(query);

      return (
        matchesSearch &&
        (!comuna || event.comuna === comuna) &&
        (!venue || event.venue === venue)
      );
    });

    return [...result].sort((a, b) => {
      if (sort === "price") {
        return (a.priceFrom ?? Infinity) - (b.priceFrom ?? Infinity);
      }

      if (sort === "name") {
        return a.comedian.localeCompare(b.comedian, "es");
      }

      return (
        a.date.localeCompare(b.date) ||
        a.time.localeCompare(b.time)
      );
    });
  }, [events, search, comuna, venue, sort]);

  if (loading) {
    return (
      <div className="py-16 text-center text-zinc-500">
        Cargando cartelera...
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-8 text-center text-red-300">
        {error}
      </div>
    );
  }

  return (
    <>
      <EventFilters
        search={search}
        comuna={comuna}
        venue={venue}
        sort={sort}
        comunas={comunas}
        venues={venues}
        onSearchChange={setSearch}
        onComunaChange={setComuna}
        onVenueChange={setVenue}
        onSortChange={setSort}
      />

      <div className="mb-5 flex items-center justify-between">
        <p className="text-sm text-zinc-500">
          {filteredEvents.length}{" "}
          {filteredEvents.length === 1
            ? "show encontrado"
            : "shows encontrados"}
        </p>

        {(search || comuna || venue) && (
          <button
            onClick={() => {
              setSearch("");
              setComuna("");
              setVenue("");
            }}
            className="text-sm font-semibold text-purple-400 hover:text-purple-300"
          >
            Limpiar filtros
          </button>
        )}
      </div>

      {filteredEvents.length ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredEvents.map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </div>
      ) : (
        <div className="rounded-3xl border border-white/10 bg-white/[0.02] px-6 py-16 text-center">
          <div className="text-5xl">🎭</div>
          <h3 className="mt-5 text-xl font-bold">
            No encontramos shows
          </h3>
          <p className="mt-2 text-zinc-500">
            Prueba cambiando los filtros.
          </p>
        </div>
      )}
    </>
  );
}
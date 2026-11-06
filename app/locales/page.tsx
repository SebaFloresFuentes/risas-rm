import { supabase } from "@/lib/supabase";
import { connection } from "next/server";
import { Suspense } from "react";

type Venue = {
  name: string;
  comuna: string;
  events: number;
  nextDate: string;
};

function formatDate(date: string) {
  return new Intl.DateTimeFormat("es-CL", {
    day: "numeric",
    month: "short",
  }).format(new Date(`${date}T12:00:00`));
}

async function LocalesContent() {
    await connection();
    const { data, error } = await supabase
    .from("events")
    .select("venue, comuna, event_date")
    .eq("verified", true)
    .order("event_date", { ascending: true });

  if (error) {
    console.error(error);
  }

  const venueMap = new Map<string, Venue>();

  for (const event of data ?? []) {
    const key = `${event.venue}-${event.comuna}`;

    const existing = venueMap.get(key);

    if (existing) {
      existing.events += 1;
    } else {
      venueMap.set(key, {
        name: event.venue,
        comuna: event.comuna,
        events: 1,
        nextDate: event.event_date,
      });
    }
  }

  const venues = Array.from(venueMap.values()).sort((a, b) =>
    a.name.localeCompare(b.name, "es")
  );

  return (
    <main className="min-h-screen bg-[#0d0d15] text-white">
      {/* Header */}
      <header className="border-b border-white/10">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <a href="/" className="text-xl font-black tracking-tight">
            RISAS<span className="text-purple-400">RM.</span>
          </a>

          <nav className="flex items-center gap-6 text-sm font-semibold text-zinc-400">
            <a href="/#cartelera" className="transition hover:text-white">
              Cartelera
            </a>

            <a href="/locales" className="text-purple-400">
              Locales
            </a>

            <a href="/#nosotros" className="transition hover:text-white">
              Nosotros
            </a>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="border-b border-white/10 bg-gradient-to-b from-purple-950/30 to-transparent">
        <div className="mx-auto max-w-7xl px-6 py-20">
          <p className="text-sm font-black uppercase tracking-[0.25em] text-purple-400">
            Escenarios de la RM
          </p>

          <h1 className="mt-4 max-w-3xl text-5xl font-black tracking-tight md:text-6xl">
            Donde ocurre la
            <span className="text-purple-400"> comedia.</span>
          </h1>

          <p className="mt-6 max-w-2xl text-lg leading-8 text-zinc-400">
            Explora los bares, teatros y espacios que tienen próximos shows de
            comedia en la Región Metropolitana.
          </p>

          <div className="mt-8 flex items-center gap-3 text-sm text-zinc-500">
            <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2">
              📍 Región Metropolitana
            </span>

            <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2">
              🎭 {venues.length} {venues.length === 1 ? "local" : "locales"}
            </span>
          </div>
        </div>
      </section>

      {/* Locales */}
      <section className="mx-auto max-w-7xl px-6 py-16">
        <div className="mb-10">
          <p className="text-xs font-black uppercase tracking-[0.25em] text-purple-400">
            Explora por recinto
          </p>

          <h2 className="mt-3 text-3xl font-black tracking-tight">
            Locales con próximos shows
          </h2>
        </div>

        {venues.length > 0 ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {venues.map((venue) => (
              <article
                key={`${venue.name}-${venue.comuna}`}
                className="group overflow-hidden rounded-3xl border border-white/10 bg-[#181720] transition duration-300 hover:-translate-y-1 hover:border-purple-400/40"
              >
                {/* Visual */}
                <div className="relative flex h-44 items-center justify-center overflow-hidden bg-gradient-to-br from-purple-900 via-purple-950 to-black">
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,rgba(192,132,252,.25),transparent_50%)]" />

                  <span className="relative text-6xl transition duration-300 group-hover:scale-110">
                    🎭
                  </span>
                </div>

                {/* Información */}
                <div className="p-6">
                  <h3 className="text-2xl font-black tracking-tight">
                    {venue.name}
                  </h3>

                  <p className="mt-2 text-sm text-zinc-400">
                    📍 {venue.comuna}
                  </p>

                  <div className="mt-6 grid grid-cols-2 gap-3">
                    <div className="rounded-2xl bg-white/[0.04] p-4">
                      <p className="text-xs text-zinc-600">Próximos shows</p>

                      <p className="mt-1 text-xl font-black">
                        {venue.events}
                      </p>
                    </div>

                    <div className="rounded-2xl bg-white/[0.04] p-4">
                      <p className="text-xs text-zinc-600">Próxima fecha</p>

                      <p className="mt-1 text-sm font-bold">
                        {formatDate(venue.nextDate)}
                      </p>
                    </div>
                  </div>

                  <a
                    href={`/?venue=${encodeURIComponent(venue.name)}#cartelera`}
                    className="mt-6 flex w-full items-center justify-between rounded-xl border border-white/10 px-4 py-3 text-sm font-bold transition hover:border-purple-400/40 hover:bg-purple-400/10 hover:text-purple-300"
                  >
                    Ver cartelera
                    <span>→</span>
                  </a>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="rounded-3xl border border-white/10 bg-white/[0.02] px-6 py-16 text-center">
            <div className="text-5xl">🎭</div>

            <h3 className="mt-5 text-xl font-bold">
              Aún no tenemos locales disponibles
            </h3>

            <p className="mt-2 text-zinc-500">
              La cartelera se actualizará con nuevos recintos.
            </p>
          </div>
        )}
      </section>

      {/* AdSense futuro */}
      <section className="mx-auto max-w-7xl px-6 pb-16">
        <div className="flex min-h-28 items-center justify-center rounded-2xl border border-dashed border-white/10 bg-white/[0.02] text-xs uppercase tracking-[0.2em] text-zinc-700">
          Espacio publicitario
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-6 py-8 text-sm text-zinc-600 md:flex-row md:items-center md:justify-between">
          <p>© 2026 Risas RM</p>

          <p>Comedia y stand-up en la Región Metropolitana.</p>
        </div>
      </footer>
    </main>
  );
}
export default function LocalesPage() {
    return (
      <Suspense
        fallback={
          <main className="min-h-screen bg-[#0d0d15] text-white">
            <div className="mx-auto max-w-7xl px-6 py-20">
              <div className="py-20 text-center text-zinc-500">
                Cargando locales...
              </div>
            </div>
          </main>
        }
      >
        <LocalesContent />
      </Suspense>
    );
  }
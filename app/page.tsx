import { Suspense } from "react";
import EventsGrid from "@/components/EventsGrid";
import FeaturedEvents from "@/components/FeaturedEvents";


export default function Home() {
  return (
<main className="min-h-screen bg-[#0d0d15] text-white">
      {/* Navegación */}
   

      {/* Hero */}
    {/* Hero */}
<section className="relative overflow-hidden border-b border-white/10">
  {/* Iluminación de fondo */}
  <div className="pointer-events-none absolute inset-0">
    <div className="absolute -right-32 -top-40 h-[600px] w-[600px] rounded-full bg-purple-700/20 blur-[130px]" />
    <div className="absolute left-[20%] top-[45%] h-72 w-72 rounded-full bg-fuchsia-600/10 blur-[120px]" />
  </div>

  <div className="relative mx-auto grid max-w-7xl items-center gap-14 px-6 py-20 lg:min-h-[620px] lg:grid-cols-[1.05fr_0.95fr] lg:py-24">
    {/* Contenido principal */}
    <div>
      <div className="inline-flex items-center gap-2 rounded-full border border-purple-400/30 bg-purple-500/10 px-4 py-2 text-xs font-black tracking-[0.15em] text-purple-300">
        <span className="text-purple-400">✦</span>
        TU GUÍA DE COMEDIA EN SANTIAGO
      </div>

      <h1 className="mt-7 max-w-3xl text-5xl font-black leading-[0.98] tracking-[-0.055em] md:text-7xl">
        Encuentra tu próxima
        <span className="block text-purple-400">gran risa.</span>
      </h1>

      <p className="mt-7 max-w-xl text-lg leading-8 text-zinc-400">
        Stand-up, bares y noches de comedia en Santiago y toda la
        Región Metropolitana. Encuentra el show, revisa el precio y
        compra en la ticketera oficial.
      </p>

      {/* Búsqueda rápida */}
      <form
        action="/"
        className="mt-9 flex max-w-xl flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-2 sm:flex-row"
      >
        <div className="flex flex-1 items-center gap-3 px-3">
          <span className="text-zinc-500">⌕</span>

          <input
            type="search"
            name="search"
            placeholder="Comediante, local o comuna..."
            className="w-full bg-transparent py-3 text-sm text-white outline-none placeholder:text-zinc-600"
          />
        </div>

        <button
          type="submit"
          className="rounded-xl bg-purple-400 px-6 py-3 text-sm font-black text-purple-950 transition hover:bg-purple-300"
        >
          Buscar
        </button>
      </form>

      <div className="mt-6 flex flex-wrap gap-x-6 gap-y-3 text-sm text-zinc-500">
        <span>📍 Región Metropolitana</span>
        <span>🎟️ Entradas oficiales</span>
        <span>🔄 Actualización semanal</span>
      </div>
    </div>

    {/* Panel derecho */}
    <div className="relative">
      <div className="absolute -inset-10 bg-purple-600/10 blur-3xl" />

      <div className="relative overflow-hidden rounded-[32px] border border-purple-400/20 bg-[#15121e] p-6 shadow-2xl shadow-purple-950/30 md:p-8">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-purple-400">
              En cartelera
            </p>

            <h2 className="mt-2 text-2xl font-black">
              Shows destacados
            </h2>
          </div>

          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-purple-400/20 bg-purple-400/10 text-2xl">
            🎙️
          </div>
        </div>

        <div className="mt-7">
          <FeaturedEvents />
        </div>

        {/* Pie del panel */}
        <div className="mt-6 flex items-center justify-between border-t border-white/10 pt-6">
          <div>
            <p className="text-xs text-zinc-600">
              Cartelera
            </p>

            <p className="mt-1 text-sm font-bold text-zinc-300">
              Santiago · RM
            </p>
          </div>

          <a
            href="/#cartelera"
            className="text-sm font-black text-purple-400 transition hover:text-purple-300"
          >
            Ver todos →
          </a>
        </div>
      </div>
    </div>
  </div>

  {/* Accesos rápidos */}
  <div className="relative border-t border-white/10 bg-white/[0.015]">
    <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-8 gap-y-4 px-6 py-5">
      <span className="text-xs font-black uppercase tracking-[0.15em] text-zinc-600">
        Descubre
      </span>

      <a
        href="/#cartelera"
        className="text-sm font-semibold text-zinc-400 transition hover:text-purple-400"
      >
        Esta semana
      </a>

      <a
        href="/#cartelera"
        className="text-sm font-semibold text-zinc-400 transition hover:text-purple-400"
      >
        Próximos shows
      </a>

      <a
        href="/locales"
        className="text-sm font-semibold text-zinc-400 transition hover:text-purple-400"
      >
        Locales
      </a>

      <a
        href="/#cartelera"
        className="text-sm font-semibold text-zinc-400 transition hover:text-purple-400"
      >
        Ver cartelera completa →
      </a>
    </div>
  </div>
</section>

      {/* Cartelera */}
      <section id="cartelera" className="mx-auto max-w-7xl px-6 py-20">
        <div className="mb-10">
          <span className="rounded-full border border-purple-400/30 bg-purple-500/10 px-4 py-2 text-xs font-bold text-purple-300">
            ENCUENTRA TU PANORAMA
          </span>

          <h2 className="mt-6 text-4xl font-black tracking-tight">
            Próximos shows
          </h2>

          <p className="mt-3 text-zinc-400">
            Comedia y stand-up en distintos rincones de Santiago.
          </p>
        </div>

        {/* Filtros */}
        <div className="mb-10">
          
        </div>


        {/* Aquí pondremos los eventos */}
        <Suspense
        fallback={
          <div className="py-16 text-center text-zinc-500">
            Cargando cartelera...
          </div>
        }
>
  <EventsGrid />
</Suspense>
      </section>

      {/* Publicidad */}
      <section className="mx-auto max-w-7xl px-6 pb-20">
        <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.02] p-8 text-center">
          <p className="text-xs font-bold tracking-[0.2em] text-zinc-600">
            PUBLICIDAD
          </p>

          <p className="mt-3 text-sm text-zinc-500">
            Espacio preparado para Google AdSense
          </p>
        </div>
      </section>

      {/* Footer */}
     
    </main>
  );
}
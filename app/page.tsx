import EventsGrid from "@/components/EventsGrid";

export default function Home() {
  return (
<main className="min-h-screen bg-[#0d0d15] text-white">
      {/* Navegación */}
      <header className="sticky top-0 z-50 border-b border-white/10 bg-[#0d0d15]/90 backdrop-blur-xl">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-6">
          <a href="#" className="text-2xl font-black tracking-tight">
            RISAS<span className="text-purple-400">RM.</span>
          </a>

          <nav className="hidden gap-8 text-sm text-zinc-300 md:flex">
            <a href="#cartelera" className="hover:text-white">
              Cartelera
            </a>
            <a href="#locales" className="hover:text-white">
              Locales
            </a>
            <a href="#nosotros" className="hover:text-white">
              Nosotros
            </a>
          </nav>

          <a
            href="#cartelera"
            className="rounded-xl bg-purple-400 px-5 py-3 text-sm font-bold text-purple-950 transition hover:bg-purple-300"
          >
            Explorar shows
          </a>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-white/10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_75%_30%,rgba(126,34,206,.35),transparent_35%)]" />

        <div className="relative mx-auto grid min-h-[650px] max-w-7xl items-center gap-12 px-6 py-20 lg:grid-cols-2">
          <div>
            <div className="mb-6 inline-flex rounded-full border border-purple-400/30 bg-purple-500/10 px-4 py-2 text-xs font-bold tracking-wider text-purple-300">
              ✦ TU GUÍA DE COMEDIA EN SANTIAGO
            </div>

            <h1 className="max-w-3xl text-5xl font-black leading-[1.05] tracking-[-0.05em] md:text-7xl">
              La próxima gran{" "}
              <span className="text-purple-400">risa</span> está aquí.
            </h1>

            <p className="mt-7 max-w-xl text-lg leading-8 text-zinc-400">
              Descubre stand-up, improvisación y noches de comedia en Santiago
              y toda la Región Metropolitana.
            </p>

            <div className="mt-9 flex flex-wrap gap-4">
              <a
                href="#cartelera"
                className="rounded-xl bg-purple-400 px-6 py-4 font-bold text-purple-950 transition hover:bg-purple-300"
              >
                Ver cartelera →
              </a>

              <a
                href="#locales"
                className="rounded-xl border border-white/15 bg-white/5 px-6 py-4 font-bold transition hover:bg-white/10"
              >
                Explorar locales
              </a>
            </div>

            <div className="mt-8 flex flex-wrap gap-5 text-sm text-zinc-500">
              <span>📍 Región Metropolitana</span>
              <span>🎟️ Entradas oficiales</span>
              <span>🔄 Actualización semanal</span>
            </div>
          </div>

          {/* Escenario */}
          <div className="relative hidden h-[430px] overflow-hidden rounded-[32px] border border-purple-400/30 bg-gradient-to-br from-purple-950 via-[#191125] to-black shadow-2xl lg:flex lg:items-center lg:justify-center">
            <div className="absolute -top-20 h-[450px] w-[250px] rotate-12 bg-gradient-to-b from-purple-300/30 to-transparent blur-xl" />

            <div className="relative text-[150px] drop-shadow-2xl">
              🎙️
            </div>

            <div className="absolute bottom-0 h-16 w-full bg-gradient-to-t from-black to-transparent" />

            <div className="absolute bottom-7 left-7 rounded-xl border border-white/10 bg-black/50 px-4 py-3 text-sm backdrop-blur">
              ✨ Una noche. Muchas carcajadas.
            </div>
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
        <EventsGrid />
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
      <footer className="border-t border-white/10">
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-4 px-6 py-10 text-sm text-zinc-500 md:flex-row">
          <span>© 2026 Risas RM</span>
          <span>La comedia de Santiago, en un solo lugar. ✦</span>
        </div>
      </footer>
    </main>
  );
}
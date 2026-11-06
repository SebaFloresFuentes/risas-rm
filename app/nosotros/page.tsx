import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Nosotros",
  description:
    "Conoce Risas RM, una cartelera independiente para descubrir stand-up y comedia en Santiago y la Región Metropolitana.",
};

export default function NosotrosPage() {
  return (
    <main className="min-h-screen bg-[#0d0d15] text-white">
      <header className="border-b border-white/10">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
          <a href="/" className="text-xl font-black tracking-tight">
            RISAS<span className="text-purple-400">RM.</span>
          </a>

          <a
            href="/"
            className="text-sm font-semibold text-zinc-400 transition hover:text-white"
          >
            ← Volver al inicio
          </a>
        </div>
      </header>

      <section className="mx-auto max-w-3xl px-6 py-16 md:py-24">
        <p className="text-sm font-black uppercase tracking-[0.25em] text-purple-400">
          Sobre el proyecto
        </p>

        <h1 className="mt-5 text-4xl font-black tracking-tight md:text-6xl">
          La comedia de Santiago,
          <span className="text-purple-400"> en un solo lugar.</span>
        </h1>

        <div className="mt-10 space-y-6 text-lg leading-8 text-zinc-400">
          <p>
            Risas RM es una cartelera independiente creada para facilitar el
            descubrimiento de shows de stand-up y comedia en Santiago y la
            Región Metropolitana.
          </p>

          <p>
            Reunimos información sobre funciones, comediantes, locales,
            fechas, horarios, precios y plataformas de venta de entradas para
            que puedas encontrar más fácilmente qué ver y dónde.
          </p>

          <p>
            Risas RM no es una ticketera. Cuando un evento dispone de venta
            online, te dirigimos a la plataforma correspondiente para realizar
            la compra.
          </p>
        </div>

        <div className="mt-12 rounded-3xl border border-purple-400/20 bg-purple-400/5 p-8">
          <h2 className="text-2xl font-black">
            🎭 Nuestra idea
          </h2>

          <p className="mt-4 leading-7 text-zinc-400">
            Queremos que descubrir un panorama de comedia sea tan sencillo
            como abrir Risas RM, revisar qué se presenta cerca de ti y elegir
            tu próximo show.
          </p>
        </div>
      </section>
    </main>
  );
}
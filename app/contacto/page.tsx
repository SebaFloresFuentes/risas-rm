import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Contacto",
  description:
    "Información de contacto para comediantes, productores, locales y usuarios de Risas RM.",
};

export default function ContactoPage() {
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
          Contacto
        </p>

        <h1 className="mt-5 text-4xl font-black tracking-tight md:text-6xl">
          Hablemos de
          <span className="text-purple-400"> comedia.</span>
        </h1>

        <p className="mt-8 text-lg leading-8 text-zinc-400">
          Si eres comediante, productor, representante de un local o quieres
          informarnos sobre una función que debería aparecer en Risas RM,
          podrás contactarnos desde aquí.
        </p>

        <div className="mt-12 rounded-3xl border border-white/10 bg-[#181720] p-8">
          <h2 className="text-xl font-black">
            Publicar o corregir un evento
          </h2>

          <p className="mt-4 leading-7 text-zinc-400">
            Próximamente habilitaremos nuestro canal oficial de contacto para
            recibir nuevas funciones, correcciones y consultas.
          </p>
        </div>

        <div className="mt-6 rounded-3xl border border-white/10 bg-[#181720] p-8">
          <h2 className="text-xl font-black">
            Productores y locales
          </h2>

          <p className="mt-4 leading-7 text-zinc-400">
            Risas RM también contempla espacios destacados para promocionar
            funciones y ayudar a que nuevos públicos descubran la cartelera
            de comedia de la Región Metropolitana.
          </p>
        </div>
      </section>
    </main>
  );
}
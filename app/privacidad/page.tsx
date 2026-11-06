import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Política de privacidad",
  description: "Política de privacidad de Risas RM.",
};

export default function PrivacidadPage() {
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

      <article className="mx-auto max-w-3xl px-6 py-16 md:py-24">
        <p className="text-sm font-black uppercase tracking-[0.25em] text-purple-400">
          Risas RM
        </p>

        <h1 className="mt-5 text-4xl font-black tracking-tight md:text-5xl">
          Política de privacidad
        </h1>

        <p className="mt-4 text-sm text-zinc-500">
          Última actualización: noviembre de 2026
        </p>

        <div className="mt-12 space-y-10 leading-7 text-zinc-400">
          <section>
            <h2 className="text-xl font-black text-white">
              Información general
            </h2>
            <p className="mt-3">
              Risas RM es una plataforma informativa dedicada a recopilar y
              organizar información sobre shows de comedia y stand-up en
              Santiago y la Región Metropolitana.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-black text-white">
              Información personal
            </h2>
            <p className="mt-3">
              Risas RM no solicita actualmente la creación de cuentas ni el
              ingreso de información personal para consultar la cartelera.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-black text-white">
              Enlaces externos
            </h2>
            <p className="mt-3">
              El sitio puede contener enlaces a plataformas externas,
              incluyendo ticketeras y sitios relacionados con los eventos.
              Al visitar esos servicios se aplican sus propias políticas de
              privacidad y condiciones de uso.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-black text-white">
              Cookies y servicios de terceros
            </h2>
            <p className="mt-3">
              Si en el futuro incorporamos herramientas de analítica,
              publicidad u otros servicios que utilicen cookies o tecnologías
              similares, esta política será actualizada para informar sobre
              su utilización.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-black text-white">
              Cambios en esta política
            </h2>
            <p className="mt-3">
              Esta política puede modificarse cuando Risas RM incorpore nuevas
              funciones o servicios. La fecha de la última actualización se
              mantendrá publicada en esta página.
            </p>
          </section>
        </div>
      </article>
    </main>
  );
}
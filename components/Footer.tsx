export default function Footer() {
    return (
      <footer className="mt-auto border-t border-white/10 bg-[#0d0d15]">
        <div className="mx-auto max-w-7xl px-6 py-12">
          <div className="grid gap-10 md:grid-cols-3">
            <div>
              <a href="/" className="text-xl font-black tracking-tight text-white">
                RISAS<span className="text-purple-400">RM.</span>
              </a>
  
              <p className="mt-4 max-w-sm text-sm leading-6 text-zinc-500">
                Tu guía para descubrir stand-up y comedia en Santiago y la
                Región Metropolitana.
              </p>
            </div>
  
            <div>
              <p className="text-sm font-bold text-white">
                Explorar
              </p>
  
              <div className="mt-4 flex flex-col gap-3 text-sm text-zinc-500">
                <a
                  href="/#cartelera"
                  className="transition hover:text-purple-400"
                >
                  Cartelera
                </a>
  
                <a
                  href="/locales"
                  className="transition hover:text-purple-400"
                >
                  Locales
                </a>
  
                <a
                  href="/nosotros"
                  className="transition hover:text-purple-400"
                >
                  Nosotros
                </a>
              </div>
            </div>
  
            <div>
              <p className="text-sm font-bold text-white">
                Risas RM
              </p>
  
              <div className="mt-4 flex flex-col gap-3 text-sm text-zinc-500">
                <a
                  href="/contacto"
                  className="transition hover:text-purple-400"
                >
                  Contacto
                </a>
  
                <a
                  href="/privacidad"
                  className="transition hover:text-purple-400"
                >
                  Política de privacidad
                </a>
              </div>
            </div>
          </div>
  
          <div className="mt-12 flex flex-col gap-3 border-t border-white/10 pt-8 text-xs text-zinc-600 md:flex-row md:items-center md:justify-between">
            <p>© 2026 Risas RM. Todos los derechos reservados.</p>
  
            <p>
              La comedia de Santiago, en un solo lugar. ✦
            </p>
          </div>
        </div>
      </footer>
    );
  }
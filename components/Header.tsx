export default function Header() {
    return (
      <header className="sticky top-0 z-50 border-b border-white/10 bg-[#0d0d15]/90 backdrop-blur-xl">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-6">
          <a href="/" className="text-2xl font-black tracking-tight">
            RISAS<span className="text-purple-400">RM.</span>
          </a>
  
          <nav className="hidden items-center gap-8 text-sm text-zinc-300 md:flex">
            <a
              href="/#cartelera"
              className="transition hover:text-white"
            >
              Cartelera
            </a>
  
            <a
              href="/locales"
              className="transition hover:text-white"
            >
              Locales
            </a>
  
            <a
              href="/nosotros"
              className="transition hover:text-white"
            >
              Nosotros
            </a>
  
            <a
              href="/contacto"
              className="transition hover:text-white"
            >
              Contacto
            </a>
          </nav>
  
          <a
            href="/#cartelera"
            className="rounded-xl bg-purple-400 px-5 py-3 text-sm font-bold text-purple-950 transition hover:bg-purple-300"
          >
            Explorar shows
          </a>
        </div>
      </header>
    );
  }
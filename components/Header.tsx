import BrandLogo from "@/components/BrandLogo";
import Link from "next/link";

export default function Header() {
    return (
      <header className="sticky top-0 z-50 border-b border-white/10 bg-[#0d0d15]/90 backdrop-blur-xl">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
          <Link href="/" aria-label="RadarRisas, inicio" className="text-lg sm:text-2xl font-black tracking-tight">
            <BrandLogo />
          </Link>
  
          <nav className="hidden items-center gap-8 text-sm text-zinc-300 md:flex">
            <Link
              href="/#cartelera"
              className="transition hover:text-white"
            >
              Cartelera
            </Link>
  
            <Link
              href="/locales"
              className="transition hover:text-white"
            >
              Locales
            </Link>
  
            <Link
              href="/nosotros"
              className="transition hover:text-white"
            >
              Nosotros
            </Link>
  
            <Link
              href="/contacto"
              className="transition hover:text-white"
            >
              Contacto
            </Link>
          </nav>
  
          <Link
            href="/#cartelera"
            className="rounded-xl bg-purple-400 px-3 py-3 text-xs sm:px-5 sm:text-sm font-bold text-purple-950 transition hover:bg-purple-300"
          >
            Explorar shows
          </Link>
        </div>
      </header>
    );
  }

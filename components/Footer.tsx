import BrandLogo from "@/components/BrandLogo";
import Link from "next/link";

export default function Footer() {
    return (
      <footer className="mt-auto border-t border-white/10 bg-[#0d0d15]">
        <div className="mx-auto max-w-7xl px-6 py-12">
          <div className="grid gap-10 md:grid-cols-3">
            <div>
              <Link href="/" className="text-xl font-black tracking-tight text-white">
                <BrandLogo />
              </Link>
  
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
                <Link
                  href="/#cartelera"
                  className="transition hover:text-purple-400"
                >
                  Cartelera
                </Link>
  
                <Link
                  href="/locales"
                  className="transition hover:text-purple-400"
                >
                  Locales
                </Link>
  
                <Link
                  href="/nosotros"
                  className="transition hover:text-purple-400"
                >
                  Nosotros
                </Link>
              </div>
            </div>
  
            <div>
              <p className="text-sm font-bold text-white">
                RadarRisas
              </p>
  
              <div className="mt-4 flex flex-col gap-3 text-sm text-zinc-500">
                <Link
                  href="/contacto"
                  className="transition hover:text-purple-400"
                >
                  Contacto
                </Link>
  
                <Link
                  href="/privacidad"
                  className="transition hover:text-purple-400"
                >
                  Política de privacidad
                </Link>
              </div>
            </div>
          </div>
  
          <div className="mt-12 flex flex-col gap-3 border-t border-white/10 pt-8 text-xs text-zinc-600 md:flex-row md:items-center md:justify-between">
            <p>© 2026 RadarRisas. Todos los derechos reservados.</p>
  
            <p>
              La comedia, en tu radar. ✦
            </p>
          </div>
        </div>
      </footer>
    );
  }

import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Risas RM | Stand-up y comedia en Santiago",
    template: "%s | Risas RM",
  },

  description:
    "Descubre shows de stand-up y comedia en Santiago y la Región Metropolitana. Revisa fechas, locales, precios y dónde comprar entradas.",

  keywords: [
    "stand up Santiago",
    "stand up Chile",
    "comedia Santiago",
    "comedia Chile",
    "shows de comedia",
    "humor Santiago",
    "humoristas chilenos",
    "comediante Santiago",
    "cartelera stand up",
    "eventos Santiago",
    "Risas RM",
  ],

  authors: [{ name: "Risas RM" }],
  creator: "Risas RM",
  publisher: "Risas RM",
  category: "entertainment",

  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },

  openGraph: {
    type: "website",
    locale: "es_CL",
    siteName: "Risas RM",
    title: "Risas RM | Stand-up y comedia en Santiago",
    description:
      "Encuentra shows de stand-up y comedia en Santiago y la Región Metropolitana. Fechas, locales, precios y entradas.",
  },

  twitter: {
    card: "summary_large_image",
    title: "Risas RM | Stand-up y comedia en Santiago",
    description:
      "Encuentra shows de stand-up y comedia en Santiago y la Región Metropolitana.",
  },

  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es-CL"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-[#0d0d15] text-white">
        <div className="flex min-h-screen flex-col">
          <Header />

          <div className="flex-1">
            {children}
          </div>

          <Footer />
        </div>
      </body>
    </html>
  );
}
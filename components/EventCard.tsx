import type { Event } from "@/types/event";

type EventCardProps = {
  event: Event;
};

function formatPrice(price: number | null) {
  if (price === null) return "Por confirmar";

  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(price);
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat("es-CL", {
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(new Date(`${date}T12:00:00`));
}

export default function EventCard({ event }: EventCardProps) {
  return (
    <article className="group overflow-hidden rounded-3xl border border-white/10 bg-[#181720] transition duration-300 hover:-translate-y-1 hover:border-purple-400/40">
      
      {/* Imagen / visual */}
      <div className="relative flex h-56 items-center justify-center overflow-hidden bg-gradient-to-br from-purple-900 via-purple-950 to-black">
        
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,rgba(192,132,252,.30),transparent_45%)]" />

        <span className="relative text-7xl transition duration-300 group-hover:scale-110">
          🎙️
        </span>

        {/* Tipo de show */}
        <span className="absolute left-4 top-4 rounded-full border border-white/15 bg-black/50 px-3 py-2 text-xs font-semibold backdrop-blur">
          {event.show}
        </span>

        {/* Estado */}
        {event.soldOut && (
          <span className="absolute right-4 top-4 rounded-full bg-red-500 px-3 py-2 text-xs font-bold text-white">
            AGOTADO
          </span>
        )}

        {!event.verified && (
          <span className="absolute bottom-4 right-4 rounded-lg border border-amber-400/20 bg-amber-500/10 px-3 py-2 text-[10px] font-bold text-amber-300">
            DEMO
          </span>
        )}
      </div>

      {/* Información */}
      <div className="p-6">
        <h3 className="text-2xl font-black tracking-tight text-white">
          {event.comedian}
        </h3>

        <div className="mt-5 space-y-3 text-sm text-zinc-400">
          <p className="flex gap-3">
            <span>📅</span>
            <span>
              {formatDate(event.date)} · {event.time} hrs
            </span>
          </p>

          <p className="flex gap-3">
            <span>📍</span>
            <span>
              {event.venue}
              <span className="text-zinc-600"> · </span>
              {event.comuna}
            </span>
          </p>
        </div>

        {/* Precio + botón */}
        <div className="mt-6 flex items-end justify-between gap-4 border-t border-white/10 pt-5">
          <div>
            <p className="text-xs text-zinc-600">Desde</p>

            <p className="mt-1 text-xl font-black">
              {formatPrice(event.priceFrom)}
            </p>
          </div>

          {event.ticketUrl && !event.soldOut ? (
            <a
              href={event.ticketUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-xl bg-purple-400 px-4 py-3 text-sm font-bold text-purple-950 transition hover:bg-purple-300"
            >
              Ver entradas →
            </a>
          ) : (
            <button
              disabled
              className="cursor-not-allowed rounded-xl bg-white/5 px-4 py-3 text-sm font-bold text-zinc-600"
            >
              {event.soldOut ? "Agotado" : "Entradas próximamente"}
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
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
    <article
      className={`group relative overflow-hidden rounded-3xl border bg-[#181720]
        transition duration-300 hover:-translate-y-1
        ${
          event.featured
            ? "border-purple-400/40 shadow-[0_0_40px_rgba(168,85,247,0.12)]"
            : "border-white/10 hover:border-purple-400/30"
        }
      `}
    >
      {/* Imagen / portada */}
      <div className="relative flex h-56 items-center justify-center overflow-hidden bg-gradient-to-br from-purple-900 via-purple-950 to-black">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,rgba(192,132,252,.30),transparent_45%)]" />

        {event.imageUrl ? (
          <img
            src={event.imageUrl}
            alt={`${event.comedian} - ${event.show}`}
            className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-105"
          />
        ) : (
          <span className="relative text-7xl transition duration-300 group-hover:scale-110">
            🎙️
          </span>
        )}

        {/* Oscurecimiento para imágenes */}
        {event.imageUrl && (
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-black/20" />
        )}

        {/* Show */}
        <span className="absolute left-4 top-4 max-w-[70%] rounded-full border border-white/15 bg-black/60 px-3 py-2 text-xs font-semibold text-white backdrop-blur">
          {event.show}
        </span>

        {/* Destacado */}
        {event.featured && !event.soldOut && (
          <span className="absolute right-4 top-4 rounded-full bg-purple-400 px-3 py-2 text-[10px] font-black tracking-wide text-purple-950">
            DESTACADO
          </span>
        )}

        {/* Agotado */}
        {event.soldOut && (
          <span className="absolute right-4 top-4 rounded-full bg-red-500 px-3 py-2 text-[10px] font-black tracking-wide text-white">
            AGOTADO
          </span>
        )}
      </div>

      {/* Información */}
      <div className="p-6">
        <h3 className="text-2xl font-black tracking-tight text-white">
          {event.comedian}
        </h3>

        <div className="mt-5 space-y-3 text-sm text-zinc-400">
          <p className="flex items-start gap-3">
            <span>📅</span>
            <span>
              {formatDate(event.date)} · {event.time} hrs
            </span>
          </p>

          <p className="flex items-start gap-3">
            <span>📍</span>
            <span>
              {event.venue}
              <span className="text-zinc-600"> · </span>
              {event.comuna}
            </span>
          </p>

          {event.ticketProvider && (
            <p className="flex items-start gap-3">
              <span>🎟️</span>
              <span>
                Entradas vía{" "}
                <strong className="font-semibold text-zinc-300">
                  {event.ticketProvider}
                </strong>
              </span>
            </p>
          )}
        </div>

        {/* Precio + CTA */}
        <div className="mt-6 flex items-end justify-between gap-4 border-t border-white/10 pt-5">
          <div>
            <p className="text-xs text-zinc-600">Entradas desde</p>

            <p className="mt-1 text-xl font-black text-white">
              {formatPrice(event.priceFrom)}
            </p>
          </div>

          {event.ticketUrl && !event.soldOut ? (
            <a
              href={event.ticketUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-xl bg-purple-400 px-5 py-3 text-sm font-black text-purple-950 transition hover:bg-purple-300"
            >
              Comprar →
            </a>
          ) : (
            <button
              disabled
              className="cursor-not-allowed rounded-xl bg-white/5 px-5 py-3 text-sm font-bold text-zinc-600"
            >
              {event.soldOut ? "Agotado" : "Próximamente"}
            </button>
          )}
        </div>
      </div>

      {/* Borde inferior de eventos destacados */}
      {event.featured && (
        <div className="absolute inset-x-0 bottom-0 h-[2px] bg-gradient-to-r from-transparent via-purple-400 to-transparent" />
      )}
    </article>
  );
}
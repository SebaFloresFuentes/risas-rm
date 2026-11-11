
"use client";

import { useActionState, useState } from "react";
import type { FormEvent } from "react";

import {
  publishCandidate,
  type PublishState,
} from "@/app/admin/actions";

type PublishButtonProps = {
  candidateId: string;
  comedian: string | null;
  show: string | null;
  eventDate: string | null;
  eventTime: string | null;
  venue: string | null;
  comuna: string | null;
  sourceUrl: string | null;
  ticketUrl: string | null;
};

const initialState: PublishState = {
  success: false,
  message: "",
};

export default function PublishButton({
  candidateId,
  comedian,
  show,
  eventDate,
  eventTime,
  venue,
  comuna,
  sourceUrl,
  ticketUrl,
}: PublishButtonProps) {
  const [state, formAction, pending] = useActionState(
    publishCandidate,
    initialState
  );

  const [showConfirmation, setShowConfirmation] = useState(false);
  const [verified, setVerified] = useState(false);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    if (!verified) {
      event.preventDefault();
      return;
    }

    const confirmed = window.confirm(
      "¿Confirmas que verificaste este espectáculo y quieres publicarlo en Risas RM?"
    );

    if (!confirmed) {
      event.preventDefault();
    }
  }

  return (
    <div className="w-full">
      <button
        type="button"
        onClick={() => setShowConfirmation((value) => !value)}
        className="rounded-xl bg-purple-400 px-5 py-2 text-sm font-black text-purple-950 transition hover:bg-purple-300"
      >
        {showConfirmation
          ? "Ocultar confirmación"
          : "Aprobar y publicar"}
      </button>

      {showConfirmation && (
        <div className="mt-5 rounded-2xl border border-purple-400/30 bg-purple-400/[0.05] p-5">
          <h4 className="text-lg font-bold text-white">
            Confirmar publicación
          </h4>

          <p className="mt-2 text-sm text-zinc-400">
            Revisa cuidadosamente la información antes de
            agregar este espectáculo a la cartelera pública.
          </p>

          <dl className="mt-5 space-y-3 text-sm">
            {[
              ["Comediante", comedian],
              ["Espectáculo", show],
              ["Fecha", eventDate],
              ["Hora", eventTime?.slice(0, 5)],
              ["Recinto", venue],
              ["Comuna", comuna],
            ].map(([label, value]) => (
              <div
                key={label}
                className="flex flex-wrap justify-between gap-2 border-b border-white/10 pb-2"
              >
                <dt className="text-zinc-500">{label}</dt>
                <dd className="font-semibold text-white">
                  {value || "Sin confirmar"}
                </dd>
              </div>
            ))}
          </dl>

          <div className="mt-5 space-y-3 text-sm">
            <div>
              <p className="text-zinc-500">
                Fuente de información
              </p>
              {sourceUrl ? (
                <a
                  href={sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="break-all text-purple-300 underline"
                >
                  Revisar fuente ↗
                </a>
              ) : (
                <p className="text-red-400">
                  Sin fuente registrada
                </p>
              )}
            </div>

            <div>
              <p className="text-zinc-500">
                Venta de entradas
              </p>
              {ticketUrl ? (
                <a
                  href={ticketUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="break-all text-purple-300 underline"
                >
                  Revisar venta ↗
                </a>
              ) : (
                <p className="text-red-400">
                  Sin enlace de entradas
                </p>
              )}
            </div>
          </div>

          <form
            action={formAction}
            onSubmit={handleSubmit}
            className="mt-6"
          >
            <input
              type="hidden"
              name="id"
              value={candidateId}
            />

            <input
              type="hidden"
              name="confirmed"
              value={verified ? "yes" : "no"}
            />

            <label className="flex cursor-pointer items-start gap-3 text-sm text-zinc-300">
              <input
                type="checkbox"
                checked={verified}
                onChange={(event) =>
                  setVerified(event.target.checked)
                }
                className="mt-1 h-4 w-4 accent-purple-400"
              />

              <span>
                Confirmo que revisé la información,
                comprobé la fuente y verifiqué
                el enlace de entradas de este espectáculo.
              </span>
            </label>

            <button
              type="submit"
              disabled={!verified || pending || state.success}
              className="mt-5 rounded-xl bg-purple-400 px-6 py-3 text-sm font-black text-purple-950 transition hover:bg-purple-300 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {pending
                ? "Publicando..."
                : state.success
                  ? "Publicado"
                  : "Confirmar publicación"}
            </button>
          </form>
        </div>
      )}

      {state.message && (
        <p
          role="status"
          aria-live="polite"
          className={`mt-3 text-sm ${
            state.success ? "text-green-400" : "text-red-400"
          }`}
        >
          {state.message}
        </p>
      )}
    </div>
  );
}

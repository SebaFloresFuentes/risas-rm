
"use client";

import { useActionState, useState } from "react";
import {
  createCandidate,
  type CreateCandidateState,
} from "@/app/admin/actions";

const initialState: CreateCandidateState = {
  success: false,
  message: "",
};

const inputClass =
  "mt-2 w-full rounded-xl border border-white/10 " +
  "bg-[#0d0d15] px-4 py-3 text-white " +
  "outline-none focus:border-purple-400";

export default function CreateCandidateForm() {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(
    createCandidate,
    initialState
  );

  return (
    <section className="mt-8 rounded-3xl border border-white/10 bg-[#181720] p-7">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">
            Nuevo espectáculo
          </h2>
          <p className="mt-2 text-sm text-zinc-400">
            Registra una función para revisarla antes de publicarla.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="rounded-xl bg-purple-400 px-5 py-3 text-sm font-bold text-purple-950 hover:bg-purple-300"
        >
          {open ? "Cerrar formulario" : "+ Agregar espectáculo"}
        </button>
      </div>

      {open && (
        <form
          action={formAction}
          className="mt-7 grid gap-5 border-t border-white/10 pt-7 md:grid-cols-2"
        >
          <label className="text-sm text-zinc-300">
            Comediante *
            <input name="comedian" required maxLength={200} className={inputClass} />
          </label>

          <label className="text-sm text-zinc-300">
            Nombre del show *
            <input name="show" required maxLength={200} className={inputClass} />
          </label>

          <label className="text-sm text-zinc-300">
            Fecha *
            <input name="event_date" type="date" required className={inputClass} />
          </label>

          <label className="text-sm text-zinc-300">
            Hora *
            <input name="event_time" type="time" required className={inputClass} />
          </label>

          <label className="text-sm text-zinc-300">
            Recinto *
            <input name="venue" required maxLength={200} className={inputClass} />
          </label>

          <label className="text-sm text-zinc-300">
            Comuna *
            <input name="comuna" required maxLength={120} className={inputClass} />
          </label>

          <label className="text-sm text-zinc-300 md:col-span-2">
            Dirección del recinto
            <input name="venue_address" className={inputClass} />
          </label>

          <label className="text-sm text-zinc-300">
            Precio desde (CLP)
            <input
              name="price_from"
              type="number"
              min="0"
              step="1"
              className={inputClass}
            />
          </label>

          <label className="text-sm text-zinc-300">
            Ticketera
            <input
              name="ticket_provider"
              placeholder="Ej.: Ticketplus"
              className={inputClass}
            />
          </label>

          <label className="text-sm text-zinc-300 md:col-span-2">
            Enlace de compra
            <input
              name="ticket_url"
              type="url"
              placeholder="https://..."
              className={inputClass}
            />
          </label>

          <label className="text-sm text-zinc-300 md:col-span-2">
            Fuente de información
            <input
              name="source_url"
              type="url"
              placeholder="https://..."
              className={inputClass}
            />
          </label>

          <label className="text-sm text-zinc-300 md:col-span-2">
            Notas editoriales
            <textarea
              name="editorial_notes"
              rows={3}
              placeholder="Datos pendientes, observaciones, fuentes..."
              className={inputClass}
            />
          </label>

          <div className="md:col-span-2">
            <button
              type="submit"
              disabled={pending || state.success}
              className="rounded-xl bg-purple-400 px-6 py-3 font-bold text-purple-950 disabled:opacity-50"
            >
              {pending
                ? "Guardando..."
                : state.success
                  ? "Candidato guardado"
                  : "Guardar como pendiente"}
            </button>

            {state.message && (
              <p
                role="status"
                className={`mt-4 text-sm ${
                  state.success ? "text-green-400" : "text-red-400"
                }`}
              >
                {state.message}
              </p>
            )}
          </div>
        </form>
      )}
    </section>
  );
}

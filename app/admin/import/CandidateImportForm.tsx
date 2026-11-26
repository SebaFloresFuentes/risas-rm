
"use client";

import { useMemo, useState } from "react";
import { importCandidates } from "./import-actions";

type Candidate = {
  comedian?: unknown;
  show?: unknown;
  event_date?: unknown;
  event_time?: unknown;
  venue?: unknown;
  comuna?: unknown;
  ticket_url?: unknown;
  source_url?: unknown;
  price_from?: unknown;
};

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function validUrl(value: unknown): boolean {
  try {
    return new URL(text(value)).protocol === "https:";
  } catch {
    return false;
  }
}

function validateCandidate(
  candidate: Candidate
): string[] {
  const errors: string[] = [];

  for (const field of [
    "comedian",
    "show",
    "venue",
    "comuna",
  ] as const) {
    if (!text(candidate[field])) {
      errors.push(`Falta ${field}`);
    }
  }

  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(
      text(candidate.event_date)
    )
  ) {
    errors.push("Fecha inválida");
  }

  if (
    !/^\d{2}:\d{2}$/.test(
      text(candidate.event_time)
    )
  ) {
    errors.push("Hora inválida");
  }

  if (!validUrl(candidate.ticket_url)) {
    errors.push("URL de entradas inválida");
  }

  if (!validUrl(candidate.source_url)) {
    errors.push("URL de fuente inválida");
  }

  if (
    candidate.price_from != null &&
    (!Number.isInteger(candidate.price_from) ||
      Number(candidate.price_from) < 0)
  ) {
    errors.push("Precio inválido");
  }

  return errors;
}

export default function CandidateImportForm() {
  const [payload, setPayload] = useState("");
  const [confirmed, setConfirmed] = useState(false);

  const preview = useMemo(() => {
    if (!payload.trim()) {
      return {
        error: "",
        candidates: [] as Candidate[],
        problems: [] as string[][],
        valid: false,
      };
    }

    if (payload.length > 100000) {
      return {
        error: "El JSON supera el tamaño permitido.",
        candidates: [],
        problems: [],
        valid: false,
      };
    }

    try {
      const parsed: unknown = JSON.parse(payload);

      if (
        !parsed ||
        typeof parsed !== "object" ||
        !("candidates" in parsed) ||
        !Array.isArray(parsed.candidates)
      ) {
        throw new Error(
          'El JSON debe contener un arreglo "candidates".'
        );
      }

      if (parsed.candidates.length > 20) {
        throw new Error(
          "Se permiten como máximo 20 candidatos."
        );
      }

      if (
        !parsed.candidates.every(
          (item: unknown) =>
            item !== null &&
            typeof item === "object" &&
            !Array.isArray(item)
        )
      ) {
        throw new Error(
          "Cada candidato debe ser un objeto JSON."
        );
      }

      const candidates =
        parsed.candidates as Candidate[];

      const problems = candidates.map(
        validateCandidate
      );

      return {
        error: "",
        candidates,
        problems,
        valid: problems.every(
          (items) => items.length === 0
        ),
      };
    } catch (error) {
      return {
        error:
          error instanceof Error
            ? error.message
            : "JSON inválido.",
        candidates: [],
        problems: [],
        valid: false,
      };
    }
  }, [payload]);

  const total = preview.candidates.length;

  const invalidCount = preview.problems.filter(
    (items) => items.length > 0
  ).length;

  return (
    <section className="mt-10 rounded-2xl border border-white/10 bg-[#181720] p-6">
      <h2 className="text-xl font-bold text-white">
        Importar candidatos desde JSON
      </h2>

      <p className="mt-3 text-sm text-zinc-400">
        Pega el contenido de
        {" "}
        <code>data/normalized-candidates.json</code>.
        Revisa cada espectáculo antes de autorizar
        su ingreso a la bandeja.
      </p>

      <form
        action={importCandidates}
        className="mt-6 space-y-5"
      >
        <textarea
          name="payload"
          required
          rows={10}
          value={payload}
          onChange={(event) => {
            setPayload(event.target.value);
            setConfirmed(false);
          }}
          placeholder={'{"candidates":[]}'}
          className="w-full rounded-xl border border-white/10 bg-black/40 p-4 font-mono text-sm text-white"
        />

        {preview.error && (
          <p
            role="alert"
            className="text-sm text-red-300"
          >
            {preview.error}
          </p>
        )}

        {!preview.error && payload.trim() && (
          <div className="rounded-xl border border-white/10 p-4">
            <h3 className="font-bold text-white">
              Vista previa
            </h3>

            <div className="mt-3 flex flex-wrap gap-4 text-sm">
              <span className="text-zinc-300">
                Detectados: {total}
              </span>
              <span className="text-green-400">
                Completos: {total - invalidCount}
              </span>
              <span className="text-red-400">
                Con problemas: {invalidCount}
              </span>
            </div>

            {total === 0 && (
              <p className="mt-4 text-sm text-zinc-400">
                El archivo no contiene candidatos.
              </p>
            )}

            <div className="mt-4 space-y-3">
              {preview.candidates.map(
                (candidate, index) => {
                  const problems =
                    preview.problems[index];

                  return (
                    <div
                      key={index}
                      className="rounded-xl border border-white/10 bg-black/20 p-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-bold text-white">
                          {text(candidate.comedian) ||
                            "Artista sin identificar"}
                        </p>

                        <span
                          className={
                            problems.length
                              ? "text-xs text-red-300"
                              : "text-xs text-green-400"
                          }
                        >
                          {problems.length
                            ? "Datos incompletos"
                            : "Datos completos"}
                        </span>
                      </div>

                      <p className="mt-1 text-sm text-zinc-300">
                        {text(candidate.show) ||
                          "Show sin identificar"}
                      </p>

                      <p className="mt-2 text-xs text-zinc-400">
                        {text(candidate.event_date)} ·{" "}
                        {text(candidate.event_time)} ·{" "}
                        {text(candidate.venue)} ·{" "}
                        {text(candidate.comuna)}
                      </p>

                      {validUrl(candidate.source_url) && (
                        <a
                          href={text(candidate.source_url)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-3 inline-block text-sm text-purple-300 underline"
                        >
                          Revisar fuente
                        </a>
                      )}

                      {problems.length > 0 && (
                        <p className="mt-3 text-xs text-red-300">
                          {problems.join(" · ")}
                        </p>
                      )}
                    </div>
                  );
                }
              )}
            </div>
          </div>
        )}

        <p className="text-xs text-amber-200">
          La vista previa valida el formato,
          pero no comprueba si el evento ya existe
          en Supabase. Esa comprobación se realiza
          durante la importación.
        </p>

        <label className="flex items-start gap-3 text-sm text-zinc-300">
          <input
            type="checkbox"
            name="confirmed"
            value="yes"
            checked={confirmed}
            onChange={(event) =>
              setConfirmed(event.target.checked)
            }
            required
            className="mt-1"
          />
          Confirmo que revisé los espectáculos
          y autorizo crear candidatos pendientes
          en Supabase.
        </label>

        <button
          type="submit"
          disabled={
            !preview.valid ||
            !confirmed ||
            total === 0
          }
          className="rounded-xl bg-purple-400 px-5 py-3 font-bold text-purple-950 hover:bg-purple-300 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Importar {total} candidato
          {total === 1 ? "" : "s"}
        </button>
      </form>
    </section>
  );
}

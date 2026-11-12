
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import LogoutButton from "@/components/admin/LogoutButton";
import {
  reviewCandidate,
  saveCandidate,
  publishCandidate,
} from "./actions";
import PublishButton from "@/components/admin/PublishButton";
import CreateCandidateForm from "@/components/admin/CreateCandidateForm";

type Candidate = {
  id: string;
  comedian: string | null;
  show: string | null;
  event_date: string | null;
  event_time: string | null;
  venue: string | null;
  venue_address: string | null;
  comuna: string | null;
  price_from: number | null;
  ticket_provider: string | null;
  ticket_url: string | null;
  source_url: string | null;
  editorial_notes: string | null;
  review_status: string;
};

function formatPrice(price: number | null) {
  if (price === null) return null;

  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(price);
}

function CandidateActions({ candidate }: { candidate: Candidate }) {
  if (candidate.review_status !== "pending") return null;

  return (
    <div className="mt-5 flex flex-wrap items-center gap-3">
      <form action={reviewCandidate}>
        <input type="hidden" name="id" value={candidate.id} />
        <input type="hidden" name="status" value="rejected" />

        <button
          type="submit"
          className="rounded-xl border border-red-400/30 px-4 py-2 text-sm font-bold text-red-300 transition hover:bg-red-400/10"
        >
          Rechazar
        </button>
      </form>

      <form action={reviewCandidate}>
        <input type="hidden" name="id" value={candidate.id} />
        <input type="hidden" name="status" value="duplicate" />

        <button
          type="submit"
          className="rounded-xl border border-white/10 px-4 py-2 text-sm font-bold text-zinc-300 transition hover:bg-white/10"
        >
          Marcar duplicado
        </button>
      </form>


      <PublishButton
        candidateId={candidate.id}
        comedian={candidate.comedian}
        show={candidate.show}
        eventDate={candidate.event_date}
        eventTime={candidate.event_time}
        venue={candidate.venue}
        comuna={candidate.comuna}
        sourceUrl={candidate.source_url}
        ticketUrl={candidate.ticket_url}
      />

    </div>
  );
}

function CandidateEditor({ candidate }: { candidate: Candidate }) {
  if (candidate.review_status !== "pending") return null;

  const inputClass =
    "mt-2 w-full rounded-xl border border-white/10 bg-[#0d0d15] px-4 py-3 text-white outline-none focus:border-purple-400";

  return (
    <details className="mt-5 rounded-2xl border border-white/10 p-4">
      <summary className="cursor-pointer text-sm font-bold text-purple-300">
        Editar información
      </summary>

      <form
        action={saveCandidate}
        className="mt-5 grid gap-4 md:grid-cols-2"
      >
        <input type="hidden" name="id" value={candidate.id} />

        <label className="text-sm text-zinc-300">
          Comediante *
          <input
            name="comedian"
            required
            maxLength={200}
            defaultValue={candidate.comedian ?? ""}
            className={inputClass}
          />
        </label>

        <label className="text-sm text-zinc-300">
          Espectáculo *
          <input
            name="show"
            required
            maxLength={200}
            defaultValue={candidate.show ?? ""}
            className={inputClass}
          />
        </label>

        <label className="text-sm text-zinc-300">
          Fecha
          <input
            name="event_date"
            type="date"
            defaultValue={candidate.event_date ?? ""}
            className={inputClass}
          />
        </label>

        <label className="text-sm text-zinc-300">
          Hora
          <input
            name="event_time"
            type="time"
            defaultValue={candidate.event_time?.slice(0, 5) ?? ""}
            className={inputClass}
          />
        </label>

        <label className="text-sm text-zinc-300">
          Recinto *
          <input
            name="venue"
            required
            maxLength={200}
            defaultValue={candidate.venue ?? ""}
            className={inputClass}
          />
        </label>

        <label className="text-sm text-zinc-300">
          Comuna *
          <input
            name="comuna"
            required
            maxLength={120}
            defaultValue={candidate.comuna ?? ""}
            className={inputClass}
          />
        </label>

        <label className="text-sm text-zinc-300 md:col-span-2">
          Dirección del recinto
          <input
            name="venue_address"
            defaultValue={candidate.venue_address ?? ""}
            className={inputClass}
          />
        </label>

        <label className="text-sm text-zinc-300">
          Precio desde (CLP)
          <input
            name="price_from"
            type="number"
            min="0"
            step="1"
            defaultValue={candidate.price_from ?? ""}
            className={inputClass}
          />
        </label>

        <label className="text-sm text-zinc-300">
          Ticketera
          <input
            name="ticket_provider"
            defaultValue={candidate.ticket_provider ?? ""}
            className={inputClass}
          />
        </label>

        <label className="text-sm text-zinc-300 md:col-span-2">
          Enlace de entradas
          <input
            name="ticket_url"
            type="url"
            defaultValue={candidate.ticket_url ?? ""}
            className={inputClass}
          />
        </label>

        <label className="text-sm text-zinc-300 md:col-span-2">
          Fuente oficial
          <input
            name="source_url"
            type="url"
            defaultValue={candidate.source_url ?? ""}
            className={inputClass}
          />
        </label>

        <label className="text-sm text-zinc-300 md:col-span-2">
          Notas editoriales
          <textarea
            name="editorial_notes"
            rows={3}
            defaultValue={candidate.editorial_notes ?? ""}
            className={inputClass}
          />
        </label>

        <div className="md:col-span-2">
          <button
            type="submit"
            className="rounded-xl bg-purple-400 px-6 py-3 text-sm font-bold text-purple-950 transition hover:bg-purple-300"
          >
            Guardar cambios
          </button>
        </div>
      </form>
    </details>
  );
}

async function AdminDashboard() {
  await connection();

  const supabase = await createClient();

  const { data: auth, error: authError } =
    await supabase.auth.getClaims();

  if (authError || !auth?.claims?.sub) {
    redirect("/admin/login");
  }

  const { data: admin, error: adminError } = await supabase
    .from("admin_users")
    .select("user_id")
    .eq("user_id", auth.claims.sub)
    .maybeSingle();

  if (adminError || !admin) {
    redirect("/admin/login?error=unauthorized");
  }

  const { data, error } = await supabase
    .from("event_candidates")
    .select(`
      id,
      comedian,
      show,
      event_date,
      event_time,
      venue,
      venue_address,
      comuna,
      price_from,
      ticket_provider,
      ticket_url,
      source_url,
      editorial_notes,
      review_status
    `)
    .order("created_at", { ascending: false })
    .limit(50);

  const candidates = (data ?? []) as Candidate[];

  return (
    <main className="mx-auto max-w-7xl px-6 py-14">
      <header className="flex flex-wrap items-start justify-between gap-6">
        <div>
          <p className="text-sm font-bold uppercase tracking-widest text-purple-400">
            Panel privado
          </p>

          <h1 className="mt-3 text-4xl font-black text-white">
            Administración Risas RM
          </h1>

          <p className="mt-3 text-zinc-400">
            Revisa y administra los espectáculos antes de publicarlos.
          </p>
        </div>

        <LogoutButton />
      </header>

      <section className="mt-10 rounded-3xl border border-white/10 bg-[#181720] p-7">
        <p className="text-sm text-zinc-400">
          Candidatos encontrados
        </p>

        <p className="mt-2 text-4xl font-black text-purple-400">
          {error ? "—" : candidates.length}
        </p>


        <p className="mt-2 text-xs text-zinc-500">
          Últimos 50 candidatos registrados
        </p>
      </section>

      {/* Formulario para agregar nuevos espectáculos */}
      <CreateCandidateForm />

      <section className="mt-8 rounded-3xl border border-white/10 bg-[#181720] p-7">
        <h2 className="text-2xl font-bold text-white">
          Bandeja de revisión
        </h2>


        {error ? (
          <p className="mt-5 text-red-400">
            No se pudo cargar la bandeja de eventos.
          </p>
        ) : candidates.length === 0 ? (
          <p className="mt-5 text-zinc-400">
            Todavía no hay eventos pendientes de revisión.
          </p>
        ) : (
          <div className="mt-6 space-y-4">
            {candidates.map((candidate) => (
              <article
                key={candidate.id}
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-bold text-white">
                      {candidate.comedian ||
                        "Comediante por confirmar"}
                    </h3>

                    <p className="mt-1 text-sm text-zinc-300">
                      {candidate.show ||
                        "Espectáculo por confirmar"}
                    </p>

                    <p className="mt-2 text-sm text-zinc-500">
                      {candidate.event_date || "Sin fecha"}
                      {" · "}
                      {candidate.event_time?.slice(0, 5) ||
                        "Sin hora"}
                      {" · "}
                      {candidate.venue || "Sin recinto"}
                      {" · "}
                      {candidate.comuna || "Sin comuna"}
                    </p>

                    {candidate.price_from !== null && (
                      <p className="mt-2 text-sm text-zinc-400">
                        Precio desde:{" "}
                        {formatPrice(candidate.price_from)}
                      </p>
                    )}
                  </div>

                  <span className="rounded-full border border-purple-400/20 bg-purple-400/10 px-3 py-1 text-xs font-semibold text-purple-300">
                    {candidate.review_status}
                  </span>
                </div>

                {candidate.source_url && (
                  <a
                    href={candidate.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-4 inline-block text-sm font-semibold text-purple-400 hover:underline"
                  >
                    Revisar fuente ↗
                  </a>
                )}

                <CandidateActions candidate={candidate} />
                <CandidateEditor candidate={candidate} />
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

export default function AdminPage() {
  return (
    <Suspense
      fallback={
        <main className="p-10 text-center text-zinc-400">
          Verificando acceso administrativo...
        </main>
      }
    >
      <AdminDashboard />
    </Suspense>
  );
}

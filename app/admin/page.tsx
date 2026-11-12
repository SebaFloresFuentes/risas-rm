
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import LogoutButton from "@/components/admin/LogoutButton";
import {
  reviewCandidate,
  saveCandidate,
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


type AdminFilters = {
  status?: string | string[];
  q?: string | string[];
  page?: string | string[];
};

async function AdminDashboard({
  searchParams,
}: {
  searchParams: Promise<AdminFilters>;
}) {
  await connection();

  const params = await searchParams;

  const rawStatus =
    typeof params.status === "string"
      ? params.status
      : "all";

  const allowedStatuses = [
    "pending",
    "approved",
    "rejected",
    "duplicate",
  ];

  const status = allowedStatuses.includes(rawStatus)
    ? rawStatus
    : "all";

  const rawSearch =
    typeof params.q === "string" ? params.q : "";

  const search = rawSearch
    .slice(0, 80)
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .trim();


  const rawPage =
  typeof params.page === "string"
    ? Number(params.page)
    : 1;

  const page =
  Number.isSafeInteger(rawPage) &&
  rawPage >= 1 &&
  rawPage <= 10000
    ? rawPage
    : 1;

  const pageSize = 10;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;


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

  // Contadores globales independientes de los filtros
  const statuses = [
    "pending",
    "approved",
    "rejected",
    "duplicate",
  ] as const;

  const statsResults = await Promise.all(
    statuses.map((item) =>
      supabase
        .from("event_candidates")
        .select("id", { count: "exact", head: true })
        .eq("review_status", item)
    )
  );

  const stats = {
    pending: statsResults[0].count ?? 0,
    approved: statsResults[1].count ?? 0,
    rejected: statsResults[2].count ?? 0,
    duplicate: statsResults[3].count ?? 0,
  };

  const statsError = statsResults.some(
    (result) => result.error !== null
  );


  let query = supabase
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
    `, { count: "exact" });

  if (status !== "all") {
    query = query.eq("review_status", status);
  }

  if (search) {
    query = query.or(
      `comedian.ilike.%${search}%,show.ilike.%${search}%`
    );
  }



  const { data, error, count } = await query
  .order("created_at", { ascending: false })
  .order("id", { ascending: false })
  .range(from, to);

  const candidates = (data ?? []) as Candidate[];

  const totalPages = Math.max(
    1,
    Math.ceil((count ?? 0) / pageSize)
  );

  function pageUrl(targetPage: number) {
    const urlParams = new URLSearchParams();

    if (search) urlParams.set("q", search);
    if (status !== "all") urlParams.set("status", status);

    urlParams.set("page", String(targetPage));

    return `/admin?${urlParams.toString()}`;
  }



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


<section className="mt-10">
  <h2 className="mb-5 text-xl font-bold text-white">
    Resumen de candidatos
  </h2>

  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
    {[
      {
        label: "Pendientes",
        value: stats.pending,
        color: "text-amber-300",
      },
      {
        label: "Aprobados",
        value: stats.approved,
        color: "text-green-400",
      },
      {
        label: "Rechazados",
        value: stats.rejected,
        color: "text-red-400",
      },
      {
        label: "Duplicados",
        value: stats.duplicate,
        color: "text-purple-400",
      },
    ].map((item) => (
      <div
        key={item.label}
        className="rounded-2xl border border-white/10 bg-[#181720] p-6"
      >
        <p className="text-sm text-zinc-400">
          {item.label}
        </p>
        <p className={`mt-3 text-3xl font-black ${item.color}`}>
          {statsError ? "—" : item.value}
        </p>
      </div>
    ))}
  </div>

  {statsError && (
    <p className="mt-3 text-sm text-red-400">
      No se pudieron consultar todas las estadísticas.
    </p>
  )}
</section>


      {/* Formulario para agregar nuevos espectáculos */}
      <CreateCandidateForm />


<section className="mt-8 rounded-3xl border border-white/10 bg-[#181720] p-7">
  <h2 className="text-xl font-bold text-white">
    Buscar espectáculos
  </h2>

  <form
    action="/admin"
    method="GET"
    className="mt-5 grid gap-4 md:grid-cols-[1fr_220px_auto]"
  >
    <input
      name="q"
      type="search"
      maxLength={80}
      defaultValue={search}
      placeholder="Buscar comediante o show..."
      className="w-full rounded-xl border border-white/10 bg-[#0d0d15] px-4 py-3 text-white outline-none focus:border-purple-400"
    />

    <select
      name="status"
      defaultValue={status}
      className="rounded-xl border border-white/10 bg-[#0d0d15] px-4 py-3 text-white"
    >
      <option value="all">Todos los estados</option>
      <option value="pending">Pendientes</option>
      <option value="approved">Aprobados</option>
      <option value="rejected">Rechazados</option>
      <option value="duplicate">Duplicados</option>
    </select>

    <button
      type="submit"
      className="rounded-xl bg-purple-400 px-6 py-3 font-bold text-purple-950 hover:bg-purple-300"
    >
      Buscar
    </button>
  </form>

  <a
    href="/admin"
    className="mt-4 inline-block text-sm text-zinc-400 hover:text-white"
  >
    Limpiar filtros
  </a>

  <p className="mt-4 text-sm text-zinc-500">
    {error
      ? "No se pudieron consultar los resultados."
      : `${count ?? 0} coincidencias. Mostrando hasta ${pageSize} registros por página.`}  </p>
</section>


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

      {!error && (
        <nav
          aria-label="Paginación de candidatos"
          className="mt-6 flex flex-wrap items-center justify-between gap-4"
        >
          <p className="text-sm text-zinc-400">
            Página {page} de {totalPages}
            {" · "}
            {count ?? 0} coincidencias
          </p>

          <div className="flex items-center gap-3">
            {page > 1 ? (
              <a
                href={pageUrl(page - 1)}
                className="rounded-xl border border-white/10 px-5 py-3 text-sm font-bold text-white hover:bg-white/10"
              >
                ← Anterior
              </a>
            ) : (
              <span className="rounded-xl border border-white/5 px-5 py-3 text-sm text-zinc-600">
                ← Anterior
              </span>
            )}

            {page < totalPages ? (
              <a
                href={pageUrl(page + 1)}
                className="rounded-xl bg-purple-400 px-5 py-3 text-sm font-bold text-purple-950 hover:bg-purple-300"
              >
                Siguiente →
              </a>
            ) : (
              <span className="rounded-xl border border-white/5 px-5 py-3 text-sm text-zinc-600">
                Siguiente →
              </span>
            )}
          </div>
        </nav>
      )}

    </main>
  );
}


export default function AdminPage({
  searchParams,
}: {
  searchParams: Promise<AdminFilters>;
}) {
  return (
    <Suspense
      fallback={
        <main className="p-10 text-center text-zinc-400">
          Cargando administración...
        </main>
      }
    >
      <AdminDashboard searchParams={searchParams} />
    </Suspense>
  );
}

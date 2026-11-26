
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Suspense } from "react";
import CandidateImportForm from "./CandidateImportForm";

async function testIngestion() {
  "use server";

  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect("/admin/login");
  }

  const { data: admin, error: adminError } = await supabase
    .from("admin_users")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (adminError || !admin) {
    redirect("/admin");
  }

  // Prueba con un evento que ya sabemos que está publicado.
  // No debería insertar ningún candidato.
  const candidate = {
    comedian: "Los Disociados",
    show: "Show de stand-up",
    event_date: "2026-11-27",
    event_time: "20:30",
    venue: "TEATRO CACHAFAZ",
    comuna: "Ñuñoa",
    ticket_provider: "Ticketplus",
    ticket_url:
      "https://ticketplus.cl/events/show-de-stand-up-los-disociados-viernes-27-noviembre-20-30hrs",
    source_url:
      "https://ticketplus.cl/events/show-de-stand-up-los-disociados-viernes-27-noviembre-20-30hrs",
    editorial_notes: "Prueba de detección de duplicados.",
  };

  const { data, error } = await supabase.rpc(
    "ingest_detected_candidate",
    { p_candidate: candidate }
  );

  if (error) {
    console.error("Error de ingesta:", error.message);

    redirect(
      "/admin/import?result=error&message=" +
        encodeURIComponent(error.message.slice(0, 180))
    );
  }

  const status =
    typeof data?.status === "string"
      ? data.status
      : "unknown";

  redirect(
    "/admin/import?result=" + encodeURIComponent(status)
  );
}


type PageProps = {
  searchParams: Promise<{
    result?: string;
    message?: string;
    importResult?: string;
    inserted?: string;
    skipped?: string;
  }>;
};


async function ImportDashboard({
    searchParams,
  }: PageProps) {
  await connection();

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/admin/login");
  }

  const { data: admin } = await supabase
    .from("admin_users")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!admin) {
    redirect("/admin");
  }

  const params = await searchParams;

  const messages: Record<string, string> = {
    existing_published:
      "Correcto: Los Disociados ya está publicado. No se insertó un duplicado.",
    existing_candidate:
      "El candidato ya existe en la bandeja administrativa.",
    inserted:
      "ATENCIÓN: se insertó un candidato pendiente. Revisar la bandeja administrativa.",
    conflict:
      "La base de datos bloqueó una inserción duplicada.",
    error:
      "Ocurrió un error al ejecutar la función.",
    unknown:
      "La función devolvió una respuesta inesperada.",
  };

  const result = params.result ?? "";
  const message = messages[result];

  return (
    <main className="mx-auto min-h-screen max-w-3xl px-6 py-16 text-white">
      <a
        href="/admin"
        className="text-sm text-purple-300 hover:underline"
      >
        ← Volver al panel
      </a>

      <h1 className="mt-8 text-3xl font-bold">
        Importación de espectáculos
      </h1>

      <p className="mt-4 text-zinc-400">
        Comprueba duplicados e importa nuevos espectáculos
        como candidatos pendientes de revisión.
      </p>

      <div className="mt-8 rounded-2xl border border-white/10 bg-[#181720] p-6">
        <h2 className="text-xl font-bold">
          Los Disociados
        </h2>

        <p className="mt-2 text-sm text-zinc-400">
          27 de noviembre de 2026 · 20:30 · Teatro Cachafaz
        </p>

        <form action={testIngestion} className="mt-6">
          <button
            type="submit"
            className="rounded-xl bg-purple-400 px-5 py-3 font-bold text-purple-950 hover:bg-purple-300"
          >
            Probar detección de duplicado
          </button>
        </form>
      </div>

      {message && (
        <div
          role="status"
          className="mt-6 rounded-xl border border-white/10 bg-white/5 p-5"
        >
          <p className="font-medium">{message}</p>

          {result === "error" && params.message && (
            <p className="mt-2 break-words text-sm text-red-300">
              {params.message}
            </p>
          )}
        </div>
      )}


  <CandidateImportForm />


    {params.importResult && (
      <div
        role="status"
        className="mt-6 rounded-xl border border-white/10 bg-white/5 p-4 text-sm"
      >
        {params.importResult === "empty"
          ? "No hay candidatos nuevos para importar."
          : params.importResult === "completed"
          ? `Importación finalizada. Insertados: ${params.inserted ?? 0}. Omitidos: ${params.skipped ?? 0}.`
          : params.importResult === "too_many"
          ? "Se permiten como máximo 20 candidatos."
          : params.importResult === "invalid"
          ? "El servidor rechazó el JSON por datos inválidos."
          : "No se pudo completar la importación. Revisa los registros del servidor."}
      </div>
    )}


    </main>
  );
}

export default function ImportPage({
    searchParams,
  }: PageProps) {
    return (
      <Suspense
        fallback={
          <main className="mx-auto min-h-screen max-w-3xl px-6 py-16 text-white">
            <p className="text-zinc-400">
              Cargando panel de importación...
            </p>
          </main>
        }
      >
        <ImportDashboard searchParams={searchParams} />
      </Suspense>
    );
  }


"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type Candidate = {
  comedian?: unknown;
  show?: unknown;
  event_date?: unknown;
  event_time?: unknown;
  venue?: unknown;
  comuna?: unknown;
  ticket_url?: unknown;
  source_url?: unknown;
  venue_address?: unknown;
  price_from?: unknown;
  ticket_provider?: unknown;
  editorial_notes?: unknown;
};

function validHttps(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:";
  } catch {
    return false;
  }
}

function requiredText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function importCandidates(formData: FormData) {
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

  const raw = formData.get("payload");
  const confirmed = formData.get("confirmed") === "yes";

  if (typeof raw !== "string" || raw.length > 100000) {
    redirect("/admin/import?importResult=invalid");
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch {
    redirect("/admin/import?importResult=invalid");
  }

  if (
    !parsed ||
    typeof parsed !== "object" ||
    !("candidates" in parsed) ||
    !Array.isArray(parsed.candidates)
  ) {
    redirect("/admin/import?importResult=invalid");
  }

  const candidates = parsed.candidates as Candidate[];

  if (candidates.length === 0) {
    redirect("/admin/import?importResult=empty");
  }

  if (candidates.length > 20) {
    redirect("/admin/import?importResult=too_many");
  }

  const normalized = [];

  for (const item of candidates) {
    if (!item || typeof item !== "object") {
      redirect("/admin/import?importResult=invalid");
    }

    const candidate = {
      comedian: requiredText(item.comedian),
      show: requiredText(item.show),
      event_date: requiredText(item.event_date),
      event_time: requiredText(item.event_time),
      venue: requiredText(item.venue),
      comuna: requiredText(item.comuna),
      ticket_url: requiredText(item.ticket_url),
      source_url: requiredText(item.source_url),
      venue_address: requiredText(item.venue_address) || null,
      ticket_provider: requiredText(item.ticket_provider) || null,
      editorial_notes:
        requiredText(item.editorial_notes).slice(0, 2000) ||
        "Candidato detectado automáticamente. Requiere revisión.",
      price_from: item.price_from ?? null,
    };

    const valid =
      candidate.comedian &&
      candidate.show &&
      candidate.venue &&
      candidate.comuna &&
      /^\d{4}-\d{2}-\d{2}$/.test(candidate.event_date) &&
      /^\d{2}:\d{2}$/.test(candidate.event_time) &&
      validHttps(candidate.ticket_url) &&
      validHttps(candidate.source_url) &&
      (candidate.price_from === null ||
        (Number.isInteger(candidate.price_from) &&
          (candidate.price_from as number) >= 0));

    if (!valid) {
      redirect("/admin/import?importResult=invalid");
    }

    normalized.push(candidate);
  }

  // La confirmación explícita es obligatoria para escribir.
  if (!confirmed) {
    redirect("/admin/import?importResult=confirmation_required");
  }

  let inserted = 0;
  let skipped = 0;

  for (const candidate of normalized) {
    // Protección conservadora: mismo recinto, fecha y hora
    // requiere revisión, aunque tenga otra URL.
    const [eventsResult, candidatesResult] = await Promise.all([
      supabase
        .from("events")
        .select("id,venue")
        .eq("verified", true)
        .eq("event_date", candidate.event_date)
        .eq("event_time", candidate.event_time),

      supabase
        .from("event_candidates")
        .select("id,venue")
        .eq("event_date", candidate.event_date)
        .eq("event_time", candidate.event_time),
    ]);

    if (eventsResult.error || candidatesResult.error) {
      redirect("/admin/import?importResult=error");
    }

    const venueKey = candidate.venue
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");

    const sameVenue = (venue: string | null) =>
      String(venue ?? "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "") === venueKey;

    const possibleDuplicate = [
      ...(eventsResult.data ?? []),
      ...(candidatesResult.data ?? []),
    ].some((event) => sameVenue(event.venue));

    if (possibleDuplicate) {
      skipped++;
      continue;
    }

    const { data, error } = await supabase.rpc(
      "ingest_detected_candidate",
      { p_candidate: candidate }
    );

    if (error) {
      console.error("Ingesta fallida:", error.message);
      redirect("/admin/import?importResult=error");
    }



    if (data?.status === "inserted") {
      inserted++;
    } else if (
      [
        "existing_published",
        "existing_candidate",
        "possible_duplicate",
        "conflict",
      ].includes(data?.status)
    ) {
      skipped++;
    } else {
      console.error("Respuesta inesperada de ingesta:", data);
      redirect("/admin/import?importResult=error");
    }
  } // Cierra el for (const candidate of normalized)

  // Este redirect debe ejecutarse después de procesar todo el lote.
  redirect(
    `/admin/import?importResult=completed&inserted=${inserted}&skipped=${skipped}`
  );
} // Cierra importCandidates

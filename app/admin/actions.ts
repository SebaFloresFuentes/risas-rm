
"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function reviewCandidate(formData: FormData) {
  const id = formData.get("id");
  const status = formData.get("status");

  if (
    typeof id !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
  ) {
    throw new Error("Identificador inválido.");
  }

  if (status !== "rejected" && status !== "duplicate") {
    throw new Error("Estado no permitido.");
  }

  const supabase = await createClient();

  const { data: auth, error: authError } =
    await supabase.auth.getClaims();

  if (authError || !auth?.claims?.sub) {
    throw new Error("Debes iniciar sesión.");
  }

  const { data: admin, error: adminError } = await supabase
    .from("admin_users")
    .select("user_id")
    .eq("user_id", auth.claims.sub)
    .maybeSingle();

  if (adminError || !admin) {
    throw new Error("No tienes permisos administrativos.");
  }

  const { data, error } = await supabase
    .from("event_candidates")
    .update({ review_status: status })
    .eq("id", id)
    .eq("review_status", "pending")
    .select("id")
    .maybeSingle();

  if (error) {
    throw new Error("No se pudo actualizar el candidato.");
  }

  if (!data) {
    throw new Error("El candidato ya fue revisado o no existe.");
  }

  revalidatePath("/admin");
}

export async function saveCandidate(formData: FormData) {
    const id = formData.get("id");

    if (
      typeof id !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
    ) {
      throw new Error("Identificador inválido.");
    }

    function field(name: string) {
      const value = formData.get(name);
      return typeof value === "string" ? value.trim() : "";
    }

    const comedian = field("comedian");
    const show = field("show");
    const eventDate = field("event_date");
    const eventTime = field("event_time");
    const venue = field("venue");
    const comuna = field("comuna");
    const priceInput = field("price_from");

    if (!comedian || !show || !venue || !comuna) {
      throw new Error("Completa los campos obligatorios.");
    }

    if (
      comedian.length > 200 ||
      show.length > 200 ||
      venue.length > 200 ||
      comuna.length > 120
    ) {
      throw new Error("Uno de los textos es demasiado largo.");
    }

    if (
      eventDate &&
      !/^\d{4}-\d{2}-\d{2}$/.test(eventDate)
    ) {
      throw new Error("Fecha inválida.");
    }

    if (
      eventTime &&
      !/^([01]\d|2[0-3]):[0-5]\d$/.test(eventTime)
    ) {
      throw new Error("Hora inválida.");
    }

    const price =
      priceInput === "" ? null : Number(priceInput);

    if (
      price !== null &&
      (!Number.isSafeInteger(price) || price < 0)
    ) {
      throw new Error("Precio inválido.");
    }

    function optionalUrl(name: string) {
      const value = field(name);
      if (!value) return null;

      try {
        const url = new URL(value);
        if (!["https:", "http:"].includes(url.protocol)) {
          throw new Error();
        }
        return url.toString();
      } catch {
        throw new Error(`URL inválida: ${name}`);
      }
    }

    const supabase = await createClient();

    const { data: auth, error: authError } =
      await supabase.auth.getClaims();

    if (authError || !auth?.claims?.sub) {
      throw new Error("Debes iniciar sesión.");
    }

    const { data: admin, error: adminError } =
      await supabase
        .from("admin_users")
        .select("user_id")
        .eq("user_id", auth.claims.sub)
        .maybeSingle();

    if (adminError || !admin) {
      throw new Error("Acceso no autorizado.");
    }

    const { data, error } = await supabase
      .from("event_candidates")
      .update({
        comedian,
        show,
        event_date: eventDate || null,
        event_time: eventTime || null,
        venue,
        venue_address: field("venue_address") || null,
        comuna,
        price_from: price,
        ticket_provider: field("ticket_provider") || null,
        ticket_url: optionalUrl("ticket_url"),
        source_url: optionalUrl("source_url"),
        editorial_notes: field("editorial_notes") || null,
      })
      .eq("id", id)
      .eq("review_status", "pending")
      .select("id")
      .maybeSingle();

    if (error || !data) {
      throw new Error(
        "No se pudo guardar. Comprueba que el candidato siga pendiente."
      );
    }

    revalidatePath("/admin");
  }


  export type PublishState = {
    success: boolean;
    message: string;
  };

  export async function publishCandidate(
    _previousState: PublishState,
    formData: FormData
  ): Promise<PublishState> {

  if (formData.get("confirmed") !== "yes") {
    return {
      success: false,
      message: "Debes confirmar la revisión antes de publicar.",
    };
  }

    const id = formData.get("id");

    if (
      typeof id !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
    ) {
      return {
        success: false,
        message: "Identificador de evento inválido.",
      };
    }

    const supabase = await createClient();

    const { data: auth, error: authError } =
      await supabase.auth.getClaims();

    if (authError || !auth?.claims?.sub) {
      return {
        success: false,
        message: "Debes iniciar sesión nuevamente.",
      };
    }

    const { data: admin, error: adminError } = await supabase
      .from("admin_users")
      .select("user_id")
      .eq("user_id", auth.claims.sub)
      .maybeSingle();

    if (adminError || !admin) {
      return {
        success: false,
        message: "No tienes permisos administrativos.",
      };
    }

    const { error } = await supabase.rpc(
      "publish_event_candidate",
      { p_candidate_id: id }
    );

    if (error) {
      console.error("Publicación rechazada:", {
        code: error.code,
        message: error.message,
      });

      const message =
        error.code === "P0001"
          ? error.message
          : "No se pudo publicar. Revisa los datos y vuelve a intentarlo.";

      return {
        success: false,
        message,
      };
    }

    revalidatePath("/admin");
    revalidatePath("/");
    revalidatePath("/locales");
    revalidatePath("/sitemap.xml");

    return {
      success: true,
      message: "Evento publicado correctamente.",
    };
  }


export type CreateCandidateState = {
  success: boolean;
  message: string;
};

export async function createCandidate(
  _previousState: CreateCandidateState,
  formData: FormData
): Promise<CreateCandidateState> {
  function field(name: string): string {
    const value = formData.get(name);
    return typeof value === "string" ? value.trim() : "";
  }

  const comedian = field("comedian");
  const show = field("show");
  const date = field("event_date");
  const time = field("event_time");
  const venue = field("venue");
  const comuna = field("comuna");
  const priceInput = field("price_from");

  if (!comedian || !show || !date || !time || !venue || !comuna) {
    return {
      success: false,
      message: "Completa los campos obligatorios.",
    };
  }

  if (
    comedian.length > 200 ||
    show.length > 200 ||
    venue.length > 200 ||
    comuna.length > 120
  ) {
    return {
      success: false,
      message: "Alguno de los textos supera el largo permitido.",
    };
  }

  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)
  ) {
    return {
      success: false,
      message: "La fecha o la hora no tienen un formato válido.",
    };
  }

  const parsedDate = new Date(`${date}T12:00:00Z`);

  if (
    Number.isNaN(parsedDate.getTime()) ||
    parsedDate.toISOString().slice(0, 10) !== date
  ) {
    return {
      success: false,
      message: "La fecha indicada no existe.",
    };
  }

  const price =
    priceInput === "" ? null : Number(priceInput);

  if (
    price !== null &&
    (!Number.isSafeInteger(price) || price < 0)
  ) {
    return {
      success: false,
      message: "El precio debe ser un número entero positivo o cero.",
    };
  }

  function urlField(name: string): string | null {
    const value = field(name);
    if (!value) return null;

    try {
      const url = new URL(value);
      return url.protocol === "https:" ? url.toString() : null;
    } catch {
      return null;
    }
  }

  const ticketInput = field("ticket_url");
  const sourceInput = field("source_url");

  const ticketUrl = urlField("ticket_url");
  const sourceUrl = urlField("source_url");

  if ((ticketInput && !ticketUrl) || (sourceInput && !sourceUrl)) {
    return {
      success: false,
      message: "Los enlaces deben ser URLs HTTPS válidas.",
    };
  }

  const supabase = await createClient();

  const { data: auth, error: authError } =
    await supabase.auth.getClaims();

  if (authError || !auth?.claims?.sub) {
    return {
      success: false,
      message: "Debes iniciar sesión.",
    };
  }

  const { data: admin, error: adminError } = await supabase
    .from("admin_users")
    .select("user_id")
    .eq("user_id", auth.claims.sub)
    .maybeSingle();

  if (adminError || !admin) {
    return {
      success: false,
      message: "No tienes permisos administrativos.",
    };
  }

  const { data: existing, error: searchError } = await supabase
    .from("event_candidates")
    .select("id")
    .eq("comedian", comedian)
    .eq("show", show)
    .eq("event_date", date)
    .eq("event_time", time)
    .eq("venue", venue)
    .in("review_status", ["pending", "approved"])
    .limit(1);

  if (searchError) {
    return {
      success: false,
      message: "No se pudo comprobar si existe otro candidato.",
    };
  }

  if (existing && existing.length > 0) {
    return {
      success: false,
      message: "Ya existe un candidato con esos mismos datos.",
    };
  }

  const { error } = await supabase
    .from("event_candidates")
    .insert({
      comedian,
      show,
      event_date: date,
      event_time: time,
      venue,
      venue_address: field("venue_address") || null,
      comuna,
      price_from: price,
      ticket_provider: field("ticket_provider") || null,
      ticket_url: ticketUrl,
      source_url: sourceUrl,
      editorial_notes: field("editorial_notes") || null,
    });

  if (error) {
    console.error("Error creando candidato:", error.code);
    return {
      success: false,
      message: "No fue posible guardar el espectáculo.",
    };
  }

  revalidatePath("/admin");

  return {
    success: true,
    message: "Espectáculo guardado como pendiente de revisión.",
  };
}

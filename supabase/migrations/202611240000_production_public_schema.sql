-- Sanitized schema-only baseline recovered from RadarRisas production on 2026-11-25.
-- Contains no table data, personal information, passwords, API keys, or tokens.
-- Do not apply directly to the existing production database; register it as
-- already applied before pushing incremental migrations.



SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE OR REPLACE FUNCTION "public"."archive_expired_events"() RETURNS integer
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
DECLARE
    archived_count integer;
BEGIN
    WITH expired_events AS (
        DELETE FROM public.events
        WHERE event_date <
            (NOW() AT TIME ZONE 'America/Santiago')::date
        RETURNING *
    )
    INSERT INTO public.events_archive
    SELECT expired_events.*, NOW()
    FROM expired_events;

    GET DIAGNOSTICS archived_count = ROW_COUNT;

    RETURN archived_count;
END;
$$;


ALTER FUNCTION "public"."archive_expired_events"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ingest_detected_candidate"("p_candidate" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $_$
DECLARE
  v_id uuid;
  v_existing_id uuid;
  v_comedian text;
  v_show text;
  v_venue text;
  v_comuna text;
  v_ticket_url text;
  v_source_url text;
  v_date date;
  v_time time;
  v_url_key text;
  v_venue_key text;
BEGIN
  -- 1. Autorización administrativa
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1
    FROM public.admin_users a
    WHERE a.user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Acceso no autorizado'
      USING ERRCODE = '42501';
  END IF;

  IF jsonb_typeof(p_candidate) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'Candidato inválido';
  END IF;

  -- 2. Normalización básica
  v_comedian := nullif(btrim(p_candidate->>'comedian'), '');
  v_show := nullif(btrim(p_candidate->>'show'), '');
  v_venue := nullif(btrim(p_candidate->>'venue'), '');
  v_comuna := nullif(btrim(p_candidate->>'comuna'), '');
  v_ticket_url := nullif(btrim(p_candidate->>'ticket_url'), '');
  v_source_url := nullif(btrim(p_candidate->>'source_url'), '');

  IF v_comedian IS NULL
     OR v_show IS NULL
     OR v_venue IS NULL
     OR v_comuna IS NULL
     OR v_ticket_url IS NULL
     OR v_source_url IS NULL
     OR nullif(p_candidate->>'event_date', '') IS NULL
     OR nullif(p_candidate->>'event_time', '') IS NULL
  THEN
    RAISE EXCEPTION 'Faltan campos obligatorios';
  END IF;

  IF v_ticket_url !~* '^https://[^[:space:]]+$'
     OR v_source_url !~* '^https://[^[:space:]]+$'
  THEN
    RAISE EXCEPTION 'Las URL deben utilizar HTTPS';
  END IF;

  v_date := (p_candidate->>'event_date')::date;
  v_time := (p_candidate->>'event_time')::time;

  v_url_key := lower(
    rtrim(split_part(v_ticket_url, '?', 1), '/')
  );

  v_venue_key := regexp_replace(
    lower(v_venue),
    '[^[:alnum:]]',
    '',
    'g'
  );

  -- 3. Serializar ingestas del mismo lugar,
  -- fecha y hora. El bloqueo dura esta transacción.
  PERFORM pg_catalog.pg_advisory_xact_lock(
    61234,
    pg_catalog.hashtext(
      v_date::text || '|' ||
      v_time::text || '|' ||
      v_venue_key
    )
  );

  -- 4. Coincidencia exacta con evento publicado
  SELECT e.id INTO v_existing_id
  FROM public.events e
  WHERE e.verified = true
    AND e.event_date = v_date
    AND e.event_time = v_time
    AND lower(
      rtrim(split_part(btrim(e.ticket_url), '?', 1), '/')
    ) = v_url_key
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'status', 'existing_published',
      'id', v_existing_id
    );
  END IF;

  -- 5. Coincidencia exacta con candidato
  SELECT c.id INTO v_existing_id
  FROM public.event_candidates c
  WHERE c.event_date = v_date
    AND c.event_time = v_time
    AND lower(
      rtrim(split_part(btrim(c.ticket_url), '?', 1), '/')
    ) = v_url_key
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'status', 'existing_candidate',
      'id', v_existing_id
    );
  END IF;

  -- 6. Misma fecha, hora y recinto publicado,
  -- aunque la URL sea diferente
  SELECT e.id INTO v_existing_id
  FROM public.events e
  WHERE e.verified = true
    AND e.event_date = v_date
    AND e.event_time = v_time
    AND regexp_replace(
      lower(btrim(e.venue)),
      '[^[:alnum:]]',
      '',
      'g'
    ) = v_venue_key
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'status', 'possible_duplicate',
      'source', 'events',
      'id', v_existing_id
    );
  END IF;

  -- 7. Misma fecha, hora y recinto
  -- dentro de la bandeja privada
  SELECT c.id INTO v_existing_id
  FROM public.event_candidates c
  WHERE c.event_date = v_date
    AND c.event_time = v_time
    AND regexp_replace(
      lower(btrim(c.venue)),
      '[^[:alnum:]]',
      '',
      'g'
    ) = v_venue_key
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'status', 'possible_duplicate',
      'source', 'event_candidates',
      'id', v_existing_id
    );
  END IF;

  -- 8. Insertar exclusivamente como pendiente
  INSERT INTO public.event_candidates (
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
    source_checked_at,
    review_status,
    editorial_notes,
    published_event_id
  )
  VALUES (
    v_comedian,
    v_show,
    v_date,
    v_time,
    v_venue,
    nullif(btrim(p_candidate->>'venue_address'), ''),
    v_comuna,
    (nullif(p_candidate->>'price_from', ''))::integer,
    nullif(btrim(p_candidate->>'ticket_provider'), ''),
    v_ticket_url,
    v_source_url,
    now(),
    'pending',
    left(
      coalesce(p_candidate->>'editorial_notes', ''),
      2000
    ),
    NULL
  )
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_id;

  IF v_id IS NULL THEN
    RETURN jsonb_build_object(
      'status', 'conflict',
      'id', NULL
    );
  END IF;

  RETURN jsonb_build_object(
    'status', 'inserted',
    'id', v_id
  );
END;
$_$;


ALTER FUNCTION "public"."ingest_detected_candidate"("p_candidate" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."publish_event_candidate"("p_candidate_id" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $_$
DECLARE
  v_candidate public.event_candidates%ROWTYPE;
  v_event_id uuid;
  v_slug text;
BEGIN
  -- Comprobar que existe una cuenta autenticada
  -- y autorizada como administradora.
  IF (SELECT auth.uid()) IS NULL OR NOT EXISTS (
    SELECT 1
    FROM public.admin_users a
    WHERE a.user_id = (SELECT auth.uid())
  ) THEN
    RAISE EXCEPTION 'Acceso administrativo no autorizado';
  END IF;

  -- Bloquear el candidato durante la operación.
  SELECT *
  INTO v_candidate
  FROM public.event_candidates
  WHERE id = p_candidate_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'El candidato no existe';
  END IF;

  IF v_candidate.review_status <> 'pending' THEN
    RAISE EXCEPTION 'El candidato ya fue revisado';
  END IF;

  -- Evitar publicaciones accidentales de pruebas.
  IF upper(coalesce(v_candidate.comedian, ''))
       LIKE 'PRUEBA%'
     OR upper(coalesce(v_candidate.show, ''))
       LIKE '%NO PUBLICAR%' THEN
    RAISE EXCEPTION 'No se pueden publicar eventos de prueba';
  END IF;

  -- Validaciones obligatorias.
  IF nullif(btrim(coalesce(v_candidate.comedian, '')), '') IS NULL
    OR nullif(btrim(coalesce(v_candidate.show, '')), '') IS NULL
    OR v_candidate.event_date IS NULL
    OR v_candidate.event_time IS NULL
    OR nullif(btrim(coalesce(v_candidate.venue, '')), '') IS NULL
    OR nullif(btrim(coalesce(v_candidate.comuna, '')), '') IS NULL
  THEN
    RAISE EXCEPTION 'Faltan datos obligatorios del evento';
  END IF;

  IF v_candidate.event_date <
    (now() AT TIME ZONE 'America/Santiago')::date THEN
    RAISE EXCEPTION 'No se pueden publicar fechas pasadas';
  END IF;

  IF v_candidate.source_url IS NULL
    OR v_candidate.source_url !~* '^https://[^[:space:]]+$'
    OR v_candidate.ticket_url IS NULL
    OR v_candidate.ticket_url !~* '^https://[^[:space:]]+$'
  THEN
    RAISE EXCEPTION
      'Se requieren enlaces HTTPS de fuente y entradas';
  END IF;

  IF v_candidate.price_from IS NOT NULL
    AND v_candidate.price_from < 0 THEN
    RAISE EXCEPTION 'El precio no puede ser negativo';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.events e
    WHERE lower(btrim(e.comedian)) =
          lower(btrim(v_candidate.comedian))
      AND lower(btrim(e.show)) =
          lower(btrim(v_candidate.show))
      AND e.event_date = v_candidate.event_date
      AND e.event_time = v_candidate.event_time
      AND lower(btrim(e.venue)) =
          lower(btrim(v_candidate.venue))
  ) THEN
    RAISE EXCEPTION 'Esta función ya existe en la cartelera';
  END IF;

  -- Identificador legible con sufijo único.
  v_slug := trim(both '-' from
    lower(
      regexp_replace(
        translate(
          v_candidate.comedian || '-' ||
          v_candidate.show || '-' ||
          v_candidate.event_date::text,
          'ÁÉÍÓÚÜÑáéíóúüñ',
          'AEIOUUNaeiouun'
        ),
        '[^a-zA-Z0-9]+',
        '-',
        'g'
      )
    )
  ) || '-' ||
  left(replace(v_candidate.id::text, '-', ''), 8);

  -- Crear evento público.
  INSERT INTO public.events (
    slug,
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
    source_checked_at,
    featured,
    sold_out,
    verified
  )
  VALUES (
    v_slug,
    btrim(v_candidate.comedian),
    btrim(v_candidate.show),
    v_candidate.event_date,
    v_candidate.event_time,
    btrim(v_candidate.venue),
    v_candidate.venue_address,
    btrim(v_candidate.comuna),
    v_candidate.price_from,
    v_candidate.ticket_provider,
    v_candidate.ticket_url,
    v_candidate.source_url,
    v_candidate.source_checked_at,
    false,
    false,
    true
  )
  RETURNING id INTO v_event_id;

  -- Actualizar candidato en la misma transacción.
  UPDATE public.event_candidates
  SET review_status = 'approved',
      published_event_id = v_event_id,
      updated_at = now()
  WHERE id = p_candidate_id;

  RETURN v_event_id;
END;
$_$;


ALTER FUNCTION "public"."publish_event_candidate"("p_candidate_id" "uuid") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."admin_users" (
    "user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."admin_users" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."event_candidates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "comedian" "text",
    "show" "text",
    "event_date" "date",
    "event_time" time without time zone,
    "venue" "text",
    "venue_address" "text",
    "comuna" "text",
    "price_from" integer,
    "ticket_provider" "text",
    "ticket_url" "text",
    "source_url" "text",
    "source_checked_at" timestamp with time zone,
    "review_status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "editorial_notes" "text",
    "published_event_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "event_candidates_review_status_check" CHECK (("review_status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'rejected'::"text", 'duplicate'::"text"])))
);


ALTER TABLE "public"."event_candidates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "comedian" "text" NOT NULL,
    "show" "text" NOT NULL,
    "event_date" "date" NOT NULL,
    "event_time" time without time zone NOT NULL,
    "venue" "text" NOT NULL,
    "comuna" "text" NOT NULL,
    "price_from" integer,
    "ticket_provider" "text",
    "ticket_url" "text",
    "image_url" "text",
    "featured" boolean DEFAULT false NOT NULL,
    "sold_out" boolean DEFAULT false NOT NULL,
    "verified" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "slug" "text" NOT NULL,
    "venue_address" "text",
    "organizer" "text",
    "source_url" "text",
    "source_checked_at" timestamp with time zone
);


ALTER TABLE "public"."events" OWNER TO "postgres";


COMMENT ON COLUMN "public"."events"."venue_address" IS 'Dirección física verificada del recinto';



COMMENT ON COLUMN "public"."events"."organizer" IS 'Organizador o productora confirmada';



COMMENT ON COLUMN "public"."events"."source_url" IS 'Fuente oficial utilizada para comprobar la función';



COMMENT ON COLUMN "public"."events"."source_checked_at" IS 'Fecha de la última comprobación de la fuente';



CREATE TABLE IF NOT EXISTS "public"."events_archive" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "comedian" "text" NOT NULL,
    "show" "text" NOT NULL,
    "event_date" "date" NOT NULL,
    "event_time" time without time zone NOT NULL,
    "venue" "text" NOT NULL,
    "comuna" "text" NOT NULL,
    "price_from" integer,
    "ticket_provider" "text",
    "ticket_url" "text",
    "image_url" "text",
    "featured" boolean DEFAULT false NOT NULL,
    "sold_out" boolean DEFAULT false NOT NULL,
    "verified" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "slug" "text" NOT NULL,
    "venue_address" "text",
    "organizer" "text",
    "source_url" "text",
    "source_checked_at" timestamp with time zone,
    "archived_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."events_archive" OWNER TO "postgres";


ALTER TABLE ONLY "public"."admin_users"
    ADD CONSTRAINT "admin_users_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."event_candidates"
    ADD CONSTRAINT "event_candidates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."events"
    ADD CONSTRAINT "events_pkey" PRIMARY KEY ("id");



CREATE INDEX "event_candidates_date_idx" ON "public"."event_candidates" USING "btree" ("event_date");



CREATE INDEX "event_candidates_status_idx" ON "public"."event_candidates" USING "btree" ("review_status");



CREATE UNIQUE INDEX "event_candidates_unique_ticket_datetime_idx" ON "public"."event_candidates" USING "btree" ("lower"("rtrim"("split_part"(TRIM(BOTH FROM "ticket_url"), '?'::"text", 1), '/'::"text")), "event_date", "event_time") WHERE (("ticket_url" IS NOT NULL) AND (TRIM(BOTH FROM "ticket_url") <> ''::"text") AND ("event_date" IS NOT NULL) AND ("event_time" IS NOT NULL));



CREATE UNIQUE INDEX "events_archive_id_idx" ON "public"."events_archive" USING "btree" ("id");



CREATE UNIQUE INDEX "events_slug_unique" ON "public"."events" USING "btree" ("slug");



CREATE UNIQUE INDEX "events_unique_performance" ON "public"."events" USING "btree" ("lower"("btrim"("comedian")), "lower"("btrim"("show")), "event_date", "event_time", "lower"("btrim"("venue")));



ALTER TABLE ONLY "public"."admin_users"
    ADD CONSTRAINT "admin_users_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."event_candidates"
    ADD CONSTRAINT "event_candidates_published_event_id_fkey" FOREIGN KEY ("published_event_id") REFERENCES "public"."events"("id") ON DELETE SET NULL;



CREATE POLICY "Admins create candidates" ON "public"."event_candidates" FOR INSERT TO "authenticated" WITH CHECK ((("review_status" = 'pending'::"text") AND ("published_event_id" IS NULL) AND (EXISTS ( SELECT 1
   FROM "public"."admin_users" "a"
  WHERE ("a"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "Admins edit pending candidates" ON "public"."event_candidates" FOR UPDATE TO "authenticated" USING ((("review_status" = 'pending'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."admin_users" "a"
  WHERE ("a"."user_id" = ( SELECT "auth"."uid"() AS "uid")))))) WITH CHECK ((("review_status" = 'pending'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."admin_users" "a"
  WHERE ("a"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "Admins read candidates" ON "public"."event_candidates" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."admin_users" "a"
  WHERE ("a"."user_id" = ( SELECT "auth"."uid"() AS "uid")))));



CREATE POLICY "Admins review pending candidates" ON "public"."event_candidates" FOR UPDATE TO "authenticated" USING ((("review_status" = 'pending'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."admin_users" "a"
  WHERE ("a"."user_id" = ( SELECT "auth"."uid"() AS "uid")))))) WITH CHECK ((("review_status" = ANY (ARRAY['rejected'::"text", 'duplicate'::"text"])) AND (EXISTS ( SELECT 1
   FROM "public"."admin_users" "a"
  WHERE ("a"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "Authenticated read verified events" ON "public"."events" FOR SELECT TO "authenticated" USING (("verified" = true));



CREATE POLICY "Public can read verified events" ON "public"."events" FOR SELECT TO "anon" USING (("verified" = true));



CREATE POLICY "Read own admin membership" ON "public"."admin_users" FOR SELECT TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



ALTER TABLE "public"."admin_users" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."event_candidates" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."events_archive" ENABLE ROW LEVEL SECURITY;


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



REVOKE ALL ON FUNCTION "public"."archive_expired_events"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."archive_expired_events"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."ingest_detected_candidate"("p_candidate" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."ingest_detected_candidate"("p_candidate" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."ingest_detected_candidate"("p_candidate" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."publish_event_candidate"("p_candidate_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."publish_event_candidate"("p_candidate_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."publish_event_candidate"("p_candidate_id" "uuid") TO "service_role";



GRANT ALL ON TABLE "public"."admin_users" TO "service_role";
GRANT SELECT ON TABLE "public"."admin_users" TO "authenticated";



GRANT ALL ON TABLE "public"."event_candidates" TO "service_role";
GRANT SELECT,INSERT ON TABLE "public"."event_candidates" TO "authenticated";



GRANT INSERT("comedian"),UPDATE("comedian") ON TABLE "public"."event_candidates" TO "authenticated";



GRANT INSERT("show"),UPDATE("show") ON TABLE "public"."event_candidates" TO "authenticated";



GRANT INSERT("event_date"),UPDATE("event_date") ON TABLE "public"."event_candidates" TO "authenticated";



GRANT INSERT("event_time"),UPDATE("event_time") ON TABLE "public"."event_candidates" TO "authenticated";



GRANT INSERT("venue"),UPDATE("venue") ON TABLE "public"."event_candidates" TO "authenticated";



GRANT INSERT("venue_address"),UPDATE("venue_address") ON TABLE "public"."event_candidates" TO "authenticated";



GRANT INSERT("comuna"),UPDATE("comuna") ON TABLE "public"."event_candidates" TO "authenticated";



GRANT INSERT("price_from"),UPDATE("price_from") ON TABLE "public"."event_candidates" TO "authenticated";



GRANT INSERT("ticket_provider"),UPDATE("ticket_provider") ON TABLE "public"."event_candidates" TO "authenticated";



GRANT INSERT("ticket_url"),UPDATE("ticket_url") ON TABLE "public"."event_candidates" TO "authenticated";



GRANT INSERT("source_url"),UPDATE("source_url") ON TABLE "public"."event_candidates" TO "authenticated";



GRANT UPDATE("review_status") ON TABLE "public"."event_candidates" TO "authenticated";



GRANT INSERT("editorial_notes"),UPDATE("editorial_notes") ON TABLE "public"."event_candidates" TO "authenticated";



GRANT ALL ON TABLE "public"."events" TO "anon";
GRANT ALL ON TABLE "public"."events" TO "authenticated";
GRANT ALL ON TABLE "public"."events" TO "service_role";



GRANT ALL ON TABLE "public"."events_archive" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";







-- Hosted Supabase projects can start with broader default privileges than the
-- source database. Reconcile them so restoring this baseline is reproducible.
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" REVOKE ALL ON TABLES FROM "anon", "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" REVOKE ALL ON SEQUENCES FROM "anon", "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" REVOKE ALL ON FUNCTIONS FROM "anon", "authenticated";

REVOKE ALL ON TABLE "public"."admin_users" FROM "anon", "authenticated";
GRANT SELECT ON TABLE "public"."admin_users" TO "authenticated";
REVOKE ALL ON TABLE "public"."event_candidates" FROM "anon", "authenticated";
GRANT SELECT, INSERT ON TABLE "public"."event_candidates" TO "authenticated";
REVOKE ALL ON TABLE "public"."events_archive" FROM "anon", "authenticated";

REVOKE ALL ON FUNCTION "public"."archive_expired_events"() FROM "anon", "authenticated";
REVOKE ALL ON FUNCTION "public"."ingest_detected_candidate"("jsonb") FROM "anon";
REVOKE ALL ON FUNCTION "public"."publish_event_candidate"("uuid") FROM "anon";

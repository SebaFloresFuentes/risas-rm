-- Least-privilege RPC boundary for RadarRisas automation.
-- The short-lived JWT issued by Supabase Auth must contain:
--   { "role": "radarrisas_automation" }
-- Never store a JWT signing secret or service_role key in GitHub Actions.

begin;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'radarrisas_automation') then
    create role radarrisas_automation nologin noinherit;
  end if;
end
$$;

grant radarrisas_automation to authenticator;
grant usage on schema public to radarrisas_automation;

-- No direct table access is granted to the automation role.
revoke all on table public.events from radarrisas_automation;
revoke all on table public.event_candidates from radarrisas_automation;
revoke all on table public.event_commercial_observations from radarrisas_automation;

create or replace function public.radarrisas_ingest_candidate_v1(p_candidate jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_existing_id uuid;
  v_key text;
  v_comedian text;
  v_show text;
  v_venue text;
  v_comuna text;
  v_ticket_url text;
  v_source_url text;
  v_date date;
  v_time time;
  v_price integer;
begin
  if coalesce(auth.jwt()->>'role', '') <> 'radarrisas_automation' then
    raise exception 'Acceso de automatización no autorizado' using errcode = '42501';
  end if;

  if jsonb_typeof(p_candidate) is distinct from 'object' then
    raise exception 'Candidato inválido' using errcode = '22023';
  end if;

  v_key := nullif(btrim(p_candidate->>'idempotency_key'), '');
  v_comedian := nullif(btrim(p_candidate->>'comedian'), '');
  v_show := nullif(btrim(p_candidate->>'show'), '');
  v_venue := nullif(btrim(p_candidate->>'venue'), '');
  v_comuna := nullif(btrim(p_candidate->>'comuna'), '');
  v_ticket_url := nullif(btrim(p_candidate->>'ticket_url'), '');
  v_source_url := nullif(btrim(p_candidate->>'source_url'), '');

  if v_key is null or v_comedian is null or v_show is null or v_venue is null
     or v_comuna is null or v_ticket_url is null or v_source_url is null
     or nullif(p_candidate->>'event_date', '') is null
     or nullif(p_candidate->>'event_time', '') is null then
    raise exception 'Faltan campos obligatorios' using errcode = '22023';
  end if;

  if length(v_key) > 256 then
    raise exception 'Clave de idempotencia inválida' using errcode = '22023';
  end if;

  if v_ticket_url !~* '^https://[^[:space:]]+$'
     or v_source_url !~* '^https://[^[:space:]]+$' then
    raise exception 'Las URL deben utilizar HTTPS' using errcode = '22023';
  end if;

  v_date := (p_candidate->>'event_date')::date;
  v_time := (p_candidate->>'event_time')::time;
  v_price := nullif(p_candidate->>'price_from', '')::integer;

  if v_price is not null and v_price < 0 then
    raise exception 'El precio no puede ser negativo' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(61235, pg_catalog.hashtext(v_key));

  select c.id into v_existing_id
  from public.event_candidates c
  where c.discovery_key = v_key
  limit 1;

  if v_existing_id is not null then
    return jsonb_build_object('status', 'existing_candidate', 'id', v_existing_id);
  end if;

  select e.id into v_existing_id
  from public.events e
  where e.event_date = v_date
    and e.event_time = v_time
    and lower(rtrim(split_part(btrim(e.ticket_url), '?', 1), '/')) =
        lower(rtrim(split_part(v_ticket_url, '?', 1), '/'))
  limit 1;

  if v_existing_id is not null then
    return jsonb_build_object('status', 'existing_published', 'id', v_existing_id);
  end if;

  insert into public.event_candidates (
    comedian, show, event_date, event_time, venue, venue_address, comuna,
    price_from, ticket_provider, ticket_url, source_url, source_checked_at,
    review_status, editorial_notes, published_event_id, discovery_key
  ) values (
    v_comedian, v_show, v_date, v_time, v_venue,
    nullif(btrim(p_candidate->>'venue_address'), ''), v_comuna, v_price,
    nullif(btrim(p_candidate->>'ticket_provider'), ''), v_ticket_url,
    v_source_url, now(), 'pending',
    left(coalesce(p_candidate->>'editorial_notes', ''), 2000), null, v_key
  )
  on conflict do nothing
  returning id into v_id;

  if v_id is null then
    select c.id into v_existing_id
    from public.event_candidates c
    where c.discovery_key = v_key
    limit 1;
    return jsonb_build_object('status', 'conflict', 'id', v_existing_id);
  end if;

  return jsonb_build_object('status', 'inserted', 'id', v_id);
end
$$;

create or replace function public.radarrisas_apply_commercial_observation_v1(
  p_observation jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event public.events%rowtype;
  v_observation_id bigint;
  v_key text;
  v_provider text;
  v_status text;
  v_source text;
  v_source_url text;
  v_error text;
  v_event_id uuid;
  v_price integer;
  v_attempted timestamptz;
  v_verified timestamptz;
  v_evidence jsonb;
  v_transition text;
begin
  if coalesce(auth.jwt()->>'role', '') <> 'radarrisas_automation' then
    raise exception 'Acceso de automatización no autorizado' using errcode = '42501';
  end if;

  if jsonb_typeof(p_observation) is distinct from 'object' then
    raise exception 'Observación inválida' using errcode = '22023';
  end if;

  v_key := nullif(btrim(p_observation->>'observation_key'), '');
  v_provider := nullif(btrim(p_observation->>'provider'), '');
  v_status := coalesce(nullif(btrim(p_observation->>'availability_status'), ''), 'unknown');
  v_source := nullif(btrim(p_observation->>'availability_source'), '');
  v_source_url := nullif(btrim(p_observation->>'source_url'), '');
  v_error := nullif(btrim(p_observation->>'error_code'), '');
  v_event_id := nullif(p_observation->>'event_id', '')::uuid;
  v_price := nullif(p_observation->>'price_from', '')::integer;
  v_attempted := nullif(p_observation->>'attempted_at', '')::timestamptz;
  v_verified := nullif(p_observation->>'verified_at', '')::timestamptz;
  v_evidence := coalesce(p_observation->'availability_evidence', '[]'::jsonb);

  if v_key is null or v_provider is null or v_event_id is null or v_attempted is null then
    raise exception 'Faltan campos obligatorios' using errcode = '22023';
  end if;

  if length(v_key) > 256
     or v_status not in ('available', 'limited', 'sold_out', 'unknown')
     or (v_status <> 'unknown' and v_verified is null)
     or (v_price is not null and v_price < 0)
     or jsonb_typeof(v_evidence) <> 'array' then
    raise exception 'Observación comercial inválida' using errcode = '22023';
  end if;

  select * into v_event
  from public.events
  where id = v_event_id
  for update;

  if not found then
    raise exception 'El evento no existe' using errcode = 'P0002';
  end if;

  insert into public.event_commercial_observations (
    observation_key, event_id, provider, source_url, price_from, price_currency,
    availability_status, availability_source, availability_evidence,
    attempted_at, verified_at, error_code
  ) values (
    v_key, v_event_id, v_provider, v_source_url, v_price,
    case when v_price is null then null else 'CLP' end,
    v_status, v_source, v_evidence, v_attempted, v_verified, v_error
  )
  on conflict (observation_key) do nothing
  returning id into v_observation_id;

  if v_observation_id is null then
    return jsonb_build_object('status', 'duplicate', 'event_id', v_event_id);
  end if;

  if v_event.availability_status = 'sold_out'
     and v_status in ('available', 'limited')
     and v_verified is not null then
    v_transition := 'restocked';
  end if;

  update public.events
  set price_from = case when v_price is not null then v_price else price_from end,
      availability_last_attempt_at = case
        when availability_last_attempt_at is null or v_attempted > availability_last_attempt_at
          then v_attempted
        else availability_last_attempt_at
      end,
      availability_status = case
        when v_status <> 'unknown'
          and (availability_verified_at is null or v_verified >= availability_verified_at)
          then v_status
        else availability_status
      end,
      availability_source = case
        when v_status <> 'unknown'
          and (availability_verified_at is null or v_verified >= availability_verified_at)
          then v_source
        else availability_source
      end,
      availability_evidence = case
        when v_status <> 'unknown'
          and (availability_verified_at is null or v_verified >= availability_verified_at)
          then v_evidence
        else availability_evidence
      end,
      availability_verified_at = case
        when v_status <> 'unknown'
          and (availability_verified_at is null or v_verified >= availability_verified_at)
          then v_verified
        else availability_verified_at
      end,
      source_checked_at = case
        when v_price is not null or v_status <> 'unknown' then
          greatest(coalesce(source_checked_at, '-infinity'::timestamptz),
                   coalesce(v_verified, v_attempted))
        else source_checked_at
      end,
      updated_at = now()
  where id = v_event_id;

  return jsonb_build_object(
    'status', 'applied',
    'event_id', v_event_id,
    'observation_id', v_observation_id,
    'transition', v_transition
  );
end
$$;

create or replace function public.radarrisas_archive_expired_events_v1()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  if coalesce(auth.jwt()->>'role', '') <> 'radarrisas_automation' then
    raise exception 'Acceso de automatización no autorizado' using errcode = '42501';
  end if;

  update public.events
  set archived_at = now(), updated_at = now()
  where archived_at is null
    and event_date < (now() at time zone 'America/Santiago')::date;

  get diagnostics v_count = row_count;
  return v_count;
end
$$;

revoke all on function public.radarrisas_ingest_candidate_v1(jsonb)
  from public, anon, authenticated, service_role;
revoke all on function public.radarrisas_apply_commercial_observation_v1(jsonb)
  from public, anon, authenticated, service_role;
revoke all on function public.radarrisas_archive_expired_events_v1()
  from public, anon, authenticated, service_role;

grant execute on function public.radarrisas_ingest_candidate_v1(jsonb)
  to radarrisas_automation;
grant execute on function public.radarrisas_apply_commercial_observation_v1(jsonb)
  to radarrisas_automation;
grant execute on function public.radarrisas_archive_expired_events_v1()
  to radarrisas_automation;

commit;

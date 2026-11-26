\set ON_ERROR_STOP on

insert into auth.users(id, email)
values
  ('00000000-0000-4000-8000-000000000098', 'automation@staging.invalid'),
  ('00000000-0000-4000-8000-000000000099', 'admin@staging.invalid');

insert into private.radarrisas_automation_principals(user_id, label)
values ('00000000-0000-4000-8000-000000000098', 'integration-test');

do $$
declare
  v_event jsonb;
begin
  v_event := public.radarrisas_custom_access_token_hook(jsonb_build_object(
    'user_id', '00000000-0000-4000-8000-000000000098',
    'claims', jsonb_build_object('role', 'authenticated')
  ));
  if v_event#>>'{claims,role}' <> 'radarrisas_automation' then
    raise exception 'Automation access token hook did not assign restricted role';
  end if;

  v_event := public.radarrisas_custom_access_token_hook(jsonb_build_object(
    'user_id', '00000000-0000-4000-8000-000000000099',
    'claims', jsonb_build_object('role', 'authenticated')
  ));
  if v_event#>>'{claims,role}' <> 'authenticated' then
    raise exception 'Access token hook changed a non-automation user';
  end if;
end
$$;

insert into public.events (
  id, slug, comedian, show, event_date, event_time, venue, comuna,
  price_from, ticket_provider, ticket_url, verified
) values
  ('00000000-0000-4000-8000-000000000001', 'evento-futuro', 'Artista',
   'Show', current_date + 10, '20:00', 'Teatro', 'Santiago', 10000,
   'Ticketplus', 'https://ticket.example/evento', true),
  ('00000000-0000-4000-8000-000000000002', 'evento-pasado', 'Artista Dos',
   'Show Pasado', current_date - 2, '20:00', 'Teatro Dos', 'Providencia',
   8000, 'PuntoTicket', 'https://ticket.example/pasado', true);

set role radarrisas_automation;
select set_config('request.jwt.claims', '{"role":"radarrisas_automation"}', false);

select public.radarrisas_ingest_candidate_v1(jsonb_build_object(
  'idempotency_key', 'candidate:fixture:1',
  'comedian', 'Nueva Comediante',
  'show', 'Nueva Función',
  'event_date', (current_date + 20)::text,
  'event_time', '21:00',
  'venue', 'Sala Test',
  'comuna', 'Ñuñoa',
  'price_from', 12000,
  'ticket_provider', 'Ticketplus',
  'ticket_url', 'https://ticket.example/nueva',
  'source_url', 'https://ticket.example/nueva'
));

select public.radarrisas_ingest_candidate_v1(jsonb_build_object(
  'idempotency_key', 'candidate:fixture:1',
  'comedian', 'Nueva Comediante',
  'show', 'Nueva Función',
  'event_date', (current_date + 20)::text,
  'event_time', '21:00',
  'venue', 'Sala Test',
  'comuna', 'Ñuñoa',
  'ticket_url', 'https://ticket.example/nueva',
  'source_url', 'https://ticket.example/nueva'
));

select public.radarrisas_apply_commercial_observation_v1(jsonb_build_object(
  'observation_key', 'observation:available:1',
  'event_id', '00000000-0000-4000-8000-000000000001',
  'provider', 'ticketplus',
  'source_url', 'https://ticket.example/evento',
  'price_from', 11000,
  'availability_status', 'available',
  'availability_source', 'ticketplus-html',
  'availability_evidence', jsonb_build_array('Comprar entradas'),
  'attempted_at', '2026-11-25T12:00:00Z',
  'verified_at', '2026-11-25T12:00:00Z'
));

-- Repeating the same observation must not duplicate history.
select public.radarrisas_apply_commercial_observation_v1(jsonb_build_object(
  'observation_key', 'observation:available:1',
  'event_id', '00000000-0000-4000-8000-000000000001',
  'provider', 'ticketplus',
  'availability_status', 'available',
  'availability_evidence', '[]'::jsonb,
  'attempted_at', '2026-11-25T12:00:00Z',
  'verified_at', '2026-11-25T12:00:00Z'
));

select public.radarrisas_apply_commercial_observation_v1(jsonb_build_object(
  'observation_key', 'observation:sold-out:1',
  'event_id', '00000000-0000-4000-8000-000000000001',
  'provider', 'ticketplus',
  'availability_status', 'sold_out',
  'availability_source', 'ticketplus-html',
  'availability_evidence', jsonb_build_array('Función agotada'),
  'attempted_at', '2026-11-25T13:00:00Z',
  'verified_at', '2026-11-25T13:00:00Z'
));

select public.radarrisas_apply_commercial_observation_v1(jsonb_build_object(
  'observation_key', 'observation:restock:1',
  'event_id', '00000000-0000-4000-8000-000000000001',
  'provider', 'ticketplus',
  'availability_status', 'available',
  'availability_source', 'ticketplus-html',
  'availability_evidence', jsonb_build_array('Comprar entradas'),
  'attempted_at', '2026-11-25T14:00:00Z',
  'verified_at', '2026-11-25T14:00:00Z'
));

-- A timeout records the attempt but cannot erase confirmed price/status.
select public.radarrisas_apply_commercial_observation_v1(jsonb_build_object(
  'observation_key', 'observation:timeout:1',
  'event_id', '00000000-0000-4000-8000-000000000001',
  'provider', 'ticketplus',
  'availability_status', 'unknown',
  'availability_evidence', '[]'::jsonb,
  'attempted_at', '2026-11-25T15:00:00Z',
  'error_code', 'timeout'
));

select public.radarrisas_archive_expired_events_v1();
reset role;

-- The legacy service-only RPC now performs the same logical archive and must
-- remain callable for backwards compatibility without deleting events.
set role service_role;
select public.archive_expired_events();
reset role;

do $$
begin
  if (select count(*) from public.event_candidates
      where discovery_key = 'candidate:fixture:1') <> 1 then
    raise exception 'Candidate ingestion is not idempotent';
  end if;

  if (select review_status from public.event_candidates
      where discovery_key = 'candidate:fixture:1') <> 'pending' then
    raise exception 'Manual approval flow was not preserved';
  end if;
end
$$;

-- The automation leaves the candidate pending; an authenticated admin can
-- still approve it using the pre-existing publication RPC.
insert into public.admin_users(user_id)
values ('00000000-0000-4000-8000-000000000099');
select id as candidate_id from public.event_candidates
where discovery_key = 'candidate:fixture:1' \gset
set role authenticated;
select set_config(
  'request.jwt.claims',
  '{"role":"authenticated","sub":"00000000-0000-4000-8000-000000000099"}',
  false
);
select public.publish_event_candidate(:'candidate_id');
reset role;

do $$
begin
  if not exists (
    select 1 from public.event_candidates
    where discovery_key = 'candidate:fixture:1'
      and review_status = 'approved'
      and published_event_id is not null
  ) then
    raise exception 'Existing manual approval RPC was not preserved';
  end if;

  if (select count(*) from public.event_commercial_observations
      where observation_key = 'observation:available:1') <> 1 then
    raise exception 'Commercial history is not idempotent';
  end if;

  if not exists (
    select 1 from public.events
    where id = '00000000-0000-4000-8000-000000000001'
      and price_from = 11000
      and availability_status = 'available'
      and sold_out is false
      and availability_verified_at = '2026-11-25T14:00:00Z'
      and availability_last_attempt_at = '2026-11-25T15:00:00Z'
  ) then
    raise exception 'Confirmed commercial state was not preserved after timeout';
  end if;

  if not exists (
    select 1 from public.events
    where id = '00000000-0000-4000-8000-000000000002'
      and archived_at is not null
  ) then
    raise exception 'Expired event was not archived in place';
  end if;

  if (select count(*) from public.events) <> 3 then
    raise exception 'Archiving deleted an event';
  end if;
end
$$;

select 'RadarRisas database integration tests passed' as result;

-- Minimal schema fixture derived from the 2026-11-25 production schema dump.
-- It contains no production data or credentials.

create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create role authenticator nologin;
create role supabase_auth_admin nologin;
grant anon, authenticated, service_role to authenticator;

create schema auth;
create table auth.users (
  id uuid primary key,
  email text
);
create or replace function auth.jwt()
returns jsonb
language sql
stable
set search_path = ''
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claims', true), ''),
    '{}'
  )::jsonb
$$;

create or replace function auth.uid()
returns uuid
language sql
stable
set search_path = ''
as $$
  select nullif(auth.jwt()->>'sub', '')::uuid
$$;

create table public.admin_users (
  user_id uuid primary key,
  created_at timestamptz not null default now()
);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  comedian text not null,
  show text not null,
  event_date date not null,
  event_time time not null,
  venue text not null,
  comuna text not null,
  price_from integer,
  ticket_provider text,
  ticket_url text,
  image_url text,
  featured boolean not null default false,
  sold_out boolean not null default false,
  verified boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  slug text not null,
  venue_address text,
  organizer text,
  source_url text,
  source_checked_at timestamptz
);

create unique index events_slug_unique on public.events(slug);
create unique index events_unique_performance on public.events (
  lower(btrim(comedian)), lower(btrim(show)), event_date, event_time,
  lower(btrim(venue))
);

create table public.event_candidates (
  id uuid primary key default gen_random_uuid(),
  comedian text,
  show text,
  event_date date,
  event_time time,
  venue text,
  venue_address text,
  comuna text,
  price_from integer,
  ticket_provider text,
  ticket_url text,
  source_url text,
  source_checked_at timestamptz,
  review_status text not null default 'pending'
    check (review_status in ('pending', 'approved', 'rejected', 'duplicate')),
  editorial_notes text,
  published_event_id uuid references public.events(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.events_archive (
  like public.events including defaults including constraints,
  archived_at timestamptz not null default now()
);

create or replace function public.publish_event_candidate(p_candidate_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_candidate public.event_candidates%rowtype;
  v_event_id uuid;
begin
  if auth.uid() is null or not exists (
    select 1 from public.admin_users where user_id = auth.uid()
  ) then
    raise exception 'Acceso administrativo no autorizado';
  end if;

  select * into v_candidate
  from public.event_candidates
  where id = p_candidate_id and review_status = 'pending'
  for update;

  if not found then raise exception 'El candidato no está pendiente'; end if;

  insert into public.events (
    comedian, show, event_date, event_time, venue, comuna, price_from,
    ticket_provider, ticket_url, verified, slug
  ) values (
    v_candidate.comedian, v_candidate.show, v_candidate.event_date,
    v_candidate.event_time, v_candidate.venue, v_candidate.comuna,
    v_candidate.price_from, v_candidate.ticket_provider,
    v_candidate.ticket_url, true, 'published-' || replace(v_candidate.id::text, '-', '')
  ) returning id into v_event_id;

  update public.event_candidates
  set review_status = 'approved', published_event_id = v_event_id, updated_at = now()
  where id = p_candidate_id;

  return v_event_id;
end
$$;

create or replace function public.archive_expired_events()
returns integer
language sql
set search_path = ''
as $$ select 0 $$;

create or replace function public.ingest_detected_candidate(p_candidate jsonb)
returns jsonb
language sql
set search_path = ''
as $$ select jsonb_build_object('status', 'fixture') $$;

alter table public.admin_users enable row level security;
alter table public.events enable row level security;
alter table public.event_candidates enable row level security;
alter table public.events_archive enable row level security;

create policy "Public can read verified events" on public.events
  for select to anon using (verified is true);
create policy "Authenticated read verified events" on public.events
  for select to authenticated using (verified is true);

grant usage on schema public, auth to anon, authenticated, service_role;
grant all on public.events to anon, authenticated, service_role;
grant all on public.event_candidates to service_role;
grant all on public.events_archive to service_role;
grant execute on function auth.jwt(), auth.uid() to public;
grant execute on function public.publish_event_candidate(uuid) to authenticated;
grant execute on function public.archive_expired_events() to service_role;
grant execute on function public.ingest_detected_candidate(jsonb)
  to authenticated, service_role;

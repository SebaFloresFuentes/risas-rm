-- Issue short-lived automation JWTs through Supabase Auth without exposing a
-- signing key or granting service_role. Only explicitly registered Auth users
-- receive the radarrisas_automation database role claim.

begin;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated,
  service_role, radarrisas_automation;

create table if not exists private.radarrisas_automation_principals (
  user_id uuid primary key references auth.users(id) on delete cascade,
  label text not null,
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);

alter table private.radarrisas_automation_principals enable row level security;
revoke all on table private.radarrisas_automation_principals
  from public, anon, authenticated, service_role, radarrisas_automation;

create or replace function public.radarrisas_custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_claims jsonb;
  v_user_id uuid;
begin
  v_user_id := nullif(event->>'user_id', '')::uuid;
  v_claims := coalesce(event->'claims', '{}'::jsonb);

  if v_user_id is not null and exists (
    select 1
    from private.radarrisas_automation_principals p
    where p.user_id = v_user_id and p.enabled is true
  ) then
    v_claims := jsonb_set(
      v_claims,
      '{role}',
      to_jsonb('radarrisas_automation'::text),
      true
    );
  end if;

  return jsonb_set(event, '{claims}', v_claims, true);
end
$$;

revoke all on function public.radarrisas_custom_access_token_hook(jsonb)
  from public, anon, authenticated, service_role, radarrisas_automation;
grant execute on function public.radarrisas_custom_access_token_hook(jsonb)
  to supabase_auth_admin;
grant usage on schema public, private to supabase_auth_admin;

commit;

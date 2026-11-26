-- Preserve the legacy RPC signature while replacing its broken delete-and-copy
-- implementation with the same non-destructive logical archive used by the
-- restricted automation RPC.

begin;

create or replace function public.archive_expired_events()
returns integer
language plpgsql
set search_path = ''
as $$
declare
  v_count integer;
begin
  update public.events
  set archived_at = now(), updated_at = now()
  where archived_at is null
    and event_date < (now() at time zone 'America/Santiago')::date;

  get diagnostics v_count = row_count;
  return v_count;
end
$$;

revoke all on function public.archive_expired_events()
  from public, anon, authenticated, radarrisas_automation;
grant execute on function public.archive_expired_events()
  to service_role;

commit;

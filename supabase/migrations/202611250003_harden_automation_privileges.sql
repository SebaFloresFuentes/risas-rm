-- Reconcile privileges after restoring the production baseline into a fresh
-- hosted project. Fresh Supabase projects may have broader default privileges
-- than the source project. This migration is idempotent and data-preserving.

begin;

alter default privileges for role postgres in schema public
  revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke all on sequences from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke all on functions from anon, authenticated;

revoke all on table public.admin_users from anon, authenticated;
grant select on table public.admin_users to authenticated;

revoke all on table public.event_candidates from anon, authenticated;
grant select, insert on table public.event_candidates to authenticated;
grant insert(comedian), update(comedian),
      insert(show), update(show),
      insert(event_date), update(event_date),
      insert(event_time), update(event_time),
      insert(venue), update(venue),
      insert(venue_address), update(venue_address),
      insert(comuna), update(comuna),
      insert(price_from), update(price_from),
      insert(ticket_provider), update(ticket_provider),
      insert(ticket_url), update(ticket_url),
      insert(source_url), update(source_url),
      insert(editorial_notes), update(editorial_notes),
      update(review_status)
  on table public.event_candidates to authenticated;

revoke insert, update, delete, truncate, references, trigger, maintain
  on table public.events from anon, authenticated;
grant select on table public.events to anon, authenticated;

revoke all on table public.events_archive from anon, authenticated;
revoke all on table public.event_commercial_observations from anon, authenticated;
revoke all on sequence public.event_commercial_observations_id_seq
  from anon, authenticated;

revoke all on function public.archive_expired_events()
  from public, anon, authenticated;
grant execute on function public.archive_expired_events() to service_role;

revoke all on function public.ingest_detected_candidate(jsonb)
  from public, anon;
grant execute on function public.ingest_detected_candidate(jsonb)
  to authenticated, service_role;

revoke all on function public.publish_event_candidate(uuid)
  from public, anon;
grant execute on function public.publish_event_candidate(uuid)
  to authenticated, service_role;

revoke all on function public.radarrisas_sync_event_sold_out_compatibility_v1()
  from public, anon, authenticated, service_role, radarrisas_automation;

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

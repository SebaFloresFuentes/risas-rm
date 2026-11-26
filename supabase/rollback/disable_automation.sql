-- Emergency production rollback. Apply only with explicit authorization.
-- It disables automated writes without dropping columns, history, or events.

begin;

update private.radarrisas_automation_principals
set enabled = false
where enabled is true;

revoke execute on function public.radarrisas_ingest_candidate_v1(jsonb)
  from radarrisas_automation;
revoke execute on function public.radarrisas_apply_commercial_observation_v1(jsonb)
  from radarrisas_automation;
revoke execute on function public.radarrisas_archive_expired_events_v1()
  from radarrisas_automation;

commit;

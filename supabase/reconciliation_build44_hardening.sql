-- Trigger invocation does not require client EXECUTE on its function.
revoke all on function public.capture_kb_account_observation() from public,anon,authenticated;
alter function public.get_reconciliation_case_timeline(uuid) security invoker;

create index if not exists position_observations_security on public.position_observations(security_id);
create index if not exists reconciliation_cases_security on public.reconciliation_cases(security_id);
create index if not exists reconciliation_case_notes_user on public.reconciliation_case_notes(user_id);

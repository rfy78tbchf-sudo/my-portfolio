-- The owner-only INSERT grant is needed by the SECURITY INVOKER RPC. Guard
-- direct Data API inserts as well: a claimed screenshot must actually exist.
drop policy account_total_observations_owner_upload on public.account_total_observations;
create policy account_total_observations_owner_upload on public.account_total_observations
  for insert to authenticated with check (
    verification_level='user_uploaded_unverified' and scope_evidence_id is null and
    component_state='account_total_only' and balance_effective_at is null and
    captured_at <= now()+interval '5 minutes' and
    storage_path is not null and source_reference='user_uploaded_isa:'||storage_path and
    exists(select 1 from public.accounts a where a.id=account_id
      and a.user_id=(select auth.uid()) and a.provider='kb_securities_manual'
      and a.provider_account_ref='isa-manual' and a.mode='live' and a.is_active) and
    exists(select 1 from storage.objects o
      where o.bucket_id='reconciliation-evidence' and o.name=storage_path)
  );

-- Qualify the outer Storage object name. Inside the accounts subquery an
-- unqualified name resolves to accounts.name and rejects the owner's upload.
drop policy isa_total_evidence_upload on storage.objects;
drop policy isa_total_evidence_read on storage.objects;
create policy isa_total_evidence_upload on storage.objects
  for insert to authenticated with check (
    bucket_id='reconciliation-evidence' and
    name ~ '^[0-9a-f-]{36}/isa/[0-9a-f]{64}\.(png|jpg|heic|heif)$' and
    exists(select 1 from public.accounts a
      where a.id::text=split_part(storage.objects.name,'/',1)
        and a.user_id=(select auth.uid()) and a.mode='live' and a.is_active
        and a.provider='kb_securities_manual' and a.provider_account_ref='isa-manual')
  );
create policy isa_total_evidence_read on storage.objects
  for select to authenticated using (
    bucket_id='reconciliation-evidence' and
    name ~ '^[0-9a-f-]{36}/isa/[0-9a-f]{64}\.(png|jpg|heic|heif)$' and
    exists(select 1 from public.accounts a
      where a.id::text=split_part(storage.objects.name,'/',1)
        and a.user_id=(select auth.uid()) and a.mode='live' and a.is_active
        and a.provider='kb_securities_manual' and a.provider_account_ref='isa-manual')
  );

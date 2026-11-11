create table if not exists public.reconciliation_case_notes (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.reconciliation_cases(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check(kind in('manual_statement','screenshot')),
  note text not null default '',
  storage_path text,
  created_at timestamptz not null default now(),
  check(length(note)<=1000),
  check(kind<>'screenshot' or storage_path is not null)
);
create index if not exists reconciliation_case_notes_case on public.reconciliation_case_notes(case_id,created_at);
alter table public.reconciliation_case_notes enable row level security;
create policy reconciliation_case_notes_read on public.reconciliation_case_notes for select to authenticated
  using(user_id=(select auth.uid()));
grant select on public.reconciliation_case_notes to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('reconciliation-evidence','reconciliation-evidence',false,5242880,
  array['image/png','image/jpeg','image/heic','image/heif'])
on conflict(id) do nothing;
create policy reconciliation_evidence_upload on storage.objects for insert to authenticated
  with check(bucket_id='reconciliation-evidence' and
    exists(select 1 from public.reconciliation_cases c
      join public.accounts a on a.id=c.account_id
      where c.id::text=(storage.foldername(storage.objects.name))[1] and a.user_id=(select auth.uid())));
create policy reconciliation_evidence_read on storage.objects for select to authenticated
  using(bucket_id='reconciliation-evidence' and
    exists(select 1 from public.reconciliation_cases c
      join public.accounts a on a.id=c.account_id
      where c.id::text=(storage.foldername(storage.objects.name))[1] and a.user_id=(select auth.uid())));

create or replace function public.add_reconciliation_case_note(
  p_case_id uuid,p_kind text,p_note text,p_storage_path text default null)
returns jsonb language plpgsql security definer set search_path='' as $function$
declare v_id uuid;v_user uuid:=(select auth.uid());
begin
  if v_user is null or not exists(select 1 from public.reconciliation_cases c
     join public.accounts a on a.id=c.account_id where c.id=p_case_id and a.user_id=v_user)
    then raise exception 'CASE_NOT_FOUND'; end if;
  if p_kind not in('manual_statement','screenshot') or length(coalesce(p_note,''))>1000 then
    raise exception 'INVALID_CASE_NOTE'; end if;
  if p_kind='screenshot' and (p_storage_path is null or
     split_part(p_storage_path,'/',1)<>p_case_id::text or
     not exists(select 1 from storage.objects o where o.bucket_id='reconciliation-evidence'
       and o.name=p_storage_path)) then raise exception 'SCREENSHOT_NOT_UPLOADED'; end if;
  insert into public.reconciliation_case_notes(case_id,user_id,kind,note,storage_path)
  values(p_case_id,v_user,p_kind,coalesce(p_note,''),p_storage_path) returning id into v_id;
  return jsonb_build_object('id',v_id,'saved',true);
end $function$;
revoke all on function public.add_reconciliation_case_note(uuid,text,text,text) from public,anon;
grant execute on function public.add_reconciliation_case_note(uuid,text,text,text) to authenticated;

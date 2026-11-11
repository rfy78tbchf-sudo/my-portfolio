-- One durable request ID across authentication, calculation, model response,
-- saved answer and reload. No prompt, credentials or account payload is logged.
create table if not exists public.ai_analysis_requests (
  user_id uuid not null,
  id uuid not null,
  state text not null default 'processing'
    check(state in ('processing','saved','model_failed','history_failed','context_failed')),
  analysis_id uuid,
  response_kind text,
  error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key(user_id,id)
);
alter table public.ai_analysis_requests enable row level security;
create policy ai_analysis_requests_owner_read on public.ai_analysis_requests
  for select to authenticated using(user_id=(select auth.uid()));
create policy ai_analysis_requests_owner_insert on public.ai_analysis_requests
  for insert to authenticated with check(user_id=(select auth.uid()));
create policy ai_analysis_requests_owner_update on public.ai_analysis_requests
  for update to authenticated using(user_id=(select auth.uid()))
    with check(user_id=(select auth.uid()));
grant select,insert,update on public.ai_analysis_requests to authenticated;
alter table public.ai_analysis_history add column if not exists request_id uuid;
create unique index if not exists ai_analysis_history_request_once
  on public.ai_analysis_history(user_id,request_id) where request_id is not null;

create or replace function public.reserve_ai_analysis_request(p_id uuid)
returns jsonb language plpgsql security invoker set search_path to '' as $fn$
declare v public.ai_analysis_requests%rowtype;v_inserted boolean:=false;
begin
  if (select auth.uid()) is null or p_id is null then raise exception 'authentication required'; end if;
  insert into public.ai_analysis_requests(user_id,id)
    values((select auth.uid()),p_id)
    on conflict(user_id,id) do nothing returning * into v;
  if v.id is not null then v_inserted:=true;
  else select * into v from public.ai_analysis_requests
    where user_id=(select auth.uid()) and id=p_id;end if;
  return jsonb_build_object('reserved',v_inserted,'state',v.state,
    'request_id',v.id,'analysis_id',v.analysis_id);
end $fn$;
revoke all on function public.reserve_ai_analysis_request(uuid) from public,anon;
grant execute on function public.reserve_ai_analysis_request(uuid) to authenticated;

create or replace function public.finish_ai_analysis_request(
  p_id uuid,p_state text,p_analysis_id uuid default null,
  p_response_kind text default null,p_error_code text default null)
returns boolean language plpgsql security invoker set search_path to '' as $fn$
declare v_count integer;
begin
  if (select auth.uid()) is null or p_state not in
    ('saved','model_failed','history_failed','context_failed') then
    raise exception 'invalid analysis state'; end if;
  update public.ai_analysis_requests set state=p_state,analysis_id=p_analysis_id,
    response_kind=left(p_response_kind,80),error_code=left(p_error_code,80),updated_at=now()
  where user_id=(select auth.uid()) and id=p_id and state='processing';
  get diagnostics v_count=row_count;
  return v_count=1;
end $fn$;
revoke all on function public.finish_ai_analysis_request(uuid,text,uuid,text,text) from public,anon;
grant execute on function public.finish_ai_analysis_request(uuid,text,uuid,text,text) to authenticated;

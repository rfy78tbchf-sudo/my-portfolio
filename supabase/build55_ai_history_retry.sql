-- Retain a completed model answer behind owner RLS until its history insert
-- succeeds. A retry inserts this answer; it never calls the model again.
alter table public.ai_analysis_requests add column if not exists generated_payload jsonb;
alter table public.ai_analysis_requests add column if not exists generated_at timestamptz;

create or replace function public.remember_ai_analysis_response(p_id uuid,p_payload jsonb)
returns boolean language plpgsql security invoker set search_path to '' as $fn$
declare v_count integer;
begin
  if (select auth.uid()) is null or p_id is null or p_payload is null
    or jsonb_typeof(p_payload)<>'object' or length(p_payload::text)>50000
    or coalesce(length(p_payload->>'answer'),0)<1
    or coalesce(length(p_payload->>'question'),0)<2 then
    raise exception 'invalid analysis response';
  end if;
  update public.ai_analysis_requests set generated_payload=p_payload,
    generated_at=now(),updated_at=now()
  where user_id=(select auth.uid()) and id=p_id and state='processing'
    and generated_payload is null;
  get diagnostics v_count=row_count;
  return v_count=1;
end $fn$;
revoke all on function public.remember_ai_analysis_response(uuid,jsonb) from public,anon;
grant execute on function public.remember_ai_analysis_response(uuid,jsonb) to authenticated;

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
    response_kind=left(p_response_kind,80),error_code=left(p_error_code,80),
    generated_payload=case when p_state='saved' then null else generated_payload end,
    updated_at=now()
  where user_id=(select auth.uid()) and id=p_id and
    (state='processing' or state='history_failed' and p_state='saved');
  get diagnostics v_count=row_count;
  return v_count=1;
end $fn$;
revoke all on function public.finish_ai_analysis_request(uuid,text,uuid,text,text) from public,anon;
grant execute on function public.finish_ai_analysis_request(uuid,text,uuid,text,text) to authenticated;

-- Holdings quantity only: complete account absence can establish zero, NOT pending cash.
create function public.batch_effective_273(a text,s text,c text,t timestamptz) returns numeric
language sql stable security invoker set search_path='' as $$
with b as(select public.batch_balance_273(a,s,c,t) j,public.read_batch_at_273(a,t) envelope)
select case when j->>'status'='complete_row' then (j->>'effective')::numeric
 when j->>'status'='complete_absent' and not exists(
 select 1 from jsonb_array_elements(envelope->'rows') r where r->>'symbol'=s)
 then 0 else null end from b
$$;
revoke all on function public.batch_effective_273(text,text,text,timestamptz) from public,anon;
grant execute on function public.batch_effective_273(text,text,text,timestamptz) to authenticated,service_role;

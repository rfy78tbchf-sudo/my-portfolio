-- Explicit rows only. Structural completeness does not prove absent positions are zero.
create function public.batch_effective_273(a text,s text,c text,t timestamptz) returns numeric
language sql stable security invoker set search_path='' as $$
select case when j->>'status'='complete_row' then (j->>'effective')::numeric else null end
from (select public.batch_balance_273(a,s,c,t) j) b
$$;
revoke all on function public.batch_effective_273(text,text,text,timestamptz) from public,anon;
grant execute on function public.batch_effective_273(text,text,text,timestamptz) to authenticated,service_role;

-- Build 211: let a returning draft recognize its already-saved request.
-- Keep the existing owner/security scope, history fields, limit and privileges.
create or replace function public.get_investment_decisions(p_security_id uuid)
returns jsonb language sql stable security invoker set search_path='' as $fn$
  select coalesce(jsonb_agg(to_jsonb(q) order by q.created_at desc),'[]'::jsonb)
  from (select d.id,d.security_id,d.request_id,d.choice,d.reason,d.review_condition,d.created_at,d.basis_at,
    d.thesis_version,d.analysis_id,d.official_evidence_snapshot,d.price_snapshot,
    d.account_snapshot,d.scenario_snapshot from public.investment_decisions d
    where d.user_id=(select auth.uid()) and d.security_id=p_security_id
    order by d.created_at desc limit 10) q;
$fn$;
revoke all on function public.get_investment_decisions(uuid) from public,anon;
grant execute on function public.get_investment_decisions(uuid) to authenticated;

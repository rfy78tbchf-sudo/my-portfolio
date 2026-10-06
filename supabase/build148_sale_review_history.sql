create or replace function public.get_sale_review(p_security_id uuid,p_start date,p_end date)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare v_user uuid:=(select auth.uid()); v_note jsonb; v_before jsonb; v_during jsonb; v_history jsonb;
begin
 if v_user is null then raise exception 'authentication required'; end if;
 if p_start is null or p_end is null or p_start>p_end then raise exception 'invalid review period'; end if;
 if not exists(select 1 from public.transactions t join public.accounts a on a.id=t.account_id where a.user_id=v_user and a.mode='live' and t.security_id=p_security_id and t.type='sell') then raise exception 'sale unavailable'; end if;
 select to_jsonb(r) into v_note from public.sale_reviews r where r.user_id=v_user and r.security_id=p_security_id and r.period_start=p_start and r.period_end=p_end;
 select jsonb_build_object('choice',d.choice,'reason',d.reason,'review_condition',d.review_condition,'created_at',d.created_at) into v_before from public.investment_decisions d where d.user_id=v_user and d.security_id=p_security_id and d.created_at<(p_start::timestamp at time zone 'Asia/Seoul') order by d.created_at desc limit 1;
 select coalesce(jsonb_agg(to_jsonb(q) order by q.created_at),'[]'::jsonb) into v_during from (select d.choice,d.reason,d.review_condition,d.created_at from public.investment_decisions d where d.user_id=v_user and d.security_id=p_security_id and d.created_at>=(p_start::timestamp at time zone 'Asia/Seoul') and d.created_at<((p_end+1)::timestamp at time zone 'Asia/Seoul') order by d.created_at desc limit 20) q;
 select coalesce(jsonb_agg(to_jsonb(q) order by q.updated_at desc),'[]'::jsonb) into v_history from (select r.period_start,r.period_end,r.reason,r.lesson,r.next_action,r.updated_at from public.sale_reviews r where r.user_id=v_user and r.security_id=p_security_id and (r.period_start<>p_start or r.period_end<>p_end) order by r.updated_at desc limit 20) q;
 return jsonb_build_object('ok',true,'security_id',p_security_id,'period_start',p_start,'period_end',p_end,'note',v_note,'before',v_before,'during',v_during,'history',v_history);
end $$;

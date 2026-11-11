create table public.sale_reviews (
 user_id uuid not null default auth.uid() references auth.users(id),
 security_id uuid not null references public.securities(id),
 period_start date not null,
 period_end date not null,
 reason text not null check(length(btrim(reason)) between 1 and 2000),
 lesson text not null check(length(btrim(lesson)) between 1 and 2000),
 next_action text not null check(length(btrim(next_action)) between 1 and 2000),
 revision integer not null default 1 check(revision>0),
 updated_at timestamptz not null default now(),
 primary key(user_id,security_id,period_start,period_end),
 check(period_start<=period_end)
);
alter table public.sale_reviews enable row level security;
revoke all on public.sale_reviews from public,anon,authenticated;
grant select,insert,update on public.sale_reviews to authenticated;
create policy sale_reviews_read on public.sale_reviews for select to authenticated using(user_id=(select auth.uid()));
create policy sale_reviews_insert on public.sale_reviews for insert to authenticated with check(user_id=(select auth.uid()));
create policy sale_reviews_update on public.sale_reviews for update to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create or replace function public.get_sale_review(p_security_id uuid,p_start date,p_end date)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare v_user uuid:=(select auth.uid()); v_note jsonb; v_before jsonb; v_during jsonb;
begin
 if v_user is null then raise exception 'authentication required'; end if;
 if p_start is null or p_end is null or p_start>p_end then raise exception 'invalid review period'; end if;
 if not exists(select 1 from public.transactions t join public.accounts a on a.id=t.account_id where a.user_id=v_user and a.mode='live' and t.security_id=p_security_id and t.type='sell') then raise exception 'sale unavailable'; end if;
 select to_jsonb(r) into v_note from public.sale_reviews r where r.user_id=v_user and r.security_id=p_security_id and r.period_start=p_start and r.period_end=p_end;
 select jsonb_build_object('choice',d.choice,'reason',d.reason,'review_condition',d.review_condition,'created_at',d.created_at) into v_before from public.investment_decisions d where d.user_id=v_user and d.security_id=p_security_id and d.created_at<(p_start::timestamp at time zone 'Asia/Seoul') order by d.created_at desc limit 1;
 select coalesce(jsonb_agg(to_jsonb(q) order by q.created_at),'[]'::jsonb) into v_during from (select d.choice,d.reason,d.review_condition,d.created_at from public.investment_decisions d where d.user_id=v_user and d.security_id=p_security_id and d.created_at>=(p_start::timestamp at time zone 'Asia/Seoul') and d.created_at<((p_end+1)::timestamp at time zone 'Asia/Seoul') order by d.created_at desc limit 20) q;
 return jsonb_build_object('ok',true,'security_id',p_security_id,'period_start',p_start,'period_end',p_end,'note',v_note,'before',v_before,'during',v_during);
end $$;
create or replace function public.save_sale_review(p_security_id uuid,p_start date,p_end date,p_reason text,p_lesson text,p_next_action text,p_revision integer)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare v_user uuid:=(select auth.uid()); v_row public.sale_reviews;
begin
 perform public.get_sale_review(p_security_id,p_start,p_end);
 if p_revision is null or p_revision<0 then raise exception 'invalid revision'; end if;
 if p_revision=0 then
  insert into public.sale_reviews(user_id,security_id,period_start,period_end,reason,lesson,next_action) values(v_user,p_security_id,p_start,p_end,btrim(p_reason),btrim(p_lesson),btrim(p_next_action)) on conflict do nothing returning * into v_row;
 else
  update public.sale_reviews set reason=btrim(p_reason),lesson=btrim(p_lesson),next_action=btrim(p_next_action),revision=revision+1,updated_at=now() where user_id=v_user and security_id=p_security_id and period_start=p_start and period_end=p_end and revision=p_revision returning * into v_row;
 end if;
 if v_row.user_id is null then raise exception 'review changed; reopen before saving'; end if;
 return jsonb_build_object('ok',true,'revision',v_row.revision);
end $$;
revoke all on function public.get_sale_review(uuid,date,date) from public,anon;
revoke all on function public.save_sale_review(uuid,date,date,text,text,text,integer) from public,anon;
grant execute on function public.get_sale_review(uuid,date,date),public.save_sale_review(uuid,date,date,text,text,text,integer) to authenticated;

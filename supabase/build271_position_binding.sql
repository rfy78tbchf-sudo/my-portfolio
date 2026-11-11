alter table public.kb_balance_position_evidence add column if not exists source_observation_id uuid references public.account_observations(id) on delete set null;
create index if not exists kb_balance_position_observation_idx on public.kb_balance_position_evidence(source_observation_id);
create or replace function public.save_kb_positions_for_response_for_service(p_user_id uuid,p_source_requested_at timestamptz,p_rows jsonb)
returns integer language plpgsql security definer set search_path='' as $function$
declare v_ids uuid[];v_account uuid;v_at timestamptz;r jsonb;k text;v_count integer:=0;
begin
 if (select auth.role()) is distinct from 'service_role' then raise exception 'SERVICE_ROLE_REQUIRED'; end if;
 if p_source_requested_at is null or jsonb_typeof(p_rows) is distinct from 'array' then raise exception 'INVALID_POSITION_RESPONSE'; end if;
 if jsonb_array_length(p_rows)>100 then raise exception 'INVALID_POSITION_RESPONSE'; end if;
  select array_agg(distinct o.id) into v_ids
  from public.account_observations o join public.accounts a on a.id=o.account_id
  join public.sync_logs l on l.account_id=a.id and l.started_at=o.fetched_at
  where a.user_id=p_user_id and a.mode='live' and a.provider='kb_securities'
  and l.scope='kb_current_snapshot' and l.status='success'
  and (l.detail->>'source_requested_at')::timestamptz=p_source_requested_at;
  if coalesce(cardinality(v_ids),0)<>1 then raise exception 'POSITION_RESPONSE_BINDING_UNAVAILABLE'; end if;

 select account_id,fetched_at into v_account,v_at from public.account_observations where id=v_ids[1];
 if (select count(*)<>count(distinct value->>'symbol') from jsonb_array_elements(p_rows)) then raise exception 'DUPLICATE_POSITION'; end if;
 for r in select value from jsonb_array_elements(p_rows) loop
  if coalesce(r->>'symbol','') !~ '^[A-Z0-9.]{1,12}$' then raise exception 'INVALID_POSITION'; end if;
  foreach k in array array['settled_quantity','effective_quantity','pending_buy_quantity','pending_sell_quantity'] loop
   if r->>k is null or (r->>k)::numeric::text in ('NaN','Infinity','-Infinity') or (r->>k)::numeric<0 then raise exception 'INCOMPLETE_POSITION'; end if;
  end loop;
  insert into public.kb_balance_position_evidence(account_id,symbol,observed_at,settled_quantity,effective_quantity,pending_buy_quantity,pending_sell_quantity,source_observation_id)
  values(v_account,r->>'symbol',v_at,(r->>'settled_quantity')::numeric,(r->>'effective_quantity')::numeric,(r->>'pending_buy_quantity')::numeric,(r->>'pending_sell_quantity')::numeric,v_ids[1])
  on conflict(account_id,symbol,observed_at) do nothing;
  if not exists(select 1 from public.kb_balance_position_evidence e where e.account_id=v_account and e.symbol=r->>'symbol' and e.observed_at=v_at
    and e.source_observation_id=v_ids[1] and e.settled_quantity=(r->>'settled_quantity')::numeric and e.effective_quantity=(r->>'effective_quantity')::numeric
    and e.pending_buy_quantity=(r->>'pending_buy_quantity')::numeric and e.pending_sell_quantity=(r->>'pending_sell_quantity')::numeric) then raise exception 'POSITION_RESPONSE_CONFLICT'; end if;
  v_count:=v_count+1;
 end loop;
 return v_count;
end $function$;
revoke all on function public.save_kb_positions_for_response_for_service(uuid,timestamptz,jsonb) from public,anon,authenticated;
grant execute on function public.save_kb_positions_for_response_for_service(uuid,timestamptz,jsonb) to service_role;

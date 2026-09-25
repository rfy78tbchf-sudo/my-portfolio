-- Federal Reserve H.10 DEXKOUS is an explicitly labelled historical proxy,
-- never the customer's actual broker conversion rate.
create or replace function public.upsert_historical_fx_for_service(p_rows jsonb)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  v_row jsonb;
  v_date date;
  v_rate numeric;
  v_count integer:=0;
begin
  if (select auth.role())<>'service_role' then raise exception 'service role required'; end if;
  if jsonb_typeof(p_rows)<>'array' or jsonb_array_length(p_rows)>500 then
    raise exception 'invalid FX batch';
  end if;
  for v_row in select value from jsonb_array_elements(p_rows) loop
    v_date:=(v_row->>'date')::date;
    v_rate:=(v_row->>'rate')::numeric;
    if v_date<'2020-01-01' or v_date>current_date or v_rate not between 500 and 3000 then
      raise exception 'invalid historical FX observation';
    end if;
    insert into public.fx_rates(rate_date,base_currency,quote_currency,rate,source,observed_at)
      values(v_date,'USD','KRW',v_rate,'fed_h10_dexkous_proxy',now())
    on conflict(rate_date,base_currency,quote_currency,source) do update
      set rate=excluded.rate,observed_at=now()
      where public.fx_rates.rate is distinct from excluded.rate;
    v_count:=v_count+1;
  end loop;
  return v_count;
end $$;
revoke all on function public.upsert_historical_fx_for_service(jsonb)
  from public,anon,authenticated;
grant execute on function public.upsert_historical_fx_for_service(jsonb)
  to service_role;

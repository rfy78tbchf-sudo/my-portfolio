-- Explicit broker statement rows only. No synthetic balancing transactions.
create or replace function public.import_kb_statement_rows(p_rows jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare v_user uuid:=(select auth.uid());v_account uuid;v_row jsonb;v_sid uuid;
  v_symbol text;v_market text;v_currency text;v_date date;v_type text;v_qty numeric;
  v_amount numeric;v_price numeric;v_fx numeric;v_fx_source text;
  v_ext text;v_existing int;v_inserted int:=0;
  v_duplicates int:=0;v_skipped int:=0;v_errors jsonb:='[]'::jsonb;
begin
  if v_user is null then raise exception 'authentication required'; end if;
  if jsonb_typeof(p_rows)<>'array' or jsonb_array_length(p_rows)>200 then
    raise exception 'invalid import batch size'; end if;
  select id into v_account from public.accounts where user_id=v_user and mode='live'
    and provider='kb_securities' and provider_account_ref='openapi-primary' limit 1;
  if v_account is null then raise exception 'no linked KB account'; end if;
  for v_row in select value from jsonb_array_elements(p_rows) loop
    begin
      v_symbol:=upper(trim(coalesce(v_row->>'symbol','')));
      v_market:=upper(trim(coalesce(v_row->>'market','')));
      v_currency:=upper(trim(coalesce(v_row->>'currency','')));
      v_type:=v_row->>'type';
      v_date:=(v_row->>'date')::date;
      v_ext:=trim(coalesce(v_row->>'external_id',''));
      v_qty:=nullif(v_row->>'quantity','')::numeric;
      v_price:=nullif(v_row->>'price','')::numeric;
      v_amount:=nullif(v_row->>'amount','')::numeric;
      if v_date<'2020-01-01' or v_date>current_date+1
        or v_type is null or v_type not in ('buy','sell','transfer_in','transfer_out','split_in','split_out',
          'dividend','deposit','withdrawal','fx','fee','tax','interest','corporate_in','corporate_out')
        or v_ext !~ '^KB:FILE:[0-9a-f]{64}:[0-9]{1,6}$'
        or v_currency not in ('KRW','USD')
        or (v_type in ('buy','sell','transfer_in','transfer_out','split_in','split_out',
          'corporate_in','corporate_out') and (v_symbol !~ '^[A-Z0-9.]{1,12}$' or v_qty is null or v_qty<=0))
        or (v_type in ('buy','sell') and (v_price is null or v_price<=0 or v_amount is null))
        or (v_type='dividend' and (v_amount is null or v_amount=0))
        or (v_type in ('deposit','withdrawal') and (v_amount is null or v_amount=0)) then
        raise exception 'invalid statement row'; end if;
      if v_symbol<>'' then
        if v_market not in ('KRX','NAS','NYS','AMX') then raise exception 'unknown market'; end if;
        select id into v_sid from public.securities
          where symbol=v_symbol and market=v_market limit 1;
        if v_sid is null then raise exception '종목코드 확인 필요'; end if;
      else v_sid:=null; end if;
      v_fx:=case when v_currency='KRW' then 1 else nullif(v_row->>'fx_rate','')::numeric end;
      v_fx_source:=case when v_currency='KRW' then 'native_currency'
        when v_fx is not null then 'kb_file_applied_rate' else null end;
      if v_currency='USD' and v_fx is null then
        select rate,source into v_fx,v_fx_source from public.fx_rates
          where base_currency='USD' and quote_currency='KRW'
            and rate_date between v_date-7 and v_date
          order by rate_date desc,case when source='kb_account_snapshot' then 0 else 1 end
          limit 1;
      end if;
      if (v_currency='USD' and v_fx is not null and (v_fx<500 or v_fx>3000)) then
        raise exception 'foreign exchange rate out of range'; end if;
      -- Compare with the official API by contents, not just the import file ID.
      -- A same-day identical pair may be two executions: ambiguous pairs are
      -- held for review instead of being inserted or silently deduplicated.
      if v_type in ('buy','sell') then
        select count(*) into v_existing from public.transactions t
        left join public.securities s on s.id=t.security_id
        where t.account_id=v_account and t.source in ('api','manual')
          and (t.trade_at at time zone 'Asia/Seoul')::date between v_date-2 and v_date+2
          and t.type=v_type
          and coalesce(s.isin,s.symbol)=coalesce((select isin from public.securities
            where id=v_sid),v_symbol)
          and abs(coalesce(t.quantity,0)-v_qty)<.0000001
          and abs(coalesce(t.price,0)-v_price)<.0001;
        if v_existing>0 then v_duplicates:=v_duplicates+1;continue;end if;
      elsif v_type in ('deposit','withdrawal') then
        select count(*) into v_existing from public.cash_flows f
        where f.account_id=v_account and f.source in ('api','manual') and f.type=v_type
          and (f.occurred_at at time zone 'Asia/Seoul')::date between v_date-2 and v_date+2
          and f.currency=v_currency and abs(abs(f.amount)-abs(v_amount))<.01;
        if v_existing>0 then v_duplicates:=v_duplicates+1;continue;end if;
      elsif v_type in ('dividend','fee','tax','interest','fx') then
        select count(*) into v_existing from public.transactions t
        where t.account_id=v_account and t.source in ('api','manual') and t.type=v_type
          and (t.trade_at at time zone 'Asia/Seoul')::date between v_date-2 and v_date+2
          and t.currency=v_currency and abs(abs(coalesce(t.net_amount,0))-abs(coalesce(v_amount,0)))<.01;
        if v_type='dividend' then
          select v_existing+count(*) into v_existing from public.dividends d
            where d.account_id=v_account and d.source in ('api','manual')
              and (d.paid_at at time zone 'Asia/Seoul')::date between v_date-2 and v_date+2
              and d.currency=v_currency
              and abs(abs(coalesce(d.net_amount,0))-abs(v_amount))<.01;
        end if;
        if v_existing>0 then v_duplicates:=v_duplicates+1;continue;end if;
      end if;
      insert into public.transactions(account_id,security_id,external_id,trade_at,type,
        quantity,price,gross_amount,fee,tax,net_amount,currency,fx_rate,
        source,provider_revision,provider_payload)
        values(v_account,v_sid,v_ext,(v_date::timestamp+interval '12 hours') at time zone 'Asia/Seoul',
          v_type,v_qty,v_price,v_amount,coalesce(nullif(v_row->>'fee','')::numeric,0),
          coalesce(nullif(v_row->>'tax','')::numeric,0),v_amount,v_currency,
          v_fx,
          'manual','KB_FILE',jsonb_build_object('statement_date',v_date,
            'statement_name',left(coalesce(v_row->>'name',''),100),
            'statement_description',left(coalesce(v_row->>'description',''),200),
            'file_digest',split_part(v_ext,':',3),'source_row',v_row->>'line',
            'fx_source',v_fx_source,'fx_estimated',v_currency='USD' and
              v_fx_source is distinct from 'kb_file_applied_rate'))
        on conflict(account_id,external_id) do nothing;
      if found then v_existing:=1;else v_existing:=0;end if;
      -- Monetary transfers must appear exactly once in the cash-flow ledger.
      if v_type in ('deposit','withdrawal') then
        insert into public.cash_flows(account_id,occurred_at,type,amount,currency,
          fx_rate_to_base,external_id,source)
        values(v_account,(v_date::timestamp+interval '12 hours') at time zone 'Asia/Seoul',
          v_type,case when v_type='withdrawal' then -abs(v_amount) else abs(v_amount) end,
          v_currency,v_fx,v_ext,'manual')
          on conflict(account_id,external_id) do nothing;
      end if;
      if v_type='dividend' and v_existing=1 then
        insert into public.dividends(account_id,security_id,paid_at,gross_amount,tax,
          net_amount,currency,fx_rate_to_base,external_id,source)
        values(v_account,v_sid,(v_date::timestamp+interval '12 hours') at time zone 'Asia/Seoul',
          null,coalesce(nullif(v_row->>'tax','')::numeric,0),v_amount,v_currency,v_fx,v_ext,'manual')
          on conflict(account_id,external_id) do nothing;
      end if;
      if v_existing=1 then v_inserted:=v_inserted+1;
      else v_duplicates:=v_duplicates+1;end if;
    exception when others then
      v_skipped:=v_skipped+1;
      v_errors:=v_errors||jsonb_build_object('line',v_row->>'line','reason',left(sqlerrm,140));
    end;
  end loop;
  return jsonb_build_object('inserted',v_inserted,'already_present',v_duplicates,
    'skipped',v_skipped,'errors',v_errors);
end $$;
revoke all on function public.import_kb_statement_rows(jsonb) from public,anon;
grant execute on function public.import_kb_statement_rows(jsonb) to authenticated;

-- Run with the SQL editor. The entire test rolls back, including the imported
-- statement row. No user holdings, account balances, or sources are changed.
begin;
do $$
declare v_user uuid; v_ext text := 'KB:FILE:' || repeat('a',64) || ':999901';
 v_symbol text;v_market text;v_row jsonb; v_first jsonb; v_second jsonb;
 v_recon jsonb; v_asof jsonb;
begin
 select user_id into v_user from public.accounts
   where provider='kb_securities' and mode='live' limit 1;
 if v_user is null then raise exception 'Test requires a KB live account'; end if;
 perform set_config('request.jwt.claim.sub',v_user::text,true);
 v_row:=jsonb_build_object('date','2025-06-03','type','deposit',
   'symbol','','market','KRX','currency','KRW','amount',123456789,
   'line','999901','external_id',v_ext);
 v_first:=public.import_kb_statement_rows(jsonb_build_array(v_row));
 v_second:=public.import_kb_statement_rows(jsonb_build_array(v_row));
 if (v_first->>'inserted')::int<>1 or (v_second->>'inserted')::int<>0 or
    (v_second->>'already_present')::int<>1 then
   raise exception 'Import is not idempotent: %, %',v_first,v_second;
 end if;
 if (select count(*) from public.cash_flows where external_id=v_ext)<>1 or
    (select count(*) from public.transactions where external_id=v_ext)<>1 or
    (select count(*) from public.transactions where external_id=v_ext and type='buy')<>0 then
   raise exception 'External deposit was duplicated or classified as an investment';
 end if;
 -- A USD transfer retains its original currency and evidenced FX conversion.
 v_row:=jsonb_build_object('date','2025-06-04','type','deposit',
   'symbol','','market','NAS','currency','USD','amount',987654,
   'fx_rate',1350.25,'line','999902',
   'external_id','KB:FILE:'||repeat('a',64)||':999902');
 v_first:=public.import_kb_statement_rows(jsonb_build_array(v_row));
 if (v_first->>'inserted')::int<>1 or
   (select count(*) from public.cash_flows where external_id=v_row->>'external_id'
      and currency='USD' and fx_rate_to_base=1350.25)<>1 then
   raise exception 'Foreign cash deposit lost its currency or original FX rate';
 end if;
 select s.symbol,s.market into v_symbol,v_market
   from public.holdings h join public.securities s on s.id=h.security_id
   where h.quantity>0 and s.currency='USD' limit 1;
 if v_symbol is null then raise exception 'No foreign security for import fixture'; end if;
 -- Income must enter the dividend source table exactly once as well as the
 -- transaction ledger. Never reinterpret it as an external deposit.
 v_row:=jsonb_build_object('date','2025-06-05','type','dividend',
   'symbol',v_symbol,'market',v_market,'currency','USD','amount',987654,
   'fx_rate',1350.25,'line','999903',
   'external_id','KB:FILE:'||repeat('a',64)||':999903');
 v_first:=public.import_kb_statement_rows(jsonb_build_array(v_row));
 if (v_first->>'inserted')::int<>1 or
    (select count(*) from public.dividends where external_id=v_row->>'external_id')<>1 then
   raise exception 'Imported dividend did not reach the income ledger';
 end if;
 v_row:=jsonb_build_object('date','2025-06-05','type','split_in',
   'symbol',v_symbol,'market',v_market,'currency','USD','quantity',1,
   'line','999904','external_id','KB:FILE:'||repeat('a',64)||':999904');
 v_first:=public.import_kb_statement_rows(jsonb_build_array(v_row));
 if (v_first->>'inserted')::int<>1 or
    (select count(*) from public.transactions
      where external_id=v_row->>'external_id' and type='split_in' and quantity=1)<>1 then
   raise exception 'Confirmed share movement was converted into a purchase';
 end if;
 v_recon:=public.get_live_reconciliation_report();
 if v_recon->'quantity_total' is null then raise exception 'Reconciliation failed'; end if;
 v_asof:=public.get_live_reconstructed_portfolio(current_date);
 if (v_asof->>'ok')::boolean and v_recon->>'quantity_unmatched'<>'0'
    and v_asof->>'total_assets_krw' is not null then
   raise exception 'Unverified account valuation was presented as a confirmed total';
 end if;
end $$;
rollback;

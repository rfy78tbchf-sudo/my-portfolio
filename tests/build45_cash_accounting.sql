-- Run as a single transaction. All fixture rows and changed status roll back.
begin;
do $test$
declare v_user uuid;v_account uuid;v_usd numeric;v_krw numeric;v_diff numeric;
begin
  select user_id into v_user from public.accounts where mode='live' limit 1;
  insert into public.accounts(user_id,provider,provider_account_ref,name,mode,is_active)
    values(v_user,'fixture','build45-'||gen_random_uuid(),'Cash bridge test','demo',false)
    returning id into v_account;
  insert into public.transactions(account_id,external_id,trade_at,type,currency,net_amount,fee,tax,provider_payload)
    values
    (v_account,'fixture:deposit','2026-01-02 03:00+00','deposit','KRW',1000,0,0,'{}'),
    (v_account,'fixture:withdraw','2026-01-02 03:00+00','withdrawal','KRW',-200,0,0,'{}'),
    (v_account,'fixture:buy','2026-01-02 03:00+00','buy','KRW',-502,2,0,'{}'),
    (v_account,'fixture:sell','2026-01-02 03:00+00','sell','KRW',310,2,0,'{}'),
    (v_account,'fixture:fx','2026-01-02 03:00+00','fx','KRW',-1300,0,0,
      '{"fcrncy_amt":"1.00","exch_r":"1300.0","crncy_clsf_nm":"USD"}'),
    (v_account,'fixture:dividend','2026-01-02 03:00+00','dividend','USD',0.50,0,0,'{}'),
    (v_account,'fixture:tax','2026-01-02 03:00+00','tax','USD',-0.10,0,0,'{}'),
    (v_account,'fixture:fee','2026-01-02 03:00+00','fee','KRW',-10,0,0,'{}'),
    (v_account,'fixture:interest','2026-01-02 03:00+00','interest','KRW',2,0,0,'{}'),
    (v_account,'fixture:ambiguous','2026-01-02 03:00+00','other','KRW',10000,0,0,'{"smry_nm":"대체출금"}');
  -- External flow is a second representation of the SAME deposit, not a
  -- second cash movement. The trade's net already includes its commission.
  insert into public.cash_flows(account_id,external_id,occurred_at,type,currency,amount)
    values(v_account,'fixture:deposit','2026-01-02 03:00+00','deposit','KRW',1000);
  insert into public.account_observations(account_id,balance_date,fetched_at,cash_krw)
    values(v_account,'2026-01-01','2026-01-01 05:00+00',10000),
          (v_account,'2026-01-02','2026-01-02 05:00+00',9300);
  select sum(amount) filter(where currency='KRW'),sum(amount) filter(where currency='USD')
    into v_krw,v_usd from public.live_cash_ledger_events
    where account_id=v_account;
  if v_krw<>-700 or v_usd<>1.40 then
    raise exception 'cash legs/costs/dedup wrong: KRW %, USD %',v_krw,v_usd;
  end if;
  select difference_krw into v_diff from public.live_cash_observation_bridges
    where account_id=v_account;
  if v_diff<>0 then raise exception 'matched accounting identity failed: %',v_diff; end if;
  update public.account_observations set cash_krw=9400
    where account_id=v_account and balance_date='2026-01-02';
  select difference_krw into v_diff from public.live_cash_observation_bridges
    where account_id=v_account;
  if v_diff<>100 then raise exception 'unexplained gap silently absorbed: %',v_diff; end if;
end $test$;
rollback;

-- Run as the database operator in one transaction. Every synthetic user,
-- account, analysis and judgment is rolled back. No owner's data is read.
begin;
do $fixture$
declare v_user uuid:=gen_random_uuid();v_account uuid;v_security uuid;
  v_symbol text:='T'||upper(substr(replace(v_user::text,'-',''),1,11));
  v_stamp timestamptz:='2026-09-27 08:00:00+00';
  v_comparison jsonb;v_metric jsonb;v_analysis uuid;
begin
  insert into auth.users(id,instance_id,aud,role)
    values(v_user,'00000000-0000-0000-0000-000000000000','authenticated','authenticated');
  insert into public.accounts(user_id,provider,name,mode,is_active)
    values(v_user,'kb_securities','Isolated decision test','live',true)
    returning id into v_account;
  insert into public.securities(symbol,name,market,currency)
    values(v_symbol,'Isolated price fixture','NASDAQ','USD')
    returning id into v_security;
  insert into public.daily_account_snapshots(account_id,snapshot_date,snapshot_at,total_assets,cash,securities_value)
    values(v_account,'2026-09-27',v_stamp,64000000,48880000,15120000);
  insert into public.sync_logs(account_id,started_at,finished_at,status,scope,detail)
    values(v_account,v_stamp,v_stamp,'success','kb_current_snapshot',
      '{"manual_overlay_assets":4000000}'::jsonb);
  insert into public.manual_subaccount_snapshots(user_id,subaccount_key,account_name,
    snapshot_date,snapshot_at,total_assets)
    values(v_user,'isolated-isa','Isolated ISA','2026-09-27',v_stamp,4000000);
  insert into public.holdings(account_id,security_id,as_of,quantity,currency,
    market_value,fx_rate_to_base,provider_payload)
    values(v_account,v_security,v_stamp,36,'USD',15120,1000,
      '{"krw_val_amt":"15120000"}'::jsonb);
  insert into public.investment_theses(user_id,security_id,version,rationale)
    values(v_user,v_security,1,'Synthetic price condition');
  perform set_config('request.jwt.claim.sub',v_user::text,true);
  v_metric:=public.get_live_decision_metrics(v_symbol,0);
  v_comparison:=public.get_live_choice_comparison(v_symbol,15,-10,10);
  if not coalesce((v_comparison->>'ok')::boolean,false) or
    v_comparison->'reduce'->>'mode'<>'integer_shares' then
    raise exception 'synthetic whole-share comparison unavailable: %',v_comparison;
  end if;
  insert into public.ai_analysis_history(user_id,question,answer,confidence,model,
    symbol,observation_at,thesis_version,account_basis,comparison_evidence)
    values(v_user,'Synthetic condition','Synthetic conditional analysis',
      'estimated','synthetic-test',v_symbol,v_stamp,1,
      jsonb_build_object('symbol',v_symbol,
        'position_value_krw',v_metric->'position'->'value',
        'denominator_value_krw',v_metric->'denominator'->'value',
        'kb_response_value',v_metric->'denominator'->'kb_response_value',
        'isa_total_value',v_metric->'denominator'->'manual_overlay',
        'scope_state',v_metric->'account_scope_state','quantity',36),
      jsonb_build_object('target_pct',15,'price_assumptions',v_comparison->'price_assumptions',
        'reduce',v_comparison->'reduce')) returning id into v_analysis;
  perform set_config('build59f.security_id',v_security::text,true);
  perform set_config('build59f.analysis_id',v_analysis::text,true);
  perform set_config('build59f.observation_at',v_stamp::text,true);
end $fixture$;

set local role authenticated;
do $check$
declare v_security uuid:=current_setting('build59f.security_id')::uuid;
  v_analysis uuid:=current_setting('build59f.analysis_id')::uuid;
  v_stamp timestamptz:=current_setting('build59f.observation_at')::timestamptz;
  v_request uuid:=gen_random_uuid();v_saved jsonb;v_replayed jsonb;
  v_history jsonb;v_raised boolean:=false;
begin
  v_saved:=public.save_investment_decision(v_security,'hold',
    'Synthetic weekend observation','Synthetic next closing price',
    v_analysis,v_request,15,-10,10,v_stamp);
  if (v_saved->>'ok')::boolean is distinct from true then raise exception 'save failed'; end if;
  select scenario_snapshot->'choice_comparison' into v_history
  from public.investment_decisions where id=(v_saved->>'id')::uuid;
  if v_history->'reduce'->>'mode'<>'integer_shares' or
     (v_history->'reduce'->>'shares_to_sell')::numeric<=0 then
    raise exception 'whole-share comparison missing from saved judgment';
  end if;
  v_replayed:=public.save_investment_decision(v_security,'hold',
    'Synthetic weekend observation','Synthetic next closing price',
    v_analysis,v_request,15,-10,10,v_stamp);
  if v_replayed->>'id' is distinct from v_saved->>'id' then
    raise exception 'retry duplicated a decision'; end if;
  begin
    perform public.save_investment_decision(v_security,'hold',
      'Synthetic weekend observation','Synthetic next closing price',
      v_analysis,gen_random_uuid(),14,-10,10,v_stamp);
  exception when others then
    if sqlerrm like '%account values changed; refresh analysis and comparison%'
      then v_raised:=true;else raise;end if;
  end;
  if not v_raised then raise exception 'changed comparison was accepted'; end if;
  if (select count(*) from public.investment_decisions where analysis_id=v_analysis)<>1 then
    raise exception 'rejected comparison left a judgment'; end if;
  raise notice 'Synthetic authenticated save, reopen, retry, stale scenario guard passed';
end $check$;
reset role;
rollback;

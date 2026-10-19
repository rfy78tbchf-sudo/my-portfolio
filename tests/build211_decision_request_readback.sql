-- Run as a database operator after Build 211 in one transaction.
-- These synthetic, already-committed judgments model a lost save response.
-- No real owner's rows, broker data or AI are used; all fixture rows roll back.
begin;
do $fixture$
declare
  v_owner uuid:=gen_random_uuid(); v_other uuid:=gen_random_uuid();
  v_security uuid; v_other_security uuid; v_decision uuid; v_other_decision uuid;
  v_request uuid:=gen_random_uuid(); v_other_request uuid:=gen_random_uuid();
  v_symbol text:='T'||upper(substr(replace(v_owner::text,'-',''),1,11));
begin
  insert into auth.users(id,instance_id,aud,role) values
    (v_owner,'00000000-0000-0000-0000-000000000000','authenticated','authenticated'),
    (v_other,'00000000-0000-0000-0000-000000000000','authenticated','authenticated');
  insert into public.securities(symbol,name,market,currency)
    values(v_symbol,'Isolated decision readback','NASDAQ','USD') returning id into v_security;
  insert into public.securities(symbol,name,market,currency)
    values(v_symbol||'B','Isolated second security','NASDAQ','USD') returning id into v_other_security;
  insert into public.investment_decisions(user_id,security_id,request_id,choice,reason,
    review_condition,scenario_snapshot) values(v_owner,v_security,v_request,'hold',
    'Synthetic saved reason','Synthetic next results',
    '{"choice_comparison":{"target_pct":15,"price_assumptions":{"down_pct":-10,"up_pct":10},"reduce":{"mode":"integer_shares","shares_to_sell":2}}}'::jsonb)
    returning id into v_decision;
  -- Request IDs are unique per owner, so deliberately share one across owners.
  insert into public.investment_decisions(user_id,security_id,request_id,choice,reason,
    review_condition) values(v_other,v_security,v_request,'revisit',
    'Synthetic other owner','Synthetic other checkpoint') returning id into v_other_decision;
  insert into public.investment_decisions(user_id,security_id,request_id,choice,reason,
    review_condition) values(v_owner,v_other_security,v_other_request,'pause_addition',
    'Synthetic other security','Synthetic second checkpoint');
  perform set_config('build211.owner',v_owner::text,true);
  perform set_config('build211.other',v_other::text,true);
  perform set_config('build211.security',v_security::text,true);
  perform set_config('build211.other_security',v_other_security::text,true);
  perform set_config('build211.decision',v_decision::text,true);
  perform set_config('build211.other_decision',v_other_decision::text,true);
  perform set_config('build211.request',v_request::text,true);
  perform set_config('build211.other_request',v_other_request::text,true);
  perform set_config('request.jwt.claim.sub',v_owner::text,true);
  if has_function_privilege('anon','public.get_investment_decisions(uuid)','execute')
    or not has_function_privilege('authenticated','public.get_investment_decisions(uuid)','execute')
    or (select prosecdef from pg_proc where oid='public.get_investment_decisions(uuid)'::regprocedure) then
    raise exception 'decision getter execution scope changed';
  end if;
end $fixture$;

set local role authenticated;
do $check$
declare
  v_rows jsonb; v_row jsonb;
  v_security uuid:=current_setting('build211.security')::uuid;
begin
  v_rows:=public.get_investment_decisions(v_security); v_row:=v_rows->0;
  if jsonb_array_length(v_rows)<>1
    or v_row->>'id' is distinct from current_setting('build211.decision')
    or v_row->>'security_id' is distinct from v_security::text
    or v_row->>'request_id' is distinct from current_setting('build211.request') then
    raise exception 'saved request is missing or readback escaped owner/security scope';
  end if;
  if v_row->>'reason' is distinct from 'Synthetic saved reason'
    or v_row->>'review_condition' is distinct from 'Synthetic next results'
    or v_row->'scenario_snapshot' is distinct from
      '{"choice_comparison":{"target_pct":15,"price_assumptions":{"down_pct":-10,"up_pct":10},"reduce":{"mode":"integer_shares","shares_to_sell":2}}}'::jsonb then
    raise exception 'decision reason, checkpoint or comparison changed in readback';
  end if;
  v_rows:=public.get_investment_decisions(current_setting('build211.other_security')::uuid);
  if jsonb_array_length(v_rows)<>1
    or v_rows->0->>'request_id' is distinct from current_setting('build211.other_request') then
    raise exception 'another security reused the first security readback';
  end if;
  perform set_config('request.jwt.claim.sub',current_setting('build211.other'),true);
  v_rows:=public.get_investment_decisions(v_security);
  if jsonb_array_length(v_rows)<>1
    or v_rows->0->>'id' is distinct from current_setting('build211.other_decision')
    or v_rows->0->>'request_id' is distinct from current_setting('build211.request') then
    raise exception 'second owner readback did not stay isolated';
  end if;
  if public.get_investment_decisions(current_setting('build211.other_security')::uuid)<>'[]'::jsonb then
    raise exception 'second owner can read first owner other security';
  end if;
  raise notice 'Build 211: authenticated request identity, saved content and owner/security isolation passed';
end $check$;
reset role;
rollback;

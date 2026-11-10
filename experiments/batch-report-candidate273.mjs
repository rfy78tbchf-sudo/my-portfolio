// Local-only composition: the actual report must establish coverage before inferring absent=0.
export function batchReportCandidate(sql){
 const once=(from,to)=>{if(sql.split(from).length!==2)throw new Error('report source drift');sql=sql.replace(from,to);};
 once('  v_account uuid;', '  v_account uuid;v_response jsonb;v_coverage boolean;');
 once('  v_date:=v_snap.snapshot_date;',`  v_date:=v_snap.snapshot_date;
  v_response:=public.read_batch_at_273(v_account::text,v_snap.snapshot_at);
  v_coverage:=coalesce((v_response->>'complete')::boolean,false)
    and (v_response->>'observed_at')::timestamptz=v_snap.snapshot_at;
  -- Compare both directions; a response cannot omit a live holding or silently
  -- include a position absent from the snapshot used by the report.
  if v_coverage then
    v_coverage:=not exists(select 1 from public.holdings h join public.securities s on s.id=h.security_id
      where h.account_id=v_account and (h.quantity is null or h.quantity<0
        or h.as_of is distinct from v_snap.snapshot_at
        or h.currency is distinct from s.currency
        or public.batch_effective_273(v_account::text,s.symbol,s.currency,v_snap.snapshot_at) is distinct from h.quantity))
      and not exists(select 1 from jsonb_array_elements(v_response->'rows') r
        where public.batch_effective_273(v_account::text,r->>'symbol',r->>'currency',v_snap.snapshot_at) is null
          or ((r->>'effective_quantity')::numeric>0 and
            (select sum(h.quantity) from public.holdings h join public.securities s on s.id=h.security_id
             where h.account_id=v_account and s.symbol=r->>'symbol' and s.currency=r->>'currency')
             is distinct from (r->>'effective_quantity')::numeric));
  end if;
  if v_coverage is not true then return jsonb_build_object('ok',false,
    'reason','QUANTITY_COVERAGE_UNVERIFIED','quantity_coverage_complete',false,
    'balance_at',v_snap.snapshot_at,'items','[]'::jsonb);end if;`);
 once("  return jsonb_build_object('ok',true,'checked_at',now(),'balance_date',v_date,",`  -- Alias/identity grouping must also agree with the selected response.
  if exists(select 1 from jsonb_array_elements(v_items) j
    left join public.securities s on s.id=(j->>'security_id')::uuid
    where public.batch_effective_273(v_account::text,j->>'symbol',s.currency,v_snap.snapshot_at)
      is distinct from (j->>'actual_qty')::numeric)
    or (select count(*)<>count(distinct j->>'asset_key') from jsonb_array_elements(v_items) j)
  then return jsonb_build_object('ok',false,'reason','QUANTITY_IDENTITY_UNVERIFIED',
    'quantity_coverage_complete',false,'balance_at',v_snap.snapshot_at,'items','[]'::jsonb);end if;
  return jsonb_build_object('ok',true,'quantity_coverage_complete',true,
    'quantity_response_id',v_response->'response_id',
    'data_version',md5(v_response::text||v_items::text),
    'checked_at',now(),'balance_date',v_date,`);
 return sql;
}

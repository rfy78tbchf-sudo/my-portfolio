// Local-only. The report producer must explicitly attest coverage; legacy reports do not.
export function batchResolutionGate(sql){
 const marker="  v_balance_date:=(v_report->>'balance_date')::date;";
 if(!sql.includes(marker))throw new Error('resolution gate source drift');
 sql=sql.replace(marker,`  -- Validate the entire report BEFORE any case mutation. Partial success is not coverage.
  if v_report->'quantity_coverage_complete' is distinct from 'true'::jsonb
    or jsonb_typeof(v_report->'items') is distinct from 'array'
    or nullif(v_report->>'balance_at','') is null then
    return jsonb_build_object('ok',false,'reason','QUANTITY_COVERAGE_UNVERIFIED');
  end if;
  for v_item in select value from jsonb_array_elements(v_report->'items') loop
    if jsonb_typeof(v_item->'actual_qty') is distinct from 'number'
      or jsonb_typeof(v_item->'ledger_qty_through_balance_day') is distinct from 'number'
      or jsonb_typeof(v_item->'difference_qty') is distinct from 'number' then
      return jsonb_build_object('ok',false,'reason','QUANTITY_FIELDS_INCOMPLETE');
    end if;
    select currency into v_currency from public.securities where id=nullif(v_item->>'security_id','')::uuid;
    v_delta:=public.batch_effective_273(v_account::text,v_item->>'symbol',v_currency,(v_report->>'balance_at')::timestamptz);
    if v_delta is null or (v_item->>'actual_qty')::numeric<0
      or abs(v_delta-(v_item->>'actual_qty')::numeric)>.000001
      or abs((v_item->>'actual_qty')::numeric-(v_item->>'ledger_qty_through_balance_day')::numeric-(v_item->>'difference_qty')::numeric)>.000001 then
      return jsonb_build_object('ok',false,'reason','QUANTITY_EVIDENCE_UNVERIFIED');
    end if;
  end loop;
`+marker);
 const start=sql.indexOf('        coalesce((select sum(p.quantity)');
 const end=sql.indexOf(' actual,',start);
 if(start<0||end<0)throw new Error('historical coverage source drift');
 sql=sql.slice(0,start)+`        public.batch_effective_273(v_account::text,v_item->>'symbol',v_currency,
          (select fetched_at from public.account_observations where id=o.id))`+sql.slice(end);
 const old="where c.account_id=v_account and c.status<>'resolved' and c.kb_quantity=0";
 if(!sql.includes(old))throw new Error('omitted case source drift');
 return sql.replace(old,old+`\n      and public.batch_effective_273(v_account::text,c.symbol,c.currency,(v_report->>'balance_at')::timestamptz)=0`);
}

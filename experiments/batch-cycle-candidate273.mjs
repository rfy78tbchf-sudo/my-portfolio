// Local-only: complete must mean the entire account response, not a page/currency subset.
export function batchCycleCandidate(sql){
 const start=sql.indexOf('  select exists(select 1 from public.kb_balance_position_evidence e');
 const end=sql.indexOf('  select coalesce(jsonb_agg(d.event_day',start);
 if(start<0||end<0||sql.slice(start,end).split('into v_').length!==3)throw new Error('cycle source drift');
 const zero=(bound,minDate,maxDate,target)=>`  select coalesce((b.j->>'complete')::boolean,false)
    and (b.j->>'observed_at')::timestamptz >= ${minDate}
    and (b.j->>'observed_at')::timestamptz < ${maxDate}
    and exists(select 1 from jsonb_array_elements(coalesce(b.j->'rows','[]'::jsonb)) r
      where r->>'symbol'=upper(trim(p_symbol)) and r->>'currency'=v_currency)
    and not exists(select 1 from jsonb_to_recordset(coalesce(b.j->'rows','[]'::jsonb))
      as r(symbol text,currency text,source text,effective_quantity numeric,settled_quantity numeric,pending_buy_quantity numeric,pending_sell_quantity numeric)
      where r.symbol=upper(trim(p_symbol)) and (
        r.currency is distinct from v_currency or r.source is distinct from 'SSQM2952'
        or r.effective_quantity is distinct from 0::numeric
        or r.settled_quantity is null or r.pending_buy_quantity is null or r.pending_sell_quantity is null
        or r.effective_quantity is distinct from r.settled_quantity+r.pending_buy_quantity-r.pending_sell_quantity))
    into ${target} from (select public.read_batch_at_273(v_account::text,${bound}) j) b;
`;
 return sql.slice(0,start)+zero("(v_first::timestamp at time zone 'Asia/Seoul')-interval '1 microsecond'","((v_first-1)::timestamp at time zone 'Asia/Seoul')","(v_first::timestamp at time zone 'Asia/Seoul')",'v_opening')+
 // Day-only ledger bounds cannot prove that a same-day zero was observed AFTER the sale.
 zero('now()',"((v_last+1)::timestamp at time zone 'Asia/Seoul')","now()+interval '1 microsecond'",'v_ending')+sql.slice(end);
}

// Local-only transformation of the operating period SQL. No production rollout.
export function batchOpeningCandidate(sql) {
 const old=`from positions p join public.kb_balance_position_evidence h on h.symbol=p.symbol
 join account a on a.id=h.account_id`;
 if(sql.split(old).length!==2)throw new Error('opening consumer source drift');
 return sql.replace(old,`from positions p cross join account a
 -- Pick one response within the opening valuation window BEFORE expanding rows.
 -- The upper bound is exclusive: next-session premarket belongs to another valuation.
 join lateral (select public.read_batch_at_273(a.id::text,
 least(p.cutoff,((p.start_date+time '04:00') at time zone 'America/New_York')-interval '1 microsecond')) envelope) batch on true
 join lateral (
 select r.*,(batch.envelope->>'observed_at')::timestamptz observed_at
 from jsonb_to_recordset(case when (batch.envelope->>'complete')::boolean is true
 then batch.envelope->'rows' else '[]'::jsonb end)
 as r(symbol text,currency text,source text,effective_quantity numeric,settled_quantity numeric,pending_buy_quantity numeric,pending_sell_quantity numeric)
 ) h on h.symbol=p.symbol and h.currency=p.currency`);
}

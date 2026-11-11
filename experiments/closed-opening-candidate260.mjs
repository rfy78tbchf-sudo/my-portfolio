// Local follow-up only: group pre-period quantity once, preserving the exact existing expression.
export function candidateSql(source){
 const old=`and 0=(select coalesce(sum(case when t.type in ('buy','split_in','transfer_in','corporate_in','broker_transfer_in') then t.quantity
 when t.type in ('sell','split_out','transfer_out','corporate_out','broker_transfer_out') then -t.quantity else coalesce(t.position_delta,0) end),0)
 from dated_transactions t join account a on a.id=t.account_id join keys k on k.id=t.security_id
 where k.asset_key=c.asset_key and (coalesce(t.effective_at,t.trade_at) at time zone 'Asia/Seoul')::date<c.start_date)`;
 const anchor='), closed_cycles as (';
 if(!source.includes(old)||source.split(anchor).length!==2)throw Error('closed source anchor drift');
 const cte=`), closed_opening_quantities as materialized (
 select k.asset_key,coalesce(sum(case when t.type in ('buy','split_in','transfer_in','corporate_in','broker_transfer_in') then t.quantity
 when t.type in ('sell','split_out','transfer_out','corporate_out','broker_transfer_out') then -t.quantity else coalesce(t.position_delta,0) end),0) quantity
 from dated_transactions t join account a on a.id=t.account_id join keys k on k.id=t.security_id cross join bounds b
 where (coalesce(t.effective_at,t.trade_at) at time zone 'Asia/Seoul')::date<b.start_date
 group by k.asset_key
`;
 return source.replace(anchor,cte+anchor).replace(old,'and 0=coalesce((select q.quantity from closed_opening_quantities q where q.asset_key=c.asset_key),0)');
}

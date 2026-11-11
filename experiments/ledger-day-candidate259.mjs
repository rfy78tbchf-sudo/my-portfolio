// Local candidate: retain typed daily trade records from the existing authorized scan.
// No JSON conversion, cross-request cache, financial logic or ordering changes.
export function candidateSql(source){
 const count="count(*) filter(where t.type='buy') buys,";
 if(source.split(count).length!==2)throw Error('daily aggregate anchor drift');
 let sql=source.replace(count,"array_agg(t) filter(where t.type in ('buy','sell')) trades,\n        "+count);
 const mixed=`select t.* from public.transactions t
          where t.account_id=v_account and t.security_id=v_security.id and t.type in ('buy','sell')
            and (coalesce(t.order_at,(v_dates->>t.id::text)::timestamptz,t.trade_at) at time zone 'Asia/Seoul')::date=v_day.d
          order by t.id`;
 const ordinary=`select t.* from public.transactions t
        where t.account_id=v_account and t.security_id=v_security.id
          and t.type in ('buy','sell')
          and (coalesce(t.order_at,(v_dates->>t.id::text)::timestamptz,t.trade_at) at time zone 'Asia/Seoul')::date=v_day.d
        order by t.trade_at,t.id`;
 if(!sql.includes(mixed)||!sql.includes(ordinary))throw Error('daily scan anchor drift');
 return sql.replace(mixed,'select t.* from unnest(v_day.trades) t order by t.id')
  .replace(ordinary,'select t.* from unnest(v_day.trades) t order by t.trade_at,t.id');
}

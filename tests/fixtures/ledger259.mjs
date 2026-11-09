// Deterministic synthetic history, reused by before/after tests; no production I/O.
export async function replaceLedger(db,securities,total=3000){
 const count=total/securities;
 if(!Number.isInteger(count)||count<=0||count%2)throw Error('positive even trades per security required');
 await db.exec(`delete from transactions;delete from fx_rates;
 insert into fx_rates(id,rate_date,base_currency,quote_currency,rate,source) select md5('fx'||n)::uuid,date '2026-11-09'-n,'USD','KRW',1400,'synthetic' from generate_series(0,3001) n;
 insert into transactions(id,account_id,security_id,type,trade_at,order_at,quantity,price,net_amount,fee,tax,currency,source,provider_payload)
 select md5(g||':'||n)::uuid,md5('a1')::uuid,md5('s'||g)::uuid,case when n%2=1 then 'buy' else 'sell' end,
 timestamptz '2026-11-09 09:00+09'-(${count}-n+1)*interval '1 day',timestamptz '2026-11-09 09:00+09'-(${count}-n+1)*interval '1 day',1,case when n%2=1 then 100 else 110 end,case when n%2=1 then -100 else 110 end,0,0,'USD','api',jsonb_build_object('dl_amt',case when n%2=1 then '100' else '110' end,'stnd_is_cd','US'||lpad(g::text,10,'0')) from generate_series(1,${securities}) g cross join generate_series(1,${count}) n;analyze;`);
}

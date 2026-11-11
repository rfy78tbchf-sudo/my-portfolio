with account as(select 'owner'::text id),bounds as(select '2026-10-01'::date start_date,'2026-10-14T00:00:00Z'::timestamptz cutoff),keys as(select * from jsonb_to_recordset('[{"id":"0","asset_key":"100001","symbol":"100001","name":"Fixture","currency":"KRW"},{"id":"1","asset_key":"100002","symbol":"100002","name":"Fixture","currency":"KRW"},{"id":"2","asset_key":"100003","symbol":"100003","name":"Fixture","currency":"KRW"},{"id":"3","asset_key":"100004","symbol":"100004","name":"Fixture","currency":"KRW"},{"id":"4","asset_key":"100005","symbol":"100005","name":"Fixture","currency":"KRW"},{"id":"5","asset_key":"100006","symbol":"100006","name":"Fixture","currency":"KRW"},{"id":"6","asset_key":"100007","symbol":"100007","name":"Fixture","currency":"KRW"}]') x(id text,asset_key text,symbol text,name text,currency text)),events as(select * from jsonb_to_recordset('[{"account_id":"owner","security_id":"0","source":"api","currency":"KRW","provider_event_id":"KB:SSQM2442:0","quantity":1,"provider_payload":{"trd_dl_ccd":"01","trd_dt":"20261010"},"realized_date":"2026-10-10"},{"account_id":"owner","security_id":"1","source":"api","currency":"KRW","provider_event_id":"KB:SSQM2442:1","quantity":1,"provider_payload":{"trd_dl_ccd":"01","trd_dt":"20261010"},"realized_date":"2026-10-10"},{"account_id":"other","security_id":"2","source":"api","currency":"KRW","provider_event_id":"KB:SSQM2442:2","quantity":1,"provider_payload":{"trd_dl_ccd":"01","trd_dt":"20261010"},"realized_date":"2026-10-10"},{"account_id":"owner","security_id":"3","source":"api","currency":"KRW","provider_event_id":"KB:SSQM2442:3","quantity":1,"provider_payload":{"trd_dl_ccd":"01","trd_dt":"20261101"},"realized_date":"2026-11-01"},{"account_id":"owner","security_id":"4","source":"api","currency":"KRW","provider_event_id":"KB:SSQM2442:4","quantity":1,"provider_payload":{"trd_dl_ccd":"01","trd_dt":"20261001"},"realized_date":"2026-10-10"},{"account_id":"owner","security_id":"5","source":"api","currency":"KRW","provider_event_id":"KB:SSQM2442:5","quantity":1,"provider_payload":{"trd_dl_ccd":"01","trd_dt":"20260901"},"realized_date":"2026-09-01"},{"account_id":"owner","security_id":"6","source":"manual","currency":"KRW","provider_event_id":"KB:SSQM2442:6","quantity":1,"provider_payload":{"trd_dl_ccd":"01","trd_dt":"20261010"},"realized_date":"2026-10-10"},{"account_id":"owner","security_id":"1","source":"api","currency":"KRW","provider_event_id":"KB:SSQM2442:1","quantity":1,"provider_payload":{"trd_dl_ccd":"01","trd_dt":"20261010"},"realized_date":"2026-10-10"}]') x(account_id text,security_id text,source text,currency text,provider_event_id text,quantity numeric,provider_payload jsonb,realized_date date)),calculated_reference_items as(select '{"symbol":"A100001","aliases":["100001","A100001"],"pnl_krw":100,"pnl_local":100}'::jsonb item), official_only_candidates as materialized (
 select distinct on (k.asset_key) k.id,k.asset_key,k.symbol,k.name,k.currency
 from events e join account a on a.id=e.account_id
 join keys k on k.id=e.security_id cross join bounds b
 where e.source='api' and e.currency='KRW' and k.currency='KRW'
 and e.provider_event_id like 'KB:SSQM2442:%' and e.quantity>0
 and e.provider_payload->>'trd_dl_ccd' in ('01','02')
 and to_char(e.realized_date,'YYYYMMDD')=trim(e.provider_payload->>'trd_dt')
 and e.realized_date between b.start_date and (b.cutoff at time zone 'Asia/Seoul')::date
 and not exists(select 1 from calculated_reference_items c where
   regexp_replace(c.item->>'symbol','^A([0-9][A-Z0-9]{5})$','\1')=k.asset_key
   or exists(select 1 from jsonb_array_elements_text(coalesce(c.item->'aliases','[]'::jsonb)) z(alias)
     where regexp_replace(z.alias,'^A([0-9][A-Z0-9]{5})$','\1')=k.asset_key))
 order by k.asset_key,k.id
), reference_items as materialized (
 select item from calculated_reference_items
 union all
 select jsonb_build_object('security_id',id,'symbol',symbol,'name',name,'currency',currency,
 'aliases',jsonb_build_array(asset_key,'A'||asset_key),
 'pnl_krw',null,'pnl_local',null,'reason','결제 원장 연결 확인 필요',
 'official_only',true,'provisional_amount',true,'trade_count',0,'pending_count',0)
 from official_only_candidates
) select count(*)=2 and count(*) filter(where item->>'official_only'='true')=1 and sum((item->>'pnl_krw')::numeric)=100 passed from reference_items;
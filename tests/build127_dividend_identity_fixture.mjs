import fs from 'node:fs';
const sql=fs.readFileSync('supabase/build127_distribution_cash.sql','utf8');
const cte=sql.slice(sql.indexOf('dividend_receipts as materialized ('),sql.indexOf('), dividends as ('))+')';
const cases=['valid','wrong_amount','wrong_date','wrong_currency','duplicate','wrong_isin','manual'];
const ds=[],ts=[],keys=[];
for(const name of cases){
 ds.push({id:name,account_id:'account',security_id:name+'_stale',external_id:name,source:'api',currency:'USD',paid_at:'2025-01-01T03:00:00Z',net_amount:10});
 keys.push({id:name+'_correct',currency:'USD',asset_key:'ISIN_'+name});
 const t={account_id:'account',security_id:name+'_correct',external_id:name,source:'api',type:'dividend',currency:'USD',trade_at:'2025-01-01T03:00:00Z',net_amount:10,provider_payload:{stnd_is_cd:'ISIN_'+name}};
 if(name==='wrong_amount')t.net_amount=9;
 if(name==='wrong_date')t.trade_at='2025-01-02T03:00:00Z';
 if(name==='wrong_currency')t.currency='KRW';
 if(name==='wrong_isin')t.provider_payload.stnd_is_cd='DIFFERENT';
 if(name==='manual')t.source='manual';
 ts.push(t);if(name==='duplicate')ts.push(t);
}
const rec=(n,v,f)=>`${n} as(select * from jsonb_to_recordset('${JSON.stringify(v)}'::jsonb) x(${f}))`;
console.log('with '+["account as(select 'account'::text id)",rec('fixture_dividends',ds,'id text,account_id text,security_id text,external_id text,source text,currency text,paid_at timestamptz,net_amount numeric'),rec('owned_transactions',ts,'account_id text,security_id text,external_id text,source text,type text,currency text,trade_at timestamptz,net_amount numeric,provider_payload jsonb'),rec('keys',keys,'id text,currency text,asset_key text'),cte.replace('public.dividends','fixture_dividends')].join(',')+" select count(*) cases,count(*) filter(where resolved_security_id<>case when id='valid' then id||'_correct' else id||'_stale' end) failures from dividend_receipts;");

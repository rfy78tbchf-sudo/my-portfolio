import fs from 'node:fs';
import assert from 'node:assert/strict';
const sql=fs.readFileSync('supabase/build136_security_currency.sql','utf8');
const start=sql.indexOf('currency=case when v_item');
const expression=sql.slice(start+'currency='.length,sql.indexOf(',\n        country=',start))
 .replaceAll("v_item->>'type'",'event_type').replaceAll('excluded.currency','event_currency').replaceAll('public.securities.currency','previous_currency');
assert.ok(expression.includes("('buy','sell')"));
console.log(`with cases(event_type,event_currency,previous_currency,expected) as (values
('tax','KRW','USD','USD'),('dividend','USD','USD','USD'),('fee','KRW','USD','USD'),
('other','KRW','USD','USD'),('buy','USD','KRW','USD'),('sell','USD','KRW','USD'),
('buy','KRW','KRW','KRW'),('tax','KRW','JPY','JPY'))
select count(*) cases,count(*) filter(where (${expression}) is distinct from expected) failures from cases;`);

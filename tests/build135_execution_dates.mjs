import fs from 'node:fs';
const sql=fs.readFileSync('supabase/build135_preserve_execution_evidence.sql','utf8');
const match=sql.slice(sql.indexOf('with candidates as ('),sql.indexOf('  ) update public.transactions t')+3).replaceAll('public.transactions','tx').replaceAll('public.kb_position_evidence','ev').replace('t.account_id=v_account','t.account_id=1');
const tx=[],ev=[],expected=[];
function add(id,tChange={},eChange={},want=false){
const isin='US'+String(id).padStart(10,'0');
const t={id,account_id:1,source:'api',provider_revision:'SWQA2301',currency:'USD',type:'buy',quantity:2,price:100,trade_at:'2026-10-01T00:00:00+09:00',order_at:null,settlement_at:null,provider_payload:{stnd_is_cd:isin,dl_dt:'20261001',dl_amt:'200'},...tChange};
const e={id,account_id:1,source:'SPQM2205',active:true,currency:'USD',asset_key:isin,event_type:'buy',quantity:2,price:100,order_date:'2026-09-29',settlement_date:'2026-10-01',evidence:{source:'SPQM2205',occurrences:1,trade_gross:200,order_date:'2026-09-29',settlement_date:'2026-10-01'},...eChange};tx.push(t);ev.push(e);expected.push({id,want});return {t,e};
}
add(1,{}, {},true);
add(2,{type:'sell'},{event_type:'sell'},true);
const a=add(3);ev.push({...a.e,id:103});
const b=add(4);tx.push({...b.t,id:104});expected.push({id:104,want:false});
add(5,{}, {account_id:2});add(6,{}, {quantity:3});add(7,{}, {price:101});
add(8,{}, {active:false});add(9,{currency:'KRW'});add(10,{source:'manual'});
add(11,{}, {source:'OTHER'});add(12,{order_at:'2026-09-28T00:00:00Z'});
add(13,{settlement_at:'2026-09-30T00:00:00Z'});
const c=add(14);c.e.evidence.occurrences=2;
const d=add(15);d.e.evidence.trade_gross=201;
const f=add(16);f.e.evidence.order_date='2026-09-28';
const g=add(17);g.t.provider_payload.dl_dt='20260930';
const h=add(18);h.t.provider_payload.dl_amt='bad';
const i=add(19);i.e.evidence.trade_gross='bad';
const j=add(20);j.e.order_date='2026-09-01';j.e.evidence.order_date='2026-09-01';
const k=add(21);k.e.evidence.occurrences=undefined;
const l=add(22);tx.push({...l.t,id:122,order_at:'2026-09-29T00:00:00Z'});expected.push({id:122,want:false});
const q=x=>"'"+JSON.stringify(x).replaceAll("'","''")+"'::jsonb";
process.stdout.write(`with tx as (select * from jsonb_to_recordset(${q(tx)}) as t(id int,account_id int,source text,provider_revision text,currency text,type text,quantity numeric,price numeric,trade_at timestamptz,order_at timestamptz,settlement_at timestamptz,provider_payload jsonb)), ev as (select * from jsonb_to_recordset(${q(ev)}) as e(id int,account_id int,source text,active boolean,currency text,asset_key text,event_type text,quantity numeric,price numeric,order_date date,settlement_date date,evidence jsonb)), `+match.slice(5)+`, actual as(select t.id from tx t join unique_pairs p on p.transaction_id=t.id where t.order_at is null and (t.settlement_at is null or (t.settlement_at at time zone 'Asia/Seoul')::date=p.settlement_date)), expected as(select * from jsonb_to_recordset(${q(expected)}) as e(id int,want boolean)) select count(*) tests,count(*) filter(where e.want is distinct from (a.id is not null)) failures from expected e left join actual a using(id);`);

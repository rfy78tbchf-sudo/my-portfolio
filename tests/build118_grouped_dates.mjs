// Read-only SQL fixtures execute the actual production matching CTEs.
import fs from 'node:fs';
const source=fs.readFileSync('supabase/build118_grouped_execution_dates.sql','utf8');
const matcher=source.slice(source.indexOf('), domestic_date_candidates'),source.indexOf('), bounds as (')).replaceAll('public.realized_pnl_events','fixture_evidence');
const tx=[],ev=[],expected=[];let sequence=1;
function group(tag,configure=()=>{}){
 const isin='KR'+String(tag).padStart(10,'0');
 const ts=[100,120].map(price=>({id:sequence++,account_id:1,type:'buy',currency:'KRW',quantity:1,price,source:'api',trade_at:'2026-10-01T03:00:00Z',order_at:null,provider_payload:{stnd_is_cd:isin,dl_amt:String(price),dl_dt:'20261001'}}));
 const r={id:sequence++,account_id:1,source:'api',currency:'KRW',quantity:2,sell_price:110,buy_amount:220,sell_amount:0,realized_date:'2026-09-29',provider_event_id:'KB:SSQM2442:fixture:'+tag,provider_payload:{stnd_is_cd:isin,trd_dl_ccd:'02',trd_dt:'20260929'}};
 const state={ts,rs:[r],want:['2026-09-29','2026-09-29'],at:[null,null]};configure(state,r);
 tx.push(...state.ts);ev.push(...state.rs);
 state.ts.forEach((t,i)=>expected.push({id:t.id,recovered:state.want[i]??null,existing_at:state.at[i]??null}));
}
group(1);
group(2,({ts},r)=>{ts.forEach(t=>t.type='sell');r.sell_amount=220;r.buy_amount=180;r.provider_payload.trd_dl_ccd='01';});
group(3,(s,r)=>{s.rs.push({...r,id:sequence++,quantity:1,sell_price:100,buy_amount:100});}); // Partial and cumulative evidence coexist.
group(4,(s,r)=>{s.rs.push({...r,id:sequence++});s.want=[];}); // Duplicate aggregate.
group(5,(s,r)=>{r.buy_amount=221;s.want=[];});
group(6,(s,r)=>{r.quantity=3;s.want=[];});
group(7,(s,r)=>{r.account_id=2;s.want=[];});
group(8,(s,r)=>{r.provider_payload.trd_dl_ccd='01';s.want=[];});
group(9,s=>{s.ts[0].order_at='2026-09-28T01:23:00Z';s.at[0]=s.ts[0].order_at;s.want=[];});
group(10,s=>{s.ts.push({...s.ts[0],id:sequence++});s.want=[];});
group(11,s=>{s.ts.push(...s.ts.map(t=>({...t,id:sequence++,trade_at:'2026-10-02T03:00:00Z',provider_payload:{...t.provider_payload,dl_dt:'20261002'}})));s.want=[];}); // One aggregate for two day groups.
group(12,s=>{s.ts.push({...s.ts[0],id:sequence++,quantity:2,price:110,trade_at:'2026-10-02T03:00:00Z',provider_payload:{...s.ts[0].provider_payload,dl_amt:'220',dl_dt:'20261002'}});s.want=[];}); // Evidence cannot serve a single record AND another group.
group(13,s=>{s.ts[0].provider_payload.dl_amt='bad';s.want=[];});
group(14,s=>{s.ts[0].price=101;s.want=[];});
group(15,(s,r)=>{s.ts[1].price=101;s.ts[1].provider_payload.dl_amt='101';r.buy_amount=201;r.sell_price=101;}); // Rounded aggregate price.
group(16,(s,r)=>{r.realized_date='2026-10-02';r.provider_payload.trd_dt='20261002';s.want=[];});
group(17,s=>{s.ts.forEach(t=>t.currency='USD');s.want=[];});
group(18,(s,r)=>{r.sell_price=115;s.want=[];});
group(19,s=>{s.ts[0].source='manual';s.want=[];});
const q=x=>"'"+JSON.stringify(x).replaceAll("'","''")+"'::jsonb";
process.stdout.write(`with owned_transactions as (select * from jsonb_to_recordset(${q(tx)}) as t(id int,account_id int,type text,currency text,quantity numeric,price numeric,source text,trade_at timestamptz,order_at timestamptz,provider_payload jsonb)), fixture_evidence as (select * from jsonb_to_recordset(${q(ev)}) as r(id int,account_id int,source text,currency text,quantity numeric,sell_price numeric,buy_amount numeric,sell_amount numeric,realized_date date,provider_event_id text,provider_payload jsonb)`+matcher+`), expected as (select * from jsonb_to_recordset(${q(expected)}) as e(id int,recovered date,existing_at timestamptz)) select count(*) checked_rows, bool_and(d.recovered_date is not distinct from e.recovered) dates_correct, bool_and(case when e.existing_at is not null then d.effective_at=e.existing_at else true end) known_times_preserved, array_agg(d.id) filter(where d.recovered_date is distinct from e.recovered) failed_ids from expected e join dated_transactions d using(id);`);

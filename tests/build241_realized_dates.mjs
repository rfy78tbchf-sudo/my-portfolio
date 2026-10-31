import assert from 'node:assert/strict';
import fs from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
const db=new PGlite();
const source=fs.readFileSync('supabase/build241_realized_dates.sql','utf8');
const candidate=source.replace("v_today date := (now() at time zone 'Asia/Seoul')::date", "v_today date := date '2030-01-10'");
const baseline=candidate.replace(/  -- BEGIN recovered-date projection[\s\S]*?  -- END recovered-date projection/, '').replaceAll('(v_dates->>t.id::text)::timestamptz,','').replaceAll('(v_dates->>v_trade.id::text)::timestamptz,','').replaceAll(' and not (v_dates ? v_trade.id::text)','');
const ui={};
const id=n=>'00000000-0000-0000-0000-'+String(n).padStart(12,'0');
const user=id(1),account=id(2),security=id(3),other=id(4);
await db.exec(fs.readFileSync('tests/fixtures/pnl_schema.sql','utf8'));
await db.exec(`create schema auth; create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create function public.get_live_period_stock_pnl(text) returns jsonb language sql as $$select '{"items":[]}'::jsonb$$;`);
await db.query("select set_config('request.jwt.claim.sub',$1,false)",[user]);
async function insert(table,row){const keys=Object.keys(row);await db.query(`insert into ${table} (${keys.join(',')}) values (${keys.map((_,i)=>'$'+(i+1)).join(',')})`,Object.values(row));}
let seq;
async function reset(){await db.exec('truncate transactions,realized_pnl_events,accounts,securities,kb_position_evidence,holdings,fx_rates');seq=10;
 await insert('accounts',{id:account,user_id:user,provider:'kb_securities',mode:'live',is_active:true,created_at:'2029-01-01'});
 await insert('securities',{id:security,symbol:'SYNTH',name:'Synthetic',currency:'KRW'});
}
async function trade(type,day,qty,price,extra={}){const row={id:id(seq++),account_id:account,security_id:security,type,trade_at:day+'T00:00:00+09:00',quantity:qty,price,net_amount:(type==='buy'?-1:1)*qty*price,fee:0,tax:0,currency:'KRW',source:'api',provider_payload:{dl_dt:day.replaceAll('-',''),stnd_is_cd:'KR0000000001',dl_amt:String(qty*price)},...extra};await insert('transactions',row);return row;}
async function evidence(t,day,extra={}){const row={id:id(seq++),account_id:account,security_id:security,provider_event_id:'KB:SSQM2442:synthetic:'+seq,source:'api',currency:'KRW',quantity:t.quantity,sell_price:t.price,buy_amount:t.type==='buy'?t.quantity*t.price:0,sell_amount:t.type==='sell'?t.quantity*t.price:0,realized_date:day,provider_payload:{stnd_is_cd:'KR0000000001',trd_dt:day.replaceAll('-',''),trd_dl_ccd:t.type==='buy'?'02':'01'},...extra};await insert('realized_pnl_events',row);return row;}
async function run(period='1W',acct=null){return (await db.query('select public.get_live_realized_sales($1,$2) r',[period,acct])).rows[0].r;}
async function version(sql){await db.exec(sql);}
await reset();await trade('buy','2030-01-01',2,100);const outside=await trade('sell','2030-01-05',1,120);await evidence(outside,'2030-01-03');
await version(baseline);ui.outsideBefore=await run();assert.equal(ui.outsideBefore.items.length,1,'before: settlement-date sale leaks into current week');
await version(candidate);ui.outsideAfter=await run();assert.equal(ui.outsideAfter.items.length,0,'after: proven execution date excludes it');assert.equal((await run('THIS_MONTH')).items.length,1,'sale is not deleted');
assert.equal((await db.query('select order_at from transactions where id=$1',[outside.id])).rows[0].order_at,null,'stored ledger untouched');

await reset();const buy=await trade('buy','2030-01-05',2,100),sell=await trade('sell','2030-01-05',1,120);await evidence(buy,'2030-01-02');await evidence(sell,'2030-01-04');
await version(baseline);assert.equal((await run()).items[0].status,'order_unverified');
await version(candidate);let r=await run();ui.calculated=r;assert.equal(r.items[0].status,'calculated');assert.equal(r.items[0].realized_local,20);assert.equal(r.items[0].trade_date,'2030-01-04');assert.equal(r.items[0].ledger_date,'2030-01-05');

// A grouped broker report can date multiple fills, without inventing their intraday order.
await reset();const b1=await trade('buy','2030-01-05',1,90),b2=await trade('buy','2030-01-05',1,110);await evidence(b1,'2030-01-02',{quantity:2,sell_price:100,buy_amount:200});const s1=await trade('sell','2030-01-06',1,120);await evidence(s1,'2030-01-04');r=await run();assert.equal(r.items[0].realized_local,20);assert.equal(r.items[0].status,'calculated');

// Reject ambiguous, mismatched, foreign or manual evidence; retain provisional dates and null amounts.
for(const variant of ['duplicate','account','amount','side','date','future','currency','manual','known']){
 await reset();await trade('buy','2030-01-01',2,100);const t=await trade('sell','2030-01-05',1,120,variant==='manual'?{source:'manual'}:variant==='known'?{order_at:'2030-01-05T01:23:00+09:00'}:{});
 const e=await evidence(t,'2030-01-03',variant==='account'?{account_id:other}:variant==='amount'?{sell_amount:121}:variant==='side'?{provider_payload:{stnd_is_cd:'KR0000000001',trd_dt:'20300103',trd_dl_ccd:'02'}}:variant==='date'?{provider_payload:{stnd_is_cd:'KR0000000001',trd_dt:'20300102',trd_dl_ccd:'01'}}:variant==='future'?{realized_date:'2030-01-06',provider_payload:{stnd_is_cd:'KR0000000001',trd_dt:'20300106',trd_dl_ccd:'01'}}:variant==='currency'?{currency:'USD'}:{});
 if(variant==='duplicate')await insert('realized_pnl_events',{...e,id:id(seq++)});
 r=await run();assert.equal(r.items.length,1,variant);assert.equal(r.items[0].trade_date,'2030-01-05',variant);if(variant==='manual')assert.equal(r.items[0].realized_local,null);
}
await reset();const mb=await trade('buy','2030-01-06',2,100),ms=await trade('sell','2030-01-06',1,120);await evidence(mb,'2030-01-04');await evidence(ms,'2030-01-04');r=await run();assert.equal(r.items[0].status,'order_unverified');assert.equal(r.items[0].realized_local,null,'true same-day ordering remains unknown');ui.mixed=r;
await reset();await trade('buy','2029-12-27',2,100);const ny=await trade('sell','2030-01-02',1,120);await evidence(ny,'2029-12-31');assert.equal((await run('YTD')).items.length,0,'year boundary follows evidence');assert.equal((await run('ALL')).items.length,1);
assert.equal((await run('1W',other)).reason,'ACCOUNT_NOT_FOUND');
await db.query("select set_config('request.jwt.claim.sub','',false)");await assert.rejects(()=>run(),/authentication required/);
await db.query("select set_config('request.jwt.claim.sub',$1,false)",[user]);

fs.mkdirSync('mobile-artifacts/build241',{recursive:true});fs.writeFileSync('mobile-artifacts/build241/rpc-fixture.json',JSON.stringify(ui));

// Foreign trade dates, FX and settlement evidence keep their original semantics.
await reset();await db.exec("update securities set currency='USD',isin='US0000000001'");
await insert('fx_rates',{id:id(seq++),base_currency:'USD',quote_currency:'KRW',rate_date:'2030-01-01',rate:1000,source:'synthetic'});
await trade('buy','2030-01-02',2,100,{currency:'USD',order_at:'2030-01-01T00:00:00+09:00'});
await trade('sell','2030-01-06',1,120,{currency:'USD',order_at:'2030-01-04T00:00:00+09:00'});
await insert('kb_position_evidence',{id:id(seq++),account_id:account,source:'SPQM2205',asset_key:'US0000000001',symbol:'SYNTH',event_type:'sell',order_date:'2030-01-08',trade_date:'2030-01-08',settlement_date:'2030-01-11',quantity:1,price:130,gross_amount:130,currency:'USD',active:true,evidence:{trade_gross:130}});
await version(baseline);const foreignBefore=await run();await version(candidate);const foreignAfter=await run();
assert.deepEqual(foreignAfter.items,foreignBefore.items,'USD amounts, historical FX and pending sales unchanged');assert.equal(foreignAfter.pending_settlement_count,1);assert.equal(foreignAfter.items[0].historical_krw_estimate,20000);

// Exercise all other existing matching guards using their synthetic read-only fixture CTEs.
const {execFileSync}=await import('node:child_process');
const guardSQL=execFileSync(process.execPath,['tests/build118_grouped_dates.mjs'],{encoding:'utf8'});
const guard=(await db.query(guardSQL)).rows[0];assert.equal(guard.dates_correct,true);assert.equal(guard.known_times_preserved,true);

// Five alternating runs per version, same 400-trade/200-report synthetic corpus and engine.
await reset();for(let i=0;i<200;i++){const b=await trade('buy','2030-01-02',2,100+i);await evidence(b,'2030-01-01');await trade('sell','2030-01-05',1,120+i,{order_at:'2030-01-04T00:00:00+09:00'});}
const timings={before:[],after:[]};for(let i=0;i<6;i++)for(const [label,sql] of (i%2?[['after',candidate],['before',baseline]]:[['before',baseline],['after',candidate]])){await version(sql);const start=performance.now();await run();const elapsed=performance.now()-start;if(i)timings[label].push(Math.round(elapsed*10)/10);}
const summarize=a=>({runs:a.length,median:[...a].sort((a,b)=>a-b)[2],min:Math.min(...a),max:Math.max(...a),samples:a});
console.log(JSON.stringify({matching_guards:guard,synthetic_ms:Object.fromEntries(Object.entries(timings).map(([k,v])=>[k,summarize(v)]))},null,2));
await db.close();
console.log('Build241: real RPC period selection, cost replay, grouped evidence, ambiguity, owner, year boundary and ledger immutability passed');

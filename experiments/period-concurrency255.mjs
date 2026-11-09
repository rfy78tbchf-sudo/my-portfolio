// Diagnostic only: stock SQL CPU work in independent in-memory PGlite workers.
// No production connections. Two workers do NOT simulate shared Postgres locks,
// I/O, connection pools, memory contention, PostgREST, or server cancellation.
import {Worker,isMainThread,parentPort,workerData} from 'node:worker_threads';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const hash=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
if(!isMainThread){
 const {PGlite}=await import('@electric-sql/pglite');const db=new PGlite();
 await db.exec(readFileSync('tests/fixtures/pnl_schema.sql','utf8')+readFileSync('tests/fixtures/period_schema.sql','utf8'));
 await db.exec(`create table public.kb_balance_position_evidence(id uuid,account_id uuid,symbol text,observed_at timestamptz,settled_quantity numeric,effective_quantity numeric,pending_buy_quantity numeric,pending_sell_quantity numeric,source text);
 create schema auth;create role authenticated;
 create function auth.uid() returns uuid language sql as $$select current_setting('request.jwt.claim.sub',true)::uuid$$;
 grant usage on schema auth to authenticated;grant select on all tables in schema public to authenticated;
 alter table accounts enable row level security;create policy own on accounts to authenticated using(user_id=(select auth.uid()));
 insert into accounts(id,user_id,provider,mode,is_active,created_at) values(md5('a1')::uuid,md5('u1')::uuid,'kb_securities','live',true,'2020-01-01');
 select set_config('request.jwt.claim.sub',md5('u1')::uuid::text,false);`);
 const nav=readFileSync('supabase/build254_nav_contract.sql','utf8');
 await db.exec(nav.slice(0,nav.indexOf('-- This is an arithmetic assertion')));
 // Isolate unchanged stock calculation. NAV subcall intentionally excluded.
 await db.exec(`create function public.get_live_nav_reconciliation(text) returns jsonb language sql stable as $$select '{"diagnostic_stub":true}'::jsonb$$;`);
 const source=readFileSync('supabase/build254_existing_periods.sql','utf8');
 await db.exec(source.slice(source.indexOf('CREATE OR REPLACE FUNCTION public.get_live_period_stock_pnl')).replaceAll('now()',"timestamptz '2026-11-09 12:00:00+09'"));
 const size=workerData.size;
 await db.exec(`insert into securities(id,symbol,name,currency,isin) select md5('s'||g)::uuid,'SYNTH'||g,'Synthetic '||g,'USD','US'||lpad(g::text,10,'0') from generate_series(1,${size}) g;
 insert into holdings(id,account_id,security_id,as_of,quantity,market_value,currency,fx_rate_to_base) values(md5('h')::uuid,md5('a1')::uuid,md5('s1')::uuid,'2026-11-09T03:00:00Z',0,0,'USD',1400);
 insert into transactions(id,account_id,security_id,type,trade_at,quantity,price,net_amount,fee,tax,currency,source,provider_payload)
 select md5(g||':'||n)::uuid,md5('a1')::uuid,md5('s'||g)::uuid,case when n%2=1 then 'buy' else 'sell' end,
 timestamptz '2026-01-01'+(n*10+11)*interval '1 day',1,case when n%2=1 then 100 else 110 end,case when n%2=1 then -100 else 110 end,0,0,'USD','api',
 jsonb_build_object('dl_dt',to_char(timestamptz '2026-01-01'+(n*10+11)*interval '1 day','YYYYMMDD'),'dl_amt',case when n%2=1 then '100' else '110' end,'stnd_is_cd','US'||lpad(g::text,10,'0'))
 from generate_series(1,${size}) g cross join generate_series(1,30) n;analyze;set role authenticated;`);
 parentPort.on('message',async({id,period})=>{
  const t=performance.now();try{
   const result=(await db.query('select public.get_live_period_stock_pnl($1) r',[period])).rows[0].r;
   parentPort.postMessage({id,ms:performance.now()-t,hash:hash(result),complete:result.complete,candidates:result.candidate_count});
  }catch(e){parentPort.postMessage({id,error:e.message});}
 });parentPort.postMessage({ready:true});
}else{
 const results=[];let seq=0;
 for(const size of (process.env.SIZES||'20,100').split(',').map(Number)){
  const pool=await Promise.all([0,1].map(()=>new Promise((resolve,reject)=>{
   const worker=new Worker(new URL(import.meta.url),{workerData:{size}});worker.once('error',reject);worker.once('message',()=>{
    const pending=new Map();worker.on('message',r=>{const cb=pending.get(r.id);pending.delete(r.id);if(r.error)cb.reject(Error(r.error));else cb.resolve(r)});
    resolve({worker,run:period=>new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});worker.postMessage({id,period})})});
   });
  })));
  try{
   const expected={};for(const p of ['1W','1M','3M','ALL']){const a=await pool[0].run(p),b=await pool[1].run(p);assert.equal(a.hash,b.hash);expected[p]=a.hash;}
   for(let run=0;run<Number(process.env.RUNS||5);run++)for(const slots of(run%2?[2,1]:[1,2])){
    // Same request schedule, keep only latest waiting request. Running queries finish.
    let active=0,current=null,waiting=null,done=0,maxActive=0,latestDone=null;const trace=[],free=pool.slice(0,slots);
    const start=performance.now(),cpuStart=process.cpuUsage();let resolveDrain,rejectDrain;const drained=new Promise((r,j)=>{resolveDrain=r;rejectDrain=j});
    function pump(){
     if(waiting&&free.length){const req=waiting;waiting=null;const w=free.pop();active++;maxActive=Math.max(maxActive,active);req.started=performance.now()-start;trace.push(req);
      w.run(req.period).then(r=>{assert.equal(r.hash,expected[req.period]);req.sqlMs=r.ms;req.finished=performance.now()-start;req.current=req===current;if(req.current)latestDone=req.finished;}).catch(rejectDrain).finally(()=>{active--;free.push(w);pump();if(done===4&&!active&&!waiting)resolveDrain();});
     }
    }
    for(const [i,period] of ['1W','1M','3M','ALL'].entries()){
     const delay=i*40-(performance.now()-start);if(delay>0)await new Promise(r=>setTimeout(r,delay));
     current={period,requested:performance.now()-start};waiting=current;done++;pump();
    }
    await drained;const cpu=process.cpuUsage(cpuStart);assert.ok(latestDone);assert.equal(trace.at(-1).period,'ALL');assert.ok(maxActive<=slots);
    const row={size,transactions:size*30,run,slots,queries:trace.length,maxActive,latestMs:latestDone-current.requested,drainMs:performance.now()-start,cpuMs:(cpu.user+cpu.system)/1000,queryElapsedSumMs:trace.reduce((n,x)=>n+x.sqlMs,0),trace};results.push(row);
    console.error(JSON.stringify({size,run,slots,queries:row.queries,latestMs:Math.round(row.latestMs),cpuMs:Math.round(row.cpuMs)}));
   }
  }finally{await Promise.all(pool.map(x=>x.worker.terminate()));}
 }
 const artifact={kind:'isolated-stock-sql-worker-scheduling',conditions:{cpuThrottle:'none',requestIntervalMs:40,periods:['1W','1M','3M','ALL'],nav:'stubbed/excluded',database:'independent PGlite worker copies',production:false},results};
 writeFileSync(process.env.OUTPUT||'performance/period-concurrency255.json',JSON.stringify(artifact,null,2)+'\n');
 console.log('SQL response hashes equal across workers; latest-only queue drained; diagnostic saved.');
}

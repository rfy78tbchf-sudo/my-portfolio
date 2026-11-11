import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {stripTypeScriptTypes} from 'node:module';
const src=fs.readFileSync('supabase/functions/kb-sync-worker/index.ts','utf8');
const section=(a,b)=>src.slice(src.indexOf(a),src.indexOf(b,src.indexOf(a)));
const start=src.indexOf('async function syncHistoryMonth(');
const code=section('async function pagedTr(','async function previewHistory(')+src.slice(start,src.indexOf('\nasync function ',start+1));
async function run(target,pages){
 const calls=[],requests=[],counts={};
 const ctx=vm.createContext({
  setTimeout:f=>f(),monthBounds:()=>({start:'20261101',end:'20261130'}),
  credentials:async()=>({appKey:'synthetic',appSecret:'synthetic'}),issueToken:async()=>'synthetic',
  callTr:async(k,t,path,body)=>{requests.push({path,body});const i=counts[path]||0;counts[path]=i+1;
   return path===target?pages[Math.min(i,pages.length-1)]:{dataBody:{Record1:[],nxt_key:''}};},
  adminRpc:async(name,args)=>{calls.push({name,args});return 0;},
  loadSecurityMaster:async()=>({synthetic:{}}),refreshSecurityMaster:async()=>{},
  normalizeLedger:rows=>({transactions:rows,dividends:[],cashFlows:[]}),
  normalizeRealized:rows=>rows,settlementEvidence:async()=>[]
 });
 vm.runInContext(stripTypeScriptTypes(code),ctx);
 let result,error;try{result=await ctx.syncHistoryMonth('synthetic','2026-11');}catch(e){error=e;}
 return {calls,requests,result,error};
}
const targets=['/api/v1/swqa2301','/api/v1/ssqm2442','/api/v1/spqm2205'];
const malformed=[{}, {dataBody:{}}, {dataBody:{Record1:null}}, {dataBody:{Record1:{}}}];
let unsafe=0;
for(const target of targets)for(const bad of malformed){
 const r=await run(target,[{dataBody:{Record1:[{synthetic:1}],nxt_key:'next'}},bad]);
 if(r.calls.length)unsafe++;
 if(!process.argv.includes('--baseline')){
  assert.match(String(r.error),/HISTORY_PAGE_ROWS_MISSING/);
  assert.equal(r.calls.length,0,'partial pages must never apply or retire stored evidence');
 }
}
if(process.argv.includes('--baseline')){assert.equal(unsafe,12);console.log({unsafePartialResponses:unsafe});process.exit(0);}
for(const target of targets){
 const valid=await run(target,[{dataBody:{Record1:[{synthetic:1}],nxt_key:'next'}},{dataBody:{Record1:[{synthetic:2}],nxt_key:''}}]);
 assert.equal(valid.error,undefined);assert.ok(valid.calls.some(x=>x.name==='apply_kb_history_month_for_service'));
 assert.equal(valid.requests.filter(x=>x.path===target).length,2);
 const empty=await run(target,[{dataBody:{Record1:[],nxt_key:''}}]);
 assert.equal(empty.error,undefined,'explicit empty array preserves existing behavior, not proof of completeness');
 const repeat=await run(target,[{dataBody:{Record1:[],nxt_key:'same'}}]);
 assert.match(String(repeat.error),/HISTORY_PAGE_CONTINUATION_REPEATED/);
 assert.equal(repeat.calls.length,0);assert.equal(repeat.requests.filter(x=>x.path===target).length,2);
}
console.log('PASS: 12 malformed partial responses write nothing; valid pagination and explicit empty arrays preserved; repeated continuation rejected');

import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {stripTypeScriptTypes} from 'node:module';
const code=fs.readFileSync('supabase/functions/kb-sync-worker/index.ts','utf8');
const helper=code.slice(code.indexOf('async function syncCorporateOpeningPrices('),code.indexOf('async function syncHistoricalFx('));
let cached=false,day='2026-10-06',queries=[],saved=[];
const ctx=vm.createContext({SUPABASE_URL:'https://example.invalid',SECRET_KEY:'fixture',todaySeoul:()=>day,
credentials:async()=>({appKey:'fixture',appSecret:'fixture'}),issueToken:async()=>'',
fetch:async(url,opts)=>{if(opts.method==='POST'){saved.push(...JSON.parse(opts.body));return {ok:true};}return {ok:true,json:async()=>cached?[{symbol:'MSTY'},{symbol:'SOXS'}]:[]}},
callTr:async(k,t,p,args)=>{queries.push(args);return {dataBody:{out2:[{price_date:args.srch_strt_dy.replace(/^(\d{4})(\d{2})(\d{2})$/,'$1-$2-$3'),close:12,observed_at:'2026-10-06T00:00:00Z'}]}}},normalizeChartRows:(id,c,rows)=>rows});
vm.runInContext(stripTypeScriptTypes(helper),ctx);
await ctx.syncCorporateOpeningPrices('fixture');
assert.equal(saved.length,2);assert.ok(queries.every(q=>q.mdfy_stk_prc_use_f==='0'));assert.deepEqual(queries.map(q=>q.srch_strt_dy),['20260705','20251005']);assert.ok(saved.every(r=>r.source==='kb_gsc10060_unadjusted'&&r.currency==='USD'));
cached=true;queries=[];await ctx.syncCorporateOpeningPrices('fixture');assert.equal(queries.length,0);
cached=false;day='2027-05-31';await ctx.syncCorporateOpeningPrices('fixture');assert.deepEqual(queries.map(q=>q.srch_strt_dy),['20270227','20260530']);
console.log('Unadjusted prices, daily cache and month-end boundaries passed');

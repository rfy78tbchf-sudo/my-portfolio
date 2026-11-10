import fs from 'node:fs';import {execFileSync} from 'node:child_process';
import {chromium} from 'playwright';
const root=process.cwd();
const sources=[execFileSync('git',['show','f506ef9:index.html'],{cwd:root,encoding:'utf8'}),fs.readFileSync(root+'/index.html','utf8')].map(s=>s.slice(s.indexOf('  var allocationScope='),s.indexOf('  function riskOverviewCard(')));
const browser=await chromium.launch();const page=await browser.newPage({viewport:{width:390,height:844}});
const out=await page.evaluate(sources=>{
 const at='2030-01-01T00:00:00Z',out=[];
 for(const count of [7,100]){
 const live={accounts:[{id:'a',provider:'kb_securities',mode:'live'}],holdings:[],holdingBasis:[],securityMap:{},risk:{valuation_time_aligned:true,as_of:at,official_assets_krw:count*100+500},accountScope:{account_identity_verified:true,broker_account_overlap_verified:true,current_primary_observed_at:at,current_isa_balance_effective_at:at,current_display_total:count*100+500}};
 for(let i=0;i<count;i++){live.holdings.push({account_id:'a',security_id:String(i),quantity:1});live.holdingBasis.push({account_id:'a',security_id:String(i),quantity:1,valuation_krw:100,as_of:at});live.securityMap[i]={symbol:'TEST'+i};}
 const fs=sources.map(s=>new Function('live','esc','num','money',s+';return ()=>allocationCard('+String(count*100+500)+');')(live,String,(n,d)=>n.toFixed(d),String));
 const samples=[[],[]];for(let i=0;i<70;i++)for(const k of i%2?[1,0]:[0,1]){const t=performance.now();for(let j=0;j<50;j++)fs[k]();const ms=(performance.now()-t)/50;if(i>=20)samples[k].push(ms);}
 out.push({count,conditions:'Chromium 390x844; no throttling; same synthetic data; render function only, not network or paint',runs:50,results:samples.map(a=>{a.sort((x,y)=>x-y);return {median:a[25],min:a[0],max:a[49],p95:a[47]};})});
 }return out;
},sources);console.log(JSON.stringify(out));await browser.close();

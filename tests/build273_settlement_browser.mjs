import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';import {chromium,webkit} from 'playwright';
const src=fs.readFileSync('index.html','utf8');const start=src.indexOf('      var pending=(live.settlementBasis');const code=src.slice(start,src.indexOf('      body.innerHTML=',start));
const styles=[...src.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(x=>x[1]).join('\n');
function render(known){const ctx=vm.createContext({live:{accounts:[{id:'a',name:'합성 검증 계좌'}],settlementBasis:[{account_id:'a',symbol:'SYNTH',currency:'USD',observed_at:'2026-11-11',evidence_status:known?'complete_row':'missing',effective_quantity:known?2:null,settled_quantity:known?1:null,pending_buy_quantity:known?1:null,pending_sell_quantity:known?0:null,quantity_identity_ok:known?true:null}]},s:{symbol:'SYNTH',currency:'USD'},positions:[{account_id:'a'}],esc:String,num:String,kstStamp:String});vm.runInContext(code,ctx);return ctx.settlementDetails;}
for(const [name,engine] of [['chromium',chromium],['webkit',webkit]]){
 const browser=await engine.launch({headless:true});const page=await browser.newPage();await page.route('**/*',r=>r.abort());
 for(const width of [390,402,430])for(const zoom of [1,1.25])for(const known of [true,false]){
  await page.setViewportSize({width,height:844});await page.setContent(`<html lang="ko"><head><style>${styles}</style></head><body style="zoom:${zoom}"><main style="padding:16px">${render(known)}</main></body></html>`);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${name} ${width} ${zoom}`);
  const body=await page.locator('body').innerText();if(known){assert.match(body,/2주/);assert.match(body,/\+1주/);}else{assert.match(body,/결제 수량 자료 확인 필요/);assert.doesNotMatch(body,/null주|0주/);}
 }
 await browser.close();console.log(`PASS ${name}: actual settlement renderer/styles, 390/402/430px and 125%, explicit and unknown states`);
}

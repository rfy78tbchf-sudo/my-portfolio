import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {chromium,webkit} from 'playwright';
const html=fs.readFileSync(process.env.UI_SOURCE||new URL('../index.html',import.meta.url),'utf8');
const code=html.slice(html.indexOf('  function chartMovingAverages('),html.indexOf('  function heatmapHtml('));
const scope=vm.createContext({esc:String,price:(v,c)=>`${Number(v).toFixed(2)} ${c}`,money:String});
vm.runInContext(code,scope);
// Oscillating history exercises both directions, distinct pair dates, and an event outside the saved viewport.
const points=Array.from({length:365},(_,i)=>({date:new Date(Date.UTC(2025,0,i+1)).toISOString().slice(0,10),close:150+25*Math.sin(i/11)+7*Math.cos(i/3),currency:'USD',source:'daily'}));
const samples=[],verify=process.argv.includes('--verify'),retention=process.argv.includes('--retention');
for(let run=0;run<(retention?1:verify?(process.env.CHROMIUM_ONLY?1:2):5);run++){
 const engine=verify&&run===1?webkit:chromium;
 const browser=await engine.launch();
 try{
  const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  await page.route('https://chart.test/**',r=>r.fulfill({contentType:'text/html',body:'<html></html>'}));await page.goto('https://chart.test/');
  await page.setContent('<meta name="viewport" content="width=device-width,initial-scale=1"><style>'+html.split('<style>')[1].split('</style>')[0]+'</style><div id="mount">'+scope.securityChart(points,'USD')+'</div>');
  await page.addScriptTag({content:'var esc=String,money=String;var price=(v,c)=>Number(v).toFixed(2)+" "+c;'+code});
  if(engine===chromium){const cdp=await page.context().newCDPSession(page);await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});}
  const result=await page.evaluate(async points=>{
   const root=document.querySelector('.security-price-interactive');bindSecurityChart(root,points,'USD',{period:'all',ma:[20,60]});
   const hit=root.querySelector('.security-chart-hit'),box=hit.getBoundingClientRect(),x=box.x+box.width/2,y=box.y+box.height/2;
   const touch=(type,distance)=>{
    const touches=type==='touchend'?[]:[{identifier:1,target:hit,clientX:x-distance/2,clientY:y},{identifier:2,target:hit,clientX:x+distance/2,clientY:y}];
    let event;
    try{event=new TouchEvent(type,{bubbles:true,cancelable:true,touches:touches.map(t=>new Touch(t))})}
    catch(e){event=new Event(type,{bubbles:true,cancelable:true});Object.defineProperty(event,'touches',{value:touches})}
    return hit.dispatchEvent(event);
   };
   const durations=[],paints=[];let redraws=0;
   const observer=new MutationObserver(records=>redraws+=records.filter(r=>r.type==='childList'&&r.target===root.querySelector('.security-ma-lines')).length);observer.observe(root,{childList:true,subtree:true});
   touch('touchstart',100);
   for(let frame=0;frame<60;frame++){
    const start=performance.now();
    // Four subpixel moves per frame exercise high-frequency pinch samples, including rounded repeats.
    for(let i=0;i<4;i++)touch('touchmove',100+frame*0.4+i*0.05);
    durations.push(performance.now()-start);
    await new Promise(r=>requestAnimationFrame(()=>r()));paints.push(performance.now()-start);
   }
   touch('touchend',0);observer.disconnect();
   const periodStart=performance.now();root.querySelector('[data-chart-period="3"]').click();const periodMs=performance.now()-periodStart;
   return {handlerTotalMs:Math.round(durations.reduce((a,b)=>a+b,0)),handlerMaxMs:Math.round(Math.max(...durations)),frameMedianMs:Math.round(paints.sort((a,b)=>a-b)[30]),redraws,periodMs:Math.round(periodMs),count:root.dataset.chartCount,start:root.dataset.chartStart};
  },points);
  if(retention){
    const cdp=await page.context().newCDPSession(page);result.retention=[];
    for(const opens of [0,20,40]){
      if(opens)await page.evaluate(points=>{for(let i=0;i<20;i++){const mount=document.querySelector('#mount');mount.innerHTML=securityChart(points,'USD');bindSecurityChart(mount.querySelector('.security-price-interactive'),points,'USD',{period:'all',ma:[20,60]})}},points);
      await cdp.send('HeapProfiler.collectGarbage');
      result.retention.push({opens,...await cdp.send('Memory.getDOMCounters')});
    }
  }
  samples.push({run:run+1,...result});
  if(verify){
    assert.equal(result.count,'93');assert.equal(result.start,'272');assert.equal(result.redraws,71);
    await page.evaluate(points=>{
      const root=document.querySelector('.security-price-interactive'),hit=root.querySelector('.security-chart-hit'),reset=root.querySelector('[data-chart-zoom="reset"]');
      reset.click();const geometry=root.querySelector('.security-ma-lines').firstChild;
      hit.dispatchEvent(new KeyboardEvent('keydown',{key:'Home',bubbles:true,cancelable:true}));
      if(!root.querySelector('[data-price-date]').textContent.includes(points[0].date))throw Error('Home selection');
      reset.click();
      if(!root.querySelector('[data-price-date]').textContent.includes(points.at(-1).date))throw Error('same-window reset must still update selection');
      if(root.querySelector('.security-ma-lines').firstChild!==geometry)throw Error('unchanged window rebuilt geometry');
      const oldLine=root.querySelector('.security-price-line').getAttribute('points');
      const next=points.map(p=>({...p}));next[next.length-1].close*=2;
      document.querySelector('#mount').innerHTML=securityChart(next,'USD');
      const fresh=document.querySelector('.security-price-interactive');bindSecurityChart(fresh,next,'USD',{period:'all',ma:[20,60]});
      if(fresh.querySelector('.security-price-line').getAttribute('points')===oldLine)throw Error('new data must redraw');
    },points);
    console.log(engine.name()+': pinch window, same-window keyboard/reset selection, retained geometry and fresh-data redraw passed');
  }
 }finally{await browser.close()}
}
console.log(JSON.stringify({conditions:(retention?'One Chromium resource-retention run; ':verify?'Browser regression; ':'5 fresh Chromium pages; ')+' 365 synthetic daily prices; 390x844 touch viewport CPU4x; 60 frames x4 synthetic subpixel pinch events, then 3-month period; isolated production chart code, not real finger input or full app timing',samples},null,2));

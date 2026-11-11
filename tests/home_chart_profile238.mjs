import assert from 'node:assert/strict';
export async function profileHomeChart(page,points){
 await page.locator('#assetChartHit').scrollIntoViewIfNeeded();
 const result=await page.evaluate(async points=>{
  const hit=document.querySelector('#assetChartHit'),svg=document.querySelector('#assetChartSvg'),tip=document.querySelector('#assetChartTip'),clear=document.querySelector('#assetChartClear'),line=svg.querySelector('polyline');
  const frame=()=>new Promise(r=>requestAnimationFrame(r)),box=svg.getBoundingClientRect(),times=[],callbacks=[];let writes=0;
  const observer=new MutationObserver(()=>{});observer.observe(tip,{childList:true});
  for(let i=0;i<60;i++){
   const index=Math.round(i*(points.length-1)/59),x=box.left+index/(points.length-1)*box.width;
   observer.takeRecords();const start=performance.now();
   for(let j=0;j<4;j++)hit.dispatchEvent(new PointerEvent('pointermove',{bubbles:true,pointerType:'mouse',clientX:x,clientY:box.top+box.height/2}));
   times.push(performance.now()-start);writes+=observer.takeRecords().length;
   if(!tip.textContent.includes(points[index].date)||!tip.textContent.includes(Number(points[index].total_assets).toLocaleString('en-US')))throw Error('selected synthetic date/amount mismatch');
   await frame();callbacks.push(performance.now()-start);
  }
  observer.disconnect();clear.click();const cleared=tip.classList.contains('hidden');
  hit.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,pointerType:'touch',clientX:box.right,clientY:box.top+box.height/2}));const revealed=!tip.classList.contains('hidden');
  hit.dispatchEvent(new PointerEvent('pointercancel',{bubbles:true}));
  return {handlerTotalMs:times.reduce((a,b)=>a+b,0),handlerMaxMs:Math.max(...times),callbackMedianMs:[...callbacks].sort((a,b)=>a-b)[30],times,callbacks,writes,cleared,revealed,cancelled:tip.classList.contains('hidden'),sameLine:line===svg.querySelector('polyline')};
 },points);
 assert.ok(result.cleared&&result.revealed&&result.cancelled&&result.sameLine);
 return result;
}

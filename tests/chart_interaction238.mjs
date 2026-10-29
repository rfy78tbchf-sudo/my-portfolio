import assert from 'node:assert/strict';

// Full-app chart fixture: synthetic events exercise the production handlers after detail is idle.
export async function measureChartInput(page){
  await page.locator('.security-chart-hit').scrollIntoViewIfNeeded();
  const result=await page.evaluate(async()=>{
    const root=document.querySelector('.security-price-interactive'),hit=root.querySelector('.security-chart-hit');
    const frame=()=>new Promise(r=>requestAnimationFrame(r));
    const median=a=>[...a].sort((a,b)=>a-b)[Math.floor(a.length/2)];
    const controls=[];
    for(const selector of ['[data-chart-period="3"]','[data-chart-zoom="in"]','[data-chart-zoom="out"]','[data-chart-zoom="reset"]']){
      const start=performance.now();root.querySelector(selector).click();const handlerMs=performance.now()-start;await frame();await frame();
      controls.push({selector,handlerMs,callbackMs:performance.now()-start,start:Number(root.dataset.chartStart),count:Number(root.dataset.chartCount)});
    }
    const date=root.querySelector('[data-price-date]'),value=root.querySelector('[data-price-value]'),geometry=root.querySelector('.security-ma-lines').firstChild;
    const box=hit.ownerSVGElement.getBoundingClientRect(),durations=[],callbacks=[],selections=[];let textWrites=0;
    const observer=new MutationObserver(records=>textWrites+=records.filter(r=>r.target===date||r.target===value).length);
    observer.observe(root,{childList:true,subtree:true});
    const longTasks=[],supportsLong=PerformanceObserver.supportedEntryTypes.includes('longtask');
    const longObserver=supportsLong?new PerformanceObserver(l=>longTasks.push(...l.getEntries().map(e=>e.duration))):null;if(longObserver)longObserver.observe({type:'longtask'});
    // Four samples in the same selected day per frame, sweeping 60 distinct days.
    // pointermove(mouse) uses the same selection path as a captured one-finger move without requiring trusted capture.
    for(let i=0;i<60;i++){
      const index=120+i,x=box.left+(10+index*340/364)/360*box.width;
      const start=performance.now();
      for(let j=0;j<4;j++)hit.dispatchEvent(new PointerEvent('pointermove',{bubbles:true,pointerType:'mouse',clientX:x+j*.001,clientY:box.top+box.height/2}));
      durations.push(performance.now()-start);selections.push(Number(hit.getAttribute('aria-valuenow')));
      if(!hit.getAttribute('aria-valuetext').includes(value.textContent)||!hit.getAttribute('aria-valuetext').includes(date.textContent.split(' · ')[0]))throw Error('visible labels and accessible selection differ');
      await frame();callbacks.push(performance.now()-start);
    }
    await frame();observer.disconnect();if(longObserver)longObserver.disconnect();
    const retainedGeometry=geometry===root.querySelector('.security-ma-lines').firstChild;
    // Hidden crosshair must reappear even for an unchanged selected day; window changes must update coordinates.
    root.querySelector('[data-chart-zoom="reset"]').click();hit.dispatchEvent(new KeyboardEvent('keydown',{bubbles:true,key:'End'}));
    const revealed=!root.querySelector('.security-crosshair').classList.contains('hidden');
    return {controls,handlerTotalMs:durations.reduce((a,b)=>a+b,0),handlerMaxMs:Math.max(...durations),frameMedianMs:median(callbacks),durations,callbacks,textWrites,selections,retainedGeometry,revealed,longTasks:supportsLong?longTasks:null};
  });
  assert.deepEqual(result.selections,Array.from({length:60},(_,i)=>120+i));
  if(process.env.EXPECT_CHART_LABEL_REUSE)assert.equal(result.textWrites,120,'each changed day updates exactly two labels, same-day repeats do not');
  assert.ok(result.retainedGeometry,'crosshair sweep reuses line geometry');assert.ok(result.revealed,'same-day keyboard selection reveals hidden crosshair');
  assert.equal(result.controls.at(-1).count,365);
  return result;
}

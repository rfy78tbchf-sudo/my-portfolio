import assert from 'node:assert/strict';
export async function inspectPortfolioRows(page, holdingCount) {
  const results=[];
  const frames=()=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  for(const zoom of [1,1.25])for(const width of [390,402,430]){
    await page.setViewportSize({width,height:844});
    await page.evaluate(z=>document.documentElement.style.zoom=String(z),zoom);
    await page.locator('#nav [data-tab="home"]').click();
    await page.locator('#nav [data-tab="portfolio"]').click();await frames();
    const initial=await page.locator('.portfolio-list .portfolio-row').evaluateAll(rows=>({
      count:rows.length,height:document.documentElement.scrollHeight,
      rows:rows.map(e=>({id:e.dataset.securityId,height:e.getBoundingClientRect().height,top:e.getBoundingClientRect().top+scrollY}))
    }));
    assert.equal(initial.count,holdingCount);
    const target='.portfolio-list [data-security-id="daily-'+(holdingCount-1)+'"]';
    await page.locator(target).scrollIntoViewIfNeeded();await frames();
    const before=await page.locator(target).evaluate(e=>({y:scrollY,top:e.getBoundingClientRect().top,height:document.documentElement.scrollHeight,rowHeight:e.getBoundingClientRect().height}));
    assert.ok(Math.abs(before.height-initial.height)<=1,'scrolling must not change total list geometry');
    assert.ok(await page.locator(target).evaluate(e=>e.getBoundingClientRect().height>=44),'row touch target');
    assert.ok(await page.locator(target).evaluate(e=>e.getBoundingClientRect().bottom<=document.querySelector('#nav').getBoundingClientRect().top),'row is above bottom navigation');
    assert.ok(await page.locator(target+' .position-value').evaluate(e=>e.scrollWidth<=e.clientWidth+1),'amount fits');
    assert.ok(await page.locator(target+' .position-result').evaluate(e=>e.scrollWidth<=e.clientWidth+1),'pnl fits');
    await page.locator(target).focus();await page.keyboard.press('Enter');
    await page.locator('#detailOverview').waitFor();
    await page.waitForFunction(()=>window.__dailyTest.state().idle);await frames();
    if(width===402)await page.goBack();else await page.locator('#detailReturn').click();
    await page.locator('#detailModal').waitFor({state:'hidden'});await frames();
    const after=await page.locator(target).evaluate(e=>({y:scrollY,top:e.getBoundingClientRect().top,height:document.documentElement.scrollHeight,focus:document.activeElement===e}));
    assert.ok(Math.abs(after.y-before.y)<=2,'detail return scroll position: '+JSON.stringify({before,after}));
    assert.ok(Math.abs(after.top-before.top)<=2,'detail return row position');
    assert.equal(after.focus,true,'detail return focus');
    // Search a row that was initially outside the viewport, then clear without relying on geometry reads.
    const symbol=holdingCount>4?'SYN'+String(holdingCount-1).padStart(3,'0'):'005930';
    await page.locator('#search').fill(symbol);await frames();
    assert.equal(await page.locator('.portfolio-list .portfolio-row:visible').count(),1);
    await page.locator(target).click();await page.locator('#detailOverview').waitFor();
    await page.waitForFunction(()=>window.__dailyTest.state().idle);
    await page.locator('#detailReturn').click();await page.locator('#detailModal').waitFor({state:'hidden'});
    assert.equal(await page.locator('#search').inputValue(),symbol);
    await page.locator('#search').fill('');await page.locator('#search').blur();await frames();
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'page width');
    results.push({width,zoom,initial,before,after});
  }
  await page.setViewportSize({width:390,height:844});await page.evaluate(()=>document.documentElement.style.zoom='1');
  await page.locator('#nav [data-tab="home"]').click();await frames();
  return results;
}

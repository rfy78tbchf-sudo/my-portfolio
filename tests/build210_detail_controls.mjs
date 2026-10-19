import assert from 'node:assert/strict';
import {readFileSync,mkdirSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium,webkit} from 'playwright';

// Production detail markup and CSS; isolated controls, no auth or remote requests.
// A reduced viewport checks reachable layout, not a physical iPhone keyboard.
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const source=readFileSync(resolve(root,'index.html'),'utf8');
const css=Array.from(source.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g),m=>m[1]).join('\n');
const modal=source.slice(source.indexOf('<div id="detailModal"'),source.indexOf('</body>',source.indexOf('<div id="detailModal"')));
assert.ok(css&&modal.includes('detail-return-bar'));
const output=resolve(root,'mobile-artifacts/build210-detail-controls');
mkdirSync(output,{recursive:true});

for(const [name,engine] of [['chromium',chromium],['webkit',webkit]]){
  const browser=await engine.launch({headless:true});
  const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  await page.route('**/*',route=>route.abort());
  try{
    await page.setContent('<meta name="viewport" content="width=device-width,initial-scale=1"><style>'+css+'</style>'+modal);
    await page.evaluate(()=>{
      document.getElementById('detailModal').classList.remove('hidden');
      const next=document.getElementById('detailNext');next.hidden=false;next.textContent='내 판단 저장';
      document.getElementById('detailBody').innerHTML='<section class="card"><h3>판단 입력 확인</h3>'+
        '<label><input id="controlCheck" type="checkbox"> 이동평균선 표시</label>'+
        '<label><input id="controlRadio" type="radio"> 유지</label>'+
        '<input id="controlRange" type="range" aria-label="차트 범위">'+
        '<select id="controlSelect" class="select" aria-label="내 선택"><option>유지</option><option>판단 유보</option></select>'+
        '<input id="controlDate" type="date" class="input" aria-label="재점검일">'+
        '<label>판단 이유<textarea id="controlText" class="input"></textarea></label>'+
        '<input id="controlNumber" type="number" class="input" aria-label="목표 비중">'+
        '<button id="inlineSave" class="btn full">판단 저장 확인</button></section>';
      window.__inlineSaveClicks=0;
      document.getElementById('inlineSave').onclick=function(){window.__inlineSaveClicks++};
    });
    const footer=page.locator('.detail-return-bar');
    async function visibleActions(message){
      assert.equal(await footer.isVisible(),true,message);
      for(const id of ['detailReturn','detailNext']){
        const box=await page.locator('#'+id).boundingBox();
        assert.ok(box&&box.height>=44&&box.y>=0&&box.y+box.height<=page.viewportSize().height+1,message+' stays reachable');
      }
    }
    await visibleActions('initial actions');
    for(const id of ['controlText','controlNumber']){
      await page.locator('#'+id).focus();
      assert.equal(await footer.isVisible(),false,'text-entry focus hides the action bar even when the next button is available');
      await page.locator('#'+id).evaluate(el=>el.blur());
      await visibleActions('actions return after input ends');
    }
    for(const id of ['controlCheck','controlRadio','controlRange','controlSelect','controlDate']){
      await page.locator('#'+id).focus();
      await visibleActions(id+' does not dismiss the actions');
    }
    await page.screenshot({path:resolve(output,name+'-controls.png')});
    await page.setViewportSize({width:390,height:500});
    await page.locator('#controlText').fill('실적 발표에서 다시 확인할 작성 중 이유');
    assert.equal(await footer.isVisible(),false);
    await page.locator('#inlineSave').scrollIntoViewIfNeeded();
    const save=await page.locator('#inlineSave').boundingBox();
    assert.ok(save.y>=0&&save.y+save.height<=500,'inline save is reachable with reduced viewport height');
    await page.locator('#inlineSave').click();
    assert.equal(await page.evaluate(()=>window.__inlineSaveClicks),1,'ending text entry cannot swallow the inline save click');
    await page.evaluate(()=>document.activeElement?.blur());
    await visibleActions('actions return in the reduced viewport');
    assert.equal(await page.locator('#controlText').inputValue(),'실적 발표에서 다시 확인할 작성 중 이유');
    await page.screenshot({path:resolve(output,name+'-reduced-viewport.png')});
    console.log('Build210 '+name+': text-entry bar suppression, non-text control actions, blur recovery and reduced-viewport save passed');
  }finally{await browser.close()}
}

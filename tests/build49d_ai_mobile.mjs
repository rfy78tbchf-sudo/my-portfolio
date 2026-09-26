import assert from 'node:assert/strict';
import {readFileSync,mkdirSync} from 'node:fs';
import vm from 'node:vm';
import {chromium} from 'playwright';

const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const styles=html.slice(html.indexOf('<style>')+7,html.indexOf('</style>'));
const client=readFileSync(new URL('../app-enhancements.js',import.meta.url),'utf8');
const start=client.indexOf('  function aiCard(){'),end=client.indexOf('  async function ask(',start);
const sandbox=vm.createContext({context:{live:{holdings:[]}}});
vm.runInContext(client.slice(start,end),sandbox);
const card=vm.runInContext('aiCard()',sandbox);
const answer='가장 큰 위험: 한 종목에 자산이 집중되어 있습니다.\n근거: KB 조회 총자산 대비 25%를 차지합니다.\n다음 확인: 목표 비중을 점검하세요.\n자료 상태: 일부 종목의 분류가 확인되지 않았습니다.';
const documentHtml=`<!doctype html><html lang="ko"><head><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>${styles}</style></head><body><main class="shell"><section class="content"><section class="grid settings">${card}</section></section></main><nav class="nav" aria-label="하단 탐색"><button>더보기</button></nav></body></html>`;
mkdirSync('mobile-artifacts',{recursive:true});
const browser=await chromium.launch({headless:true});
try{
  for(const width of [360,390,402,430]){
    const page=await browser.newPage({viewport:{width,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true,locale:'ko-KR'});
    await page.setContent(documentHtml);
    await page.locator('details.card-group').evaluate(node=>node.open=true);
    // The production renderer depends only on DOM APIs; render the exact function.
    await page.evaluate(({source,answer})=>{
      window.__answer=answer;(0,eval)(source+'\nrenderAiAnswer(document.getElementById("aiAnswer"),window.__answer)');
    },{source:client.slice(client.indexOf('  function renderAiAnswer('),end),answer});
    await page.locator('#aiAnswer').scrollIntoViewIfNeeded();
    // A fixed navigation bar is not accounted for by scrollIntoViewIfNeeded.
    // Verify the bottom reached by a user's final scroll, as on iPhone.
    await page.evaluate(()=>window.scrollTo(0,document.documentElement.scrollHeight));
    const size=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,
      fontsize:parseFloat(getComputedStyle(document.querySelector('.ai-answer')).fontSize),
      text:document.querySelector('.ai-answer').textContent,
      bottom:document.querySelector('.ai-answer').getBoundingClientRect().bottom,
      navTop:document.querySelector('.nav').getBoundingClientRect().top}));
    assert.equal(size.overflow,false,`${width}px horizontal overflow`);
    assert.ok(size.fontsize>=15,`${width}px answer text should remain readable`);
    assert.ok(size.text.includes('KB 조회 총자산 대비 25%'));
    assert.ok(size.bottom<=size.navTop,`${width}px answer covered by nav`);
    await page.screenshot({path:`mobile-artifacts/ai-answer-${width}.png`,fullPage:true});
    await page.locator('details.more-list').filter({hasText:'목표 비중까지 축소'}).evaluate(node=>node.open=true);
    await page.locator('#weightResult').evaluate(node=>node.textContent=
      'ARM 평가액 15,154,956원 → 목표 10.00% · 가정상 매도 8,686,077원\n'+
      '매도 후 보유 6,468,879원 · 보유 현금 증가 8,686,077원 · 총자산 64,688,793원 (비용 전, 변화 없음).\n'+
      '분모: KB 55,538,715원 + ISA 최신 총액 9,150,078원 · 계좌별 기준시각 다름.');
    await page.evaluate(()=>window.scrollTo(0,document.documentElement.scrollHeight));
    const scenario=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,
      bottom:document.querySelector('#weightResult').getBoundingClientRect().bottom,
      navTop:document.querySelector('.nav').getBoundingClientRect().top}));
    assert.equal(scenario.overflow,false,`${width}px target-weight scenario overflow`);
    assert.ok(scenario.bottom<=scenario.navTop,`${width}px scenario hidden by navigation`);
    await page.screenshot({path:`mobile-artifacts/weight-scenario-${width}.png`,fullPage:true});
    await page.close();
  }
}finally{await browser.close()}
console.log('AI answer 360 / 390 / 402 / 430px layout passed (emulated)');

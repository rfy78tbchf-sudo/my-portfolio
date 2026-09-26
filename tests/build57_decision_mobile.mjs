import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {chromium} from 'playwright';

const source=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const css=source.slice(source.indexOf('<style>')+7,source.indexOf('</style>'));
const start=source.indexOf('  function decisionHomeCard(){');
const finish=source.indexOf('  function benchmarkCard(){',start);
const live={risk:{ok:true,largest_symbol:'LONG',largest_krw:123456789,
  valuation_time_aligned:true,as_of:'2026-09-26T00:00:00Z'},
  decisionMetrics:{ok:true,observation_at:'2026-09-26T00:00:00Z',
    position:{symbol:'LONG',value:123456789,weight_pct:24.12},
    denominator:{value:511345671},scenario:{impact_krw:-12345678.9}},
  securities:[{id:'synthetic',symbol:'LONG',name:'Synthetic Very Long Semiconductor Index Fund Example'}]};
const scope=vm.createContext({live,esc:x=>String(x),money:n=>Math.round(Number(n)).toLocaleString('ko-KR')+'원',
  signedMoney:n=>Number(n)>0?'+'+Math.round(Number(n)).toLocaleString('ko-KR')+'원':Math.round(Number(n)).toLocaleString('ko-KR')+'원',
  num:(n,d)=>Number(n).toFixed(d),kstStamp:x=>x,Date,Number,String});
vm.runInContext(source.slice(start,finish),scope);
const card=vm.runInContext('decisionHomeCard()',scope);
const pageHtml=`<!doctype html><html lang="ko"><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body><main class="shell"><div class="content"><section class="hero"><div class="asset">511,345,671원</div></section>${card}</div></main><nav class="nav"><button>홈</button><button>포트폴리오</button><button>성과</button><button>분석</button><button>더보기</button></nav></body></html>`;
const browser=await chromium.launch({headless:true});
try{
  for(const width of [390,402,430]){
    const page=await browser.newPage({viewport:{width,height:844},isMobile:true,hasTouch:true,locale:'ko-KR'});
    await page.setContent(pageHtml);
    await page.getByText('유지와 일부 축소 비교').click();
    for(const zoom of width===390?[1,1.25]:[1]){
      await page.evaluate(value=>document.documentElement.style.zoom=String(value),zoom);
      const boxes=await page.evaluate(()=>({scrollWidth:document.documentElement.scrollWidth,
        innerWidth,button:document.querySelector('[data-decision-ai]').getBoundingClientRect().width,
        last:document.querySelector('#homeWeightResult').getBoundingClientRect().bottom,
        nav:document.querySelector('.nav').getBoundingClientRect().top}));
      assert.ok(boxes.scrollWidth<=boxes.innerWidth,`${width}px ${zoom} horizontal overflow`);
      assert.ok(boxes.button>=72,`${width}px ${zoom} AI action remains tappable`);
      await page.locator('#homeWeightTarget').fill('10');
      assert.equal(await page.locator('#homeWeightTarget').inputValue(),'10');
      assert.ok(await page.getByText('AI 의견 받기').isVisible());
      await page.evaluate(()=>window.scrollTo(0,document.body.scrollHeight));
      const end=await page.evaluate(()=>({card:document.querySelector('.decision-card').getBoundingClientRect().bottom,
        nav:document.querySelector('.nav').getBoundingClientRect().top}));
      assert.ok(end.card<=end.nav,`${width}px ${zoom} last decision content remains above navigation`);
    }
    await page.close();
  }
}finally{await browser.close()}
console.log('Build 57 decision entry and target input fit at 390 / 402 / 430px, 125% zoom');

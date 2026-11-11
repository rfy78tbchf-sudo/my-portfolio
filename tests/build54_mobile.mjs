import assert from 'node:assert/strict';
import {readFileSync,mkdirSync} from 'node:fs';
import vm from 'node:vm';
import {chromium} from 'playwright';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const css=html.slice(html.indexOf('<style>')+7,html.indexOf('</style>'));
const ui=readFileSync(new URL('../realized-sales-ui.js',import.meta.url),'utf8');
const ctx=vm.createContext({window:{}});vm.runInContext(ui,ctx);
const long='Synthetic Very Long Semiconductor Index Fund Example';
const rows=[{symbol:'LONG',name:long,currency:'USD',transaction_id:'synthetic-1',
  trade_date:'2026-09-18',quantity:12345,status:'calculated',realized_local:-12345678.9,
  allocated_cost:92345678.9,net_proceeds:80000000,
  historical_krw_estimate:-1234567890,reference_krw:-19000000000,
  reference_fx_date:'2026-09-26',reference_fx_source:'synthetic'},
  {symbol:'MIX',name:'Pending settlement and execution order',transaction_id:'synthetic-2',
   trade_date:'2026-09-18',ledger_date:'2026-09-22',quantity:100,currency:'USD',
   status:'order_unverified',realized_local:null}];
const part=ctx.window.realizedSalesUi.section({accounts:[{id:'a',provider:'kb_securities',name:'Main'},
  {id:'b',provider:'kb_securities_manual',name:'ISA'}],realizedSales:{ok:true,
  period_start:'2026-08-26',period_end:'2026-09-26',candidate_count:2,
  ready_count:1,partial_count:0,order_unverified_count:1,cost_review_count:0,
  source_review_count:0,calculation_version:'realized-sales-v2',items:rows}},'1M','a');
const doc=`<!doctype html><html lang="ko"><head><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>${css}</style></head><body><main class="shell"><div class="content">${part}</div><nav class="nav"><button>홈</button><button>포트폴리오</button><button>성과</button><button>분석</button><button>설정</button></nav></main></body></html>`;
mkdirSync('mobile-artifacts',{recursive:true});
const browser=await chromium.launch({headless:true});
try{
  for(const width of [390,402,430]){
    const page=await browser.newPage({viewport:{width,height:844},isMobile:true,hasTouch:true,locale:'ko-KR'});
    await page.setContent(doc);
    await page.locator('details.more-list').first().evaluate(el=>el.open=true);
    for(const zoom of width===390?[1,1.25]:[1]){
      await page.evaluate(z=>document.documentElement.style.zoom=String(z),zoom);
      const state=await page.evaluate(()=>{
        window.scrollTo(0,document.body.scrollHeight);
        const total=document.querySelector('.realized-total-row strong');
        const totalRect=total.getBoundingClientRect();
        const totalRow=total.closest('.realized-total-row').getBoundingClientRect();
        return {overflow:document.documentElement.scrollWidth>innerWidth,
          totalUnbroken:getComputedStyle(total).whiteSpace==='nowrap',
          totalFits:total.scrollWidth<=total.clientWidth&&totalRect.left>=totalRow.left&&totalRect.right<=totalRow.right,
          last:document.querySelector('.sold-ledger-row:last-of-type')?.getBoundingClientRect().bottom,
          nav:document.querySelector('.nav').getBoundingClientRect().top,
          pageHeight:document.documentElement.scrollHeight};
      });
      assert.equal(state.overflow,false,`${width}px ${zoom}x horizontal overflow`);
      assert.ok(state.totalUnbroken&&state.totalFits,`${width}px ${zoom}x total amount and unit fit unbroken`);
      assert.ok(state.pageHeight>844,`${width}px ${zoom}x scroll available`);
      await page.screenshot({path:`mobile-artifacts/realized-sales-${width}-${zoom}.png`,fullPage:true});
    }
    await page.close();
  }
}finally{await browser.close()}
console.log('Build 54 realized sales mobile 390 / 402 / 430px and 125% zoom passed (emulated)');

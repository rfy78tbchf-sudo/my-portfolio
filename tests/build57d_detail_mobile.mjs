import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {chromium} from 'playwright';

// The same production detail component runs against an isolated owner-scoped fixture.
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const styles=html.slice(html.indexOf('<style>')+7,html.indexOf('</style>'));
const start=html.indexOf('  function comparisonHtml('),end=html.indexOf('  function empty(',start);
assert.ok(start>0&&end>start);
const browser=await chromium.launch({headless:true});
try{
  for(const width of [390,402,430]){
    const page=await browser.newPage({viewport:{width,height:844},isMobile:true,hasTouch:true});
    await page.setContent(`<meta name="viewport" content="width=device-width,initial-scale=1"><style>${styles}</style><main class="shell"><div id="detailModal" class="detail-modal hidden"><div id="detailBody" class="detail-body"></div></div></main>`);
    await page.evaluate(source=>{
      const fake=`
        var live={securityMap:{held:{id:'held',symbol:'TEST',name:'First issuer',currency:'USD'},other:{id:'other',symbol:'NEXT',name:'Second issuer',currency:'USD'}},
          holdings:[{security_id:'held',quantity:10,account_id:'own',as_of:'2026-09-26'},
            {security_id:'other',quantity:4,account_id:'own',as_of:'2026-09-26'}],
          holdingBasis:[{security_id:'held',account_id:'own',valuation_krw:10000,pnl_krw:500},
            {security_id:'other',account_id:'own',valuation_krw:4000,pnl_krw:-100}],accounts:[{id:'own',name:'Fixture only'}],settlementBasis:[],
          decisionMetrics:{ok:true,position:{symbol:'TEST',weight_pct:20}}};
        var detailLoading=false,stored=[],SUPABASE_URL='https://example.invalid',SUPABASE_KEY='test-only';
        var esc=x=>String(x).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
        var num=(x,d)=>Number(x).toFixed(d),money=x=>Math.round(Number(x)).toLocaleString('ko-KR')+'원';
        var signedMoney=x=>(Number(x)>0?'+':'')+money(x),amountHtml=money,cls=()=>'',price=money,kstStamp=String;
        var metric=(name,value)=>'<div class="metric"><span>'+name+'</span><b>'+value+'</b></div>';
        var securityChart=()=>'',interpretTechnical=()=>'',thesisEditor=()=>'<form id="thesisForm"><textarea data-thesis-field="rationale"></textarea><button type="submit">저장</button><span id="thesisStatus"></span></form>';
        var authFetch=async()=>({ok:true,json:async()=>[]});
        var rpc=async function(name,p){
          if(name==='get_live_security_detail')throw Error('security not found');
          if(name==='get_live_security_activity')return {items:[]};
          if(name==='get_investment_thesis')return {thesis:{version:1,rationale:p.p_security_id==='held'?'My TEST reason':'My NEXT reason'}};
          if(name==='get_investment_decisions')return stored.filter(x=>x.security_id===p.p_security_id);
          if(name==='save_investment_decision'){stored.unshift({...p,security_id:p.p_security_id,reason:p.p_reason,review_condition:p.p_review_condition,choice:p.p_choice,created_at:'2026-09-26'});return {ok:true,id:'fixture-id'}};
          if(name==='get_live_choice_comparison')return {ok:true,observation_at:'2026-09-26',assets_before_krw:50000,current_cash_kb_krw:null,
            price_assumptions:{down_pct:p.p_down_pct,up_pct:p.p_up_pct},
            hold:{quantity:10,value_krw:10000,weight_pct:20,down_impact_krw:-1000,up_impact_krw:1000},
            reduce:{quantity_reference:5,value_krw:5000,weight_pct:10,cash_increase_krw:5000,down_impact_krw:-500,up_impact_krw:500}};
          throw Error('unexpected '+name)
        };
      `;
      (0,eval)(fake+source+'\nwindow.openTestDetail=openSecurityDetail');
      window.openTestDetail('held');
    },html.slice(start,end));
    await page.getByText('My TEST reason').first().waitFor();
    assert.ok(await page.getByText('추가 조회 실패').isVisible());
    await page.locator('#detailWeightTarget').fill('10');
    await page.locator('#detailWeightRun').click();
    assert.ok(await page.getByText('+1,000원').isVisible());
    assert.ok(await page.getByText('-500원').isVisible());
    await page.locator('#detailReason').fill('I can absorb this exposure');
    await page.locator('#detailReview').fill('Recheck the reported operating result');
    await page.locator('#detailDecisionForm button[type=submit]').click();
    await page.getByText('내 판단 저장 완료').waitFor();
    await page.evaluate(()=>window.openTestDetail('held'));
    await page.getByText('I can absorb this exposure').waitFor({state:'attached'});
    await page.evaluate(()=>window.openTestDetail('other'));
    await page.getByText('My NEXT reason').first().waitFor();
    assert.equal(await page.getByText('My TEST reason').count(),0);
    assert.equal(await page.getByText('I can absorb this exposure').count(),0);
    const over=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
    assert.equal(over,false,`${width}px stock detail should not overflow`);
    await page.close();
  }
}finally{await browser.close()}
console.log('Detail keeps thesis after quote failure; isolated choice, decision and second stock work at 390/402/430px');

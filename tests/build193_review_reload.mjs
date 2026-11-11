import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(process.env.PORTFOLIO_HTML||new URL('../index.html',import.meta.url),'utf8');
const saved={id:'saved-193',security_id:'s0',choice:'hold',reason:'내가 저장한 이유',review_condition:'2026-10-11',created_at:'2026-10-10T00:00:00Z'};
let fail=false;
const c=vm.createContext({live:{reviewDecisions:[],priceMeta:{}},mode:'live',kstDaysAgo:()=> '2026-09-20',render(){},esc:String,
  rest:async path=>{if(!path.startsWith('investment_decisions?'))return [];if(fail)throw Error('offline');
    const fields=new URLSearchParams(path.split('?')[1]).get('select').split(',');
    return [Object.fromEntries(fields.map(k=>[k,saved[k]]))];}
});
function extract(a,b){return source.slice(source.indexOf(a),source.indexOf(b,source.indexOf(a)))}
vm.runInContext(extract('  function loadHomeReviewData(', '  function showApp(')+extract('  function homeReviewEntryHtml(', '  function decisionReviewHtml('),c);
for(let visit=0;visit<2;visit++){
  c.live={reviewDecisions:[],priceMeta:{}};
  await c.loadHomeReviewData(c.live,()=>true);
  const home=c.live.reviewDecisions[0];
  assert.equal(home.id,saved.id,'fresh visit must load decision identity from selected API columns');
  const entry={securityId:home.security_id,decisionId:home.id,reason:'점검 날짜 도래'};
  assert.match(c.homeReviewEntryHtml(entry,'s0',saved),/점검 날짜 도래/);
  assert.match(c.homeReviewEntryHtml(entry,'s0',{...saved,id:'new-decision'}),/기록이 변경/);
  assert.equal(home.reason,saved.reason);assert.equal(home.review_condition,saved.review_condition);
}
fail=true;await c.loadHomeReviewData(c.live,()=>true);
assert.equal(c.live.reviewDecisions[0].id,saved.id);assert.match(c.live.homeReviewError,/판단/);
console.log('Build193: selected-column API reload preserves judgment identity, reason and checkpoint; real changes guarded; failed refresh retains confirmed record');

import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
let owner='alice';const stored=new Map();
const c=vm.createContext({localStorage:{getItem:k=>stored.get(k)},decisionDraftKey:id=>'portfolio_decision_draft_v1:'+owner+':'+id,
 esc:x=>String(x).replaceAll('<','&lt;').replaceAll('"','&quot;'),kstDate:()=> '2026-10-20'});
vm.runInContext(html.slice(html.indexOf('  function decisionConditionState('),html.indexOf('  function officialPeriodKo('))+html.slice(html.indexOf('  function homeCheckItems('),html.indexOf('  function homeReviewTitle(')),c);
c.live={holdings:[{security_id:'a',quantity:1},{security_id:'b',quantity:2},{security_id:'a',quantity:3},{security_id:'sold',quantity:0}],
 securityMap:{a:{name:'Alpha',symbol:'ALFA'},b:{name:'Beta',symbol:'BETA'}},
 reviewDecisions:[{id:'older',security_id:'a',created_at:'2026-10-01',review_condition:'2026-10-01'},
 {id:'latest',security_id:'a',created_at:'2026-10-19',review_condition:'2026-11-01',reason:'<private>'},
 {id:'due',security_id:'b',created_at:'2026-10-19',review_condition:'2026-10-20',reason:'Check earnings'}]};
assert.equal(c.homeCheckItems().length,2,'aggregate multiple accounts and omit sold holdings');
assert.equal(c.homeCheckItems()[0].id,'b','only latest saved condition determines initial priority');
assert.match(c.homeCheckCard(),/data-decision-detail="b"/);
stored.set(c.homeCheckKey(),'a');assert.match(c.homeCheckCard(),/data-decision-detail="a"/,'explicit selection wins over initial ordering');
assert.doesNotMatch(c.homeCheckCard(),/<private>/);
owner='bob';assert.match(c.homeCheckCard(),/data-decision-detail="b"/,'other owner does not inherit cursor');
stored.set(c.homeCheckKey(),'sold');assert.match(c.homeCheckCard(),/data-decision-detail="b"/,'removed security falls back to held security');
c.live.reviewDecisions=[];c.live.homeReviewLoading=true;assert.match(c.homeCheckCard(),/지난 판단 확인 중/);assert.doesNotMatch(c.homeCheckCard(),/저장한 판단이 없습니다/);
c.live.homeReviewLoading=false;c.live.homeReviewError='offline';assert.match(c.homeCheckCard(),/판단 기록 조회 실패/);
assert.equal(stored.size,2,'rendering does not mark viewed, save, or acknowledge anything');
console.log('Build213: latest-condition priority, owner-scoped selection, removed holdings, escaping and missing-history states passed');

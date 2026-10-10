import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {test} from 'node:test';
const source=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const slice=(a,b)=>source.slice(source.indexOf(a),source.indexOf(b,source.indexOf(a)));
const code=slice('  function decisionDraftKey(', '  function readDecisionDraft(')+slice('  function decisionConditionState(', '  function officialPeriodKo(')+slice('  function reviewHomeCard(', '  function benchmarkCard(');
const token=sub=>({accessToken:'test.'+Buffer.from(JSON.stringify({sub})).toString('base64url')+'.test'});
const storage=()=>{const map=new Map();return {getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k),map}};
function fixture(store=storage(),owner='one',condition='종가 100 달러 이하'){
 const d={security_id:'a',created_at:'2026-10-01T00:00:00Z',choice:'hold',reason:'성장 확인',review_condition:condition,thesis_version:1,price_snapshot:{price_date:'2026-10-01',currency:'USD'}};
 const q={price_date:'2026-10-09',currency:'USD',close:90};
 const c=vm.createContext({session:token(owner),localStorage:store,atob,esc:String,kstStamp:String,kstDate:()=> '2026-10-10',live:{securityMap:{a:{id:'a',symbol:'A',name:'Alpha'}},holdings:[{security_id:'a',quantity:1}],reviewDecisions:[d],reviewAnalyses:[],priceMeta:{a:{latest:q}}}});
 vm.runInContext(code,c);
 const fingerprint=()=>c.homeReviewFingerprint(d,c.decisionConditionState(d,q,c.kstDate(),false),q,[]);
 const acknowledge=()=>c.writeHomeReviewAcknowledgement('a',fingerprint(),c.homeReviewAcknowledgementKey('a'));
 return {c,d,q,store,fingerprint,acknowledge};
}
test('reading home never acknowledges; explicit check survives a new runtime',()=>{
 const f=fixture();const before=JSON.stringify(f.c.live);assert.match(f.c.reviewHomeCard(),/다시 점검할 판단 1개/);assert.equal(f.store.map.size,0);
 assert.equal(f.acknowledge(),true);assert.match(f.c.reviewHomeCard(true),/확인한 항목 1개/);assert.doesNotMatch(f.c.reviewHomeCard(),/다시 점검할 판단 1개/);
 assert.match(fixture(f.store).c.reviewHomeCard(true),/새로 점검할 항목 없음/);assert.equal(JSON.stringify(f.c.live),before);
});
test('account isolation, refreshed tokens and stale owner writes',()=>{
 const f=fixture();const ownerKey=f.c.homeReviewAcknowledgementKey('a');f.acknowledge();
 const other=fixture(f.store,'two');assert.match(other.c.reviewHomeCard(),/다시 점검할 판단 1개/);
 assert.equal(other.c.writeHomeReviewAcknowledgement('a',f.fingerprint(),ownerKey),false);
 assert.match(fixture(f.store,'one').c.reviewHomeCard(true),/확인한 항목 1개/);
});
test('new close or corrected same-date close returns the reminder',()=>{
 const f=fixture();f.acknowledge();f.q.price_date='2026-10-10';assert.match(f.c.reviewHomeCard(),/다시 점검할 판단 1개/);
 f.acknowledge();f.q.close=89;assert.match(f.c.reviewHomeCard(),/다시 점검할 판단 1개/);
});
test('due date remains checked tomorrow; new decision returns it',()=>{
 const f=fixture(storage(),'one','2026-10-05');f.acknowledge();f.c.kstDate=()=> '2026-10-11';assert.match(f.c.reviewHomeCard(true),/확인한 항목 1개/);
 f.d.created_at='2026-10-02T00:00:00Z';assert.match(f.c.reviewHomeCard(),/다시 점검할 판단 1개/);
});
test('all distinct official documents matter; ordering and duplicates do not',()=>{
 const f=fixture(),state=f.c.decisionConditionState(f.d,f.q,'2026-10-10',false),doc={url:'https://example.test/one',published_on:'2026-10-09'};
 const fingerprint=docs=>f.c.homeReviewFingerprint(f.d,state,f.q,docs);
 assert.equal(fingerprint([doc,doc]),fingerprint([doc]));const second={...doc,url:'https://example.test/two'};
 assert.equal(fingerprint([doc,second]),fingerprint([second,doc]));assert.notEqual(fingerprint([doc]),fingerprint([doc,second]));
});
test('undo persists and never changes a saved judgment',()=>{
 const f=fixture();f.acknowledge();assert.equal(f.c.writeHomeReviewAcknowledgement('a',null,f.c.homeReviewAcknowledgementKey('a')),true);
 assert.match(fixture(f.store).c.reviewHomeCard(),/다시 점검할 판단 1개/);
});
test('missing data remains unknown even after a prior acknowledgement',()=>{
 const f=fixture();f.acknowledge();f.q.close=null;assert.match(f.c.reviewHomeCard(true),/자료·조건 확인 1개/);assert.doesNotMatch(f.c.reviewHomeCard(),/data-home-review-ack=/);
});
test('blocked, corrupt or unscoped storage cannot silently suppress a reminder',()=>{
 const f=fixture();f.store.setItem=()=>{throw Error('quota')};assert.equal(f.acknowledge(),false);assert.match(f.c.reviewHomeCard(),/다시 점검할 판단 1개/);
 f.store.map.set(f.c.homeReviewAcknowledgementKey('a'),'{broken');assert.match(f.c.reviewHomeCard(),/다시 점검할 판단 1개/);
 f.c.session=null;assert.equal(f.acknowledge(),false);assert.match(f.c.reviewHomeCard(),/다시 점검할 판단 1개/);
});

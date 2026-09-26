import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';

const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const ai=readFileSync(new URL('../app-enhancements.js',import.meta.url),'utf8');
const sw=readFileSync(new URL('../sw.js',import.meta.url),'utf8');
assert.match(html,/app-enhancements\.js\?v=57g/,'page requests a new URL for the AI UI');
assert.match(html,/thesis-review-v3/,'updated evidence cannot reuse the old generic analysis');
assert.match(html,/controllerchange/,'installed PWA reloads after worker update');
const start=ai.indexOf('  function aiCard(){'),end=ai.indexOf('  async function ask(',start);
assert.ok(start>0&&end>start);
const cx=vm.createContext({context:{live:{holdings:[]}},window:{}});
vm.runInContext(ai.slice(start,end),cx);
const panel=vm.runInContext('aiCard()',cx);
assert.equal((panel.match(/id="aiConnectionCheck"/g)||[]).length,1);
assert.ok(panel.indexOf('내 데이터로 분석')<panel.indexOf('AI 연결 상태 확인'),
  'the question and decision come before server configuration details');
const idStart=ai.indexOf('  var analysisFailures='),idEnd=ai.indexOf('  async function ask(',idStart);
assert.ok(idStart>0&&idEnd>idStart);
const idScope=vm.createContext({context:{live:{}},crypto:webcrypto,TextEncoder,Uint8Array,Date});
vm.runInContext(ai.slice(idStart,idEnd),idScope);
const first=await vm.runInContext("analysisRequestId('저장한 논리','ARM',1)",idScope);
assert.equal(await vm.runInContext("analysisRequestId('저장한 논리','ARM',1)",idScope),first);
assert.notEqual(await vm.runInContext("analysisRequestId('저장한 논리','ARM',2)",idScope),first,
  'saving a new thesis version must create a new analysis request');
vm.runInContext("advanceAnalysisRequestId('저장한 논리','ARM',1)",idScope);
assert.notEqual(await vm.runInContext("analysisRequestId('저장한 논리','ARM',1)",idScope),first,
  'an explicitly failed model response can be retried with a fresh request ID');

const callbacks={};let network='fresh',cached='old';
const worker=vm.createContext({
  self:{location:{origin:'https://example.test'},addEventListener:(name,cb)=>callbacks[name]=cb,
    skipWaiting:()=>{},clients:{claim:()=>{}}},
  caches:{match:async()=>cached,open:async()=>({put:async()=>{},addAll:async()=>{}}),keys:async()=>[]},
  fetch:async()=>network==='offline'?Promise.reject(Error('offline')):
    {ok:true,body:network,clone(){return this}},URL,
});
vm.runInContext(sw,worker);
const request={url:'https://example.test/app-enhancements.js?v=57g',method:'GET',mode:'cors'};
async function ask(){let response;callbacks.fetch({request,respondWith(p){response=p}});return response}
assert.equal((await ask()).body,'fresh','new AI script wins over stale Cache Storage');
network='offline';assert.equal(await ask(),'old','offline cache still works');
console.log('build49d AI button, versioned script and PWA network-first refresh passed');

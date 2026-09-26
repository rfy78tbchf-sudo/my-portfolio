import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source=readFileSync(new URL('../app-enhancements.js',import.meta.url),'utf8');
const answerBegin=source.indexOf('  function renderAiAnswer(');
const answerEnd=source.indexOf('  async function ask(',answerBegin);
const historyBegin=source.indexOf('  async function loadPrevious(');
const historyEnd=source.indexOf('  window.portfolioEnhance=',historyBegin);
assert.ok(answerBegin>0&&historyBegin>answerEnd&&historyEnd>historyBegin);
function node(tag){return {tag,children:[],isConnected:true,open:false,_text:'',
  appendChild(child){this.children.push(child);return child},
  set textContent(value){this._text=String(value);this.children=[]},
  get textContent(){return this._text+this.children.map(child=>child.textContent).join('')}}}
const previous=node('div');
const data={id:'synthetic-record-id',question:'현재 집중 위험은?',
  answer:'핵심 의견: 한 종목의 비중을 점검하세요.\n내 계좌 근거: 참고 비중 24%.\n선택지 비교: 유지하거나 목표 비중을 정해 비교하세요.\n다음 점검 조건: 직접 정한 목표 비중.\n자료 상태: 계좌별 관측 시각이 다릅니다.',
  created_at:'2026-09-26T10:00:00Z',observation_at:'2026-09-26T09:55:00Z',
  calculation_version:'synthetic-v1',response_kind:'model_interpretation_server_metrics'};
const dom=vm.createContext({window:{},Date,document:{createElement:node,createTextNode:text=>({textContent:text}),
  getElementById:id=>id==='aiPrevious'?previous:null}});
vm.runInContext(source.slice(answerBegin,answerEnd)+source.slice(historyBegin,historyEnd),dom);
const ctx={publicKey:'public-test-key',live:{},supabaseUrl:'https://example.invalid',
  authFetch:async()=>({ok:true,json:async()=>[data,{...data,id:'another-synthetic-record-id'}]})};
dom.ctx=ctx;await vm.runInContext('loadPrevious(ctx)',dom);
assert.equal(previous.children.length,2,'all saved answers remain available');
const first=previous.children[0];
assert.equal(first.open,false,'previous answers do not auto-expand below the current answer');
assert.match(first.children[0].textContent,/현재 집중 위험은/);
assert.doesNotMatch(first.children[0].textContent,/synthetic-record-id/,'internal IDs are not list labels');
const body=first.children[1];
assert.equal(body.textContent.match(/한 종목의 비중을 점검하세요/g)?.length,1,'expanded answer has no duplicated lead');
assert.equal(body.children.at(-1).open,false,'metadata starts collapsed');
assert.match(body.children.at(-1).textContent,/synthetic-record-id/,'stored evidence remains accessible');
assert.match(source,/id="aiBasisDetails"[^>]*hidden/,'current answer metadata starts collapsed');
console.log('Saved answers keep a compact list, one readable answer, and accessible provenance');

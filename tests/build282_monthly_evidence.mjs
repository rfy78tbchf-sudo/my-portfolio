import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const html=fs.readFileSync('index.html','utf8');
const code=html.slice(html.indexOf('  function wealthMonthlySourceTime('),html.indexOf('  function wealthPanel('));
const scope=vm.createContext({esc:s=>String(s).replaceAll('<','&lt;')});vm.runInContext(code,scope);
const record={as_of:'2025-02-15',amount:12000000,finalized:true,source:{ok:true,primary_at:'2025-02-15T12:10:05Z',isa_at:'2025-02-10T04:57:00+00:00'}};
const before=JSON.stringify(record), rendered=scope.wealthMonthlyEvidenceHtml(record);
assert.match(rendered,/2025-02-15 21:10 KST/);assert.match(rendered,/2025-02-10 13:57 KST/);
assert.match(rendered,/기록 저장 · 날짜 마감/);assert.match(rendered,/금융 검증 별도 확인 필요/);
assert.doesNotMatch(rendered,/검증 완료|기록 완료|손실/);assert.equal(JSON.stringify(record),before);
assert.match(scope.wealthMonthlyEvidenceHtml({...record,finalized:false}),/당일 갱신 중/);
for(const source of [undefined,{}, {primary_at:'invalid',isa_at:'2025-02-15T12:00:00'}, {primary_at:null,isa_at:'<img>'}]){
 const result=scope.wealthMonthlyEvidenceHtml({finalized:true,source});assert.equal((result.match(/기준 시각 미확인/g)||[]).length,2);assert.doesNotMatch(result,/<img>|NaN|undefined/);
}
assert.equal(scope.wealthMonthlySourceTime('2025-02-15T18:00:00Z'),'2025-02-16 03:00 KST');
assert.match(html,/wealthMonthlyEvidenceHtml\(r\)/);
console.log('Build282: stored source dates, KST boundary, missing timestamps, finalization versus verification and immutable input passed');

assert.equal((html.match(/wealthMonthlyEvidenceHtml\(r\)/g)||[]).length,2);assert.match(html,/wealthMonthlyEvidenceHtml\(x\)/);

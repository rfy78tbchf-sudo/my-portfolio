import assert from 'node:assert/strict';import vm from 'node:vm';import {readFileSync} from 'node:fs';
const s=readFileSync(new URL('../index.html',import.meta.url),'utf8'),c=vm.createContext({esc:x=>String(x).replaceAll('<','&lt;')});
vm.runInContext(s.slice(s.indexOf('  function homeReviewEntryHtml('),s.indexOf('  function decisionReviewHtml(')),c);
const entry={securityId:'a',decisionId:'d1',reason:'점검 날짜 도래 · 2026-10-11 <script>'},latest={id:'d1',reason:'내 판단 이유'};
assert.match(c.homeReviewEntryHtml(entry,'a',latest),/점검 날짜 도래/);assert.match(c.homeReviewEntryHtml(entry,'a',latest),/&lt;script>/);
assert.equal(c.homeReviewEntryHtml(entry,'b',latest),'');assert.equal(c.homeReviewEntryHtml(true,'a',latest),'');
assert.match(c.homeReviewEntryHtml(entry,'a',{id:'d2'}),/기록이 변경/);assert.doesNotMatch(c.homeReviewEntryHtml(entry,'a',{id:'d2'}),/날짜 도래/);
assert.match(c.homeReviewEntryHtml(entry,'a',null),/확인하지 못/);assert.equal(latest.reason,'내 판단 이유');
console.log('Build191: source reason escaped, security/decision isolation, changed/missing judgment guard, no reason mutation');

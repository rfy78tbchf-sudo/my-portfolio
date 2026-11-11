import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
const source=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8'),c=vm.createContext({});
vm.runInContext(source.slice(source.indexOf('  function reviewDateAfter('),source.indexOf('  function decisionFollowupDraft(')),c);
for(const [today,days,expected] of [['2026-10-08',7,'2026-10-15'],['2026-12-28',7,'2027-01-04'],['2028-02-25',7,'2028-03-03'],['2026-01-31',30,'2026-03-02'],['2026-02-30',7,''],['invalid',7,''],['2026-10-08',0,'']])assert.equal(c.reviewDateAfter(today,days),expected);
console.log('Build162: explicit 7/30-day checkpoints, month/year/leap boundaries and invalid date rejection passed');

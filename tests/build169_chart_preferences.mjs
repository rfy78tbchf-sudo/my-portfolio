import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
const s=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');let stored=null;
const c=vm.createContext({localStorage:{getItem:()=>stored,setItem:(key,value)=>{assert.equal(key,'portfolio.chart-preferences.v1');stored=value}}});
vm.runInContext(s.slice(s.indexOf('  function readChartPreferences('),s.indexOf('  function openSecurityDetail(')),c);
const read=()=>JSON.parse(JSON.stringify(c.readChartPreferences()));
assert.deepEqual(read(),{period:'all',ma:[20,60]});
stored=JSON.stringify({period:'3',ma:[5,120,999,5]});assert.deepEqual(read(),{period:'3',ma:[5,120]});
stored=JSON.stringify({period:'6',ma:[]});assert.deepEqual(read(),{period:'6',ma:[]});
for(const value of ['broken','null','{"period":"bad","ma":[20]}','{"period":"3","ma":null}']){stored=value;assert.deepEqual(read(),{period:'all',ma:[20,60]})}
c.settings={period:'12',ma:[20,120]};const start=s.indexOf('    function rememberChartSettings(');vm.runInContext(s.slice(start,s.indexOf('\n',start)),c);c.rememberChartSettings();assert.deepEqual(read(),{period:'12',ma:[20,120]});
c.localStorage={getItem(){throw Error('blocked')},setItem(){throw Error('quota')}};assert.deepEqual(read(),{period:'all',ma:[20,60]});assert.doesNotThrow(()=>c.rememberChartSettings());
console.log('Build169: chart preferences persist, validate, preserve no-MA selection and tolerate unavailable storage');

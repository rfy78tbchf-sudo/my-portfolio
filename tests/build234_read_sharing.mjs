import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const code=html.slice(html.indexOf('      var priorHistoryRead=null;'),html.indexOf('      var loadThesisPrior=function()'));
function fixture(symbol){let calls=0,fail=false,release;const ctx=vm.createContext({SUPABASE_URL:'https://synthetic.test',s:{symbol},encodeURIComponent,authFetch:()=>{calls++;return new Promise(r=>release=()=>r({ok:!fail,json:async()=>[{id:calls,symbol}]}))}});vm.runInContext(code,ctx);return {ctx,get calls(){return calls},release(){release()},set fail(v){fail=v}}}
const a=fixture('A'),b=fixture('B');
const first=a.ctx.readPriorHistory();assert.equal(first,a.ctx.readPriorHistory());assert.equal(a.calls,1);assert.equal(a.ctx.priorHistoryRead,first);
const isolated=b.ctx.readPriorHistory();assert.notEqual(first,isolated);b.release();assert.equal((await isolated)[0].symbol,'B');
a.release();assert.equal((await first)[0].id,1);assert.equal(a.ctx.priorHistoryRead,null);
const fresh=a.ctx.readPriorHistory();assert.notEqual(fresh,first);assert.equal(a.calls,2);a.release();assert.equal((await fresh)[0].id,2,'completed results are not cached');
a.fail=true;const failed=a.ctx.readPriorHistory();assert.equal(failed,a.ctx.readPriorHistory());a.release();await assert.rejects(failed);assert.equal(a.ctx.priorHistoryRead,null);
a.fail=false;const retry=a.ctx.readPriorHistory();a.release();assert.equal((await retry)[0].id,4);
console.log('Build234: only in-flight full history is shared; completed/failed reads are cleared; retry and detail-instance isolation pass');

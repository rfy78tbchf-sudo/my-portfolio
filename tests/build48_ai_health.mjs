import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {stripTypeScriptTypes} from 'node:module';

const source=fs.readFileSync(new URL('../supabase/functions/investment-assistant/index.ts',import.meta.url),'utf8');
let handler;
const scope=vm.createContext({
  Deno:{env:{get:()=>''},serve:fn=>{handler=fn}},Request,Response,
  fetch:async()=>{throw Error('health must not call an external model')},
});
vm.runInContext(stripTypeScriptTypes(source.slice(source.indexOf('\n')+1)),scope);
const request=()=>new Request('https://example.test/assistant',{method:'POST',
  headers:{authorization:'Bearer test-session','content-type':'application/json'},body:JSON.stringify({action:'health'})});
scope.userFromToken=async()=> 'synthetic-user';
scope.scopedRequest=async()=>[{id:'synthetic-owned-account'}];
scope.serverRpc=async()=>{throw Error('unreachable secret store')};
let res=await handler(request());
assert.equal(res.status,200);
let body=await res.json();
assert.equal(body.status,'unknown');
assert.equal(body.configured,false);
assert.ok(!JSON.stringify(body).includes('test-only-secret'));
scope.scopedRequest=async()=>[];
res=await handler(request());
assert.equal(res.status,403);
assert.equal((await res.json()).code,'ACCOUNT_ACCESS_DENIED');
scope.scopedRequest=async()=>[{id:'synthetic-owned-account'}];
scope.serverRpc=async()=> '';
body=await (await handler(request())).json();
assert.equal(body.status,'missing');
scope.serverRpc=async()=> 'test-only-secret';
body=await (await handler(request())).json();
assert.equal(body.status,'configured');
assert.equal(body.configured,true);
assert.ok(!JSON.stringify(body).includes('test-only-secret'));
scope.userFromToken=async()=>null;
res=await handler(request());
assert.equal(res.status,401);
assert.ok(!JSON.stringify(await res.json()).includes('test-only-secret'));
console.log('build48 owner-only AI configuration health and secret redaction passed');

import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../supabase/functions/investment-assistant/index.ts',import.meta.url),'utf8');
const body=source.match(/async function providerFailure\(response:Response\)\{[\s\S]*?\n\}\n(?=function query)/)?.[0];
assert.ok(body,'The deployed handler must expose a safe provider error classification');
const warnings=[];
const classify=vm.runInNewContext(`${body.replace('response:Response','response')}\nproviderFailure`,{
  console:{warn:(...args)=>warnings.push(args)},JSON
});
async function check(status,error,expected){
  const result=await classify({status,json:async()=>({error})});
  assert.equal(result.code,expected);
  assert.equal(result.provider_status,status);
  assert.ok(result.message.length>12);
  assert.ok(!JSON.stringify(result).includes('sk-test-secret'));
}
await check(401,{code:'invalid_api_key',message:'sk-test-secret'},'AUTHENTICATION_FAILED');
await check(403,{code:'model_not_found'},'MODEL_ACCESS_PROBLEM');
await check(400,{type:'invalid_request_error'},'AI_REQUEST_REJECTED');
await check(429,{code:'insufficient_quota'},'API_CREDIT_UNAVAILABLE');
await check(429,{code:'rate_limit_exceeded'},'API_LIMIT_REACHED');
await check(503,{message:'sk-test-secret'},'MODEL_CONNECTION_FAILED');
assert.ok(!JSON.stringify(warnings).includes('sk-test-secret'),'Provider error details must never reach logs');
assert.ok(source.includes('return respond(req,await providerFailure(openai),502)'));
console.log('AI provider errors are safely categorized without logging keys or raw error bodies.');

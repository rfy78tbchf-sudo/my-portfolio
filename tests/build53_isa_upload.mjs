import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';

const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const sql=readFileSync(new URL('../supabase/build53_isa_evidence_upload.sql',import.meta.url),'utf8');
const guard=readFileSync(new URL('../supabase/build53c_guard_direct_isa_insert.sql',import.meta.url),'utf8');
assert.match(sql,/on conflict\(account_id,source_reference\) do nothing/);
assert.match(sql,/p_captured_at,null,\s*'user_uploaded_isa:'\|\|p_storage_path/);
assert.match(guard,/exists\(select 1 from storage\.objects o/);
assert.doesNotMatch(sql,/insert into public\.(?:cash_flows|transactions|holdings|daily_account_snapshots)/);

const start=html.indexOf('  function bindIsaTotalObservation(){');
const end=html.indexOf('  function showDemo(){',start);
assert.ok(start>0&&end>start);
const accountId='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const file={type:'image/png',size:4,arrayBuffer:async()=>Uint8Array.of(1,2,3,4).buffer};
const state={calls:[],uploads:[],loaded:0,rendered:0};
const status={textContent:'',className:'status'};
const button={disabled:false};
const form={querySelector:()=>button};
const values={isaTotalForm:form,isaTotalStatus:status,isaScreenshot:{files:[file]},
  isaTotalAmount:{value:'9250000'},isaCaptureTime:{value:'2026-09-26T11:42'}};
const live={accounts:[{id:accountId,provider:'kb_securities_manual',provider_account_ref:'isa-manual'}]};
const ctx=vm.createContext({document:{getElementById:id=>values[id]},live,crypto:webcrypto,
  SUPABASE_URL:'https://example.invalid',authFetch:async(url,opts)=>{
    state.uploads.push({url,opts});return {ok:state.uploads.length===1,status:state.uploads.length===1?200:409};
  },rpc:async(name,args)=>{state.calls.push({name,args});return {used_as_current:true,inserted:state.calls.length===1}},
  loadLive:async()=>{state.loaded++},render:()=>{state.rendered++},isaNotice:''});
vm.runInContext(html.slice(start,end),ctx);
vm.runInContext('bindIsaTotalObservation()',ctx);
async function submit(){await form.onsubmit({preventDefault(){}})}
await submit();
await submit(); // Duplicate file is accepted, with the same identity/path.
assert.equal(state.calls.length,2);
assert.equal(state.calls[0].name,'save_isa_total_from_evidence');
assert.equal(state.calls[0].args.p_total_assets,9250000);
assert.equal(state.calls[0].args.p_captured_at,'2026-09-26T02:42:00.000Z');
assert.match(state.calls[0].args.p_storage_path,new RegExp('^'+accountId+'/isa/[0-9a-f]{64}\\.png$'));
assert.equal(state.calls[1].args.p_storage_path,state.calls[0].args.p_storage_path);
assert.equal(state.loaded,2);
assert.equal(state.rendered,2);
assert.equal(state.uploads[0].opts.method,'POST');
assert.equal(state.uploads[0].opts.headers['x-upsert'],'false');
assert.equal(state.uploads[0].opts.body,file);
assert.doesNotMatch(JSON.stringify(state.calls),/cash_flows|holdings|transactions/);

values.isaTotalAmount.value='9250001';
values.isaScreenshot.files=[{...file,size:5*1024*1024+1}];
await submit();
assert.equal(state.calls.length,2,'oversized evidence never writes an observation');
console.log('Build 53 ISA evidence upload, idempotent path, KST capture, input gate passed');

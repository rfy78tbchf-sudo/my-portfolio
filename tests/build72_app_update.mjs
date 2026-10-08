import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const code=html.slice(html.indexOf("  var appBuild="),html.indexOf('  window.__MY_PORTFOLIO_READY__'));
for(const version of ['same','new','failed']){
 const nodes=[],events={},requests=[];let replacements=0;
 const document={visibilityState:'visible',getElementById:id=>nodes.find(n=>n.id===id),createElement:()=>({style:{},setAttribute(){},append(...children){this.children=children}}),body:{appendChild:n=>nodes.push(n)},addEventListener:(name,fn)=>events[name]=fn};
 const context={document,window:{addEventListener:(name,fn)=>events[name]=fn},location:{protocol:'https:',href:'https://example.com/app/',replace:()=>replacements++},navigator:{},URL,Date,fetch:async(url,options)=>{requests.push({url,options});return {ok:version!=='failed',text:async()=>version==='same'?html:'<!-- build: future -->'}}};
 vm.createContext(context);vm.runInContext(code,context);events.visibilitychange();await new Promise(r=>setTimeout(r,0));
 assert.equal(requests.length,1);assert.equal(requests[0].options.cache,'no-store');assert.equal(replacements,0,'never discard draft automatically');
 assert.equal(nodes.length,version==='new'?1:0);
 if(version==='new'){nodes[0].children[1].onclick();assert.equal(replacements,1)}
}
assert.match(html,/detail-overview'\)\.after\(startPanel,extras\)/);
const change=html.slice(html.indexOf('    var chartChange='),html.indexOf('    var flow='));
assert.ok(!change.includes('입출금·계좌 편입'),'routine caveat is not in chart headline');
console.log('Build72: resumed app checks version; explicit update preserves drafts; first action and quiet chart verified');

assert.equal(html.match(/<!-- build: ([^ ]+) -->/)[1],html.match(/var appBuild='([^']+)'/)[1]);
const sw=readFileSync(new URL('../sw.js',import.meta.url),'utf8');assert.equal(html.match(/var appBuild='[^']*-(\d+)'/)[1],sw.match(/shell-\d+-(\d+)/)[1],'update notice and cached shell share release number');

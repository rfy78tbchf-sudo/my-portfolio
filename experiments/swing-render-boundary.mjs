import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const html=readFileSync('index.html','utf8');
const source=html.slice(html.indexOf('  function loadSwingPrices('),html.indexOf('  function reduceSwingAlerts('));
const removed=source.replace("if(typeof mode!=='undefined'&&mode==='live')render(true)",'');assert.notEqual(removed,source);
async function check(code){let release,painted=false;const flow=new Promise(r=>release=r),target={holdings:[{security_id:'synthetic',quantity:1}]};
 const c=vm.createContext({live:target,mode:'live',rest:async()=>[{price_date:'2026-11-09',close:100,currency:'USD'}],updateSwingAlerts(){target.alertReady=true},render(){painted=!!target.alertReady}});
 vm.runInContext(code,c);const prices=c.loadSwingPrices(target);const completion=Promise.all([flow,prices]).then(()=>c.render());await prices;
 const beforeFlow=painted;release();await completion;assert.equal(painted,true);return beforeFlow;
}
assert.equal(await check(source),true,'completed alerts become visible while unrelated flow basis is pending');
assert.equal(await check(removed),false,'removing the render delays alert display until unrelated work completes');
console.log('Rejected render removal: actual loader early display regresses with a held flow-basis request');

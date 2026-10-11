import assert from 'node:assert/strict';import vm from 'node:vm';import {readFileSync} from 'node:fs';
const source=readFileSync(process.env.PORTFOLIO_HTML||new URL('../index.html',import.meta.url),'utf8');
const fn=source.slice(source.indexOf('  function refreshLive('),source.indexOf('  (function bindPullToRefresh'));
function fixture(review,performance){
  const calls=[],releases=[];let active;
  const c=vm.createContext({mode:'live',document:{visibilityState:'visible'},Date,lastLiveLoadAt:Date.now(),liveRefreshPromise:null,liveError:null,liveAuthEpoch:1,period:'1M',performanceRequestEpoch:7,
    live:{homeReviewError:review,startupHomeError:performance,holdings:[{value:100}]},
    loadLive(){throw Error('must not reload the whole account')},
    loadHomeReviewData(target,check){active=check;calls.push('review');return new Promise(r=>releases.push(r))},
    loadStartupHomeData(target,check,period,epoch){active=check;calls.push([period,epoch]);return new Promise(r=>releases.push(r))}
  });vm.runInContext(fn,c);return {c,calls,releases,check:()=>active()};
}
for(const [review,performance,expected] of [[true,false,['review']],[false,true,[['1M',7]]],[true,true,['review',['1M',7]]],[false,false,[]]]){
  const f=fixture(review,performance),promise=f.c.refreshLive(false);assert.deepEqual(f.calls,expected,'only failed home lanes retry on quick return');
  if(expected.length){assert.equal(f.c.refreshLive(false),promise,'duplicate return events share the request');assert.equal(f.c.live.holdings[0].value,100);assert.equal(f.check(),true);f.c.liveAuthEpoch++;assert.equal(f.check(),false,'old login cannot publish retry results')}
  f.releases.forEach(r=>r());await promise;assert.equal(f.c.liveRefreshPromise,null);
}
const hidden=fixture(true,true);hidden.c.document.visibilityState='hidden';await hidden.c.refreshLive(false);assert.equal(hidden.calls.length,0);
console.log('Build195: isolated failed-lane retry, healthy fast path, coalescing, retained holdings, owner guard and hidden-page guard passed');

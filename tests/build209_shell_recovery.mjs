import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const source=fs.readFileSync(new URL('../sw.js',import.meta.url),'utf8');

async function navigate({cached=null,status=200,body='fresh shell',offline=false,cacheReadError=false,cacheWriteError=false}={}){
  const listeners={},writes=[],waits=[];
  let result,shell=cached?.clone();
  const context=vm.createContext({URL,Response,
    self:{location:{origin:'https://portfolio.test'},addEventListener:(name,fn)=>{listeners[name]=fn}},
    caches:{
      async match(key){assert.equal(key,'./index.html');if(cacheReadError)throw Error('cache read unavailable');return shell?.clone()},
      async open(){return {async put(key,value){if(cacheWriteError)throw Error('cache write unavailable');writes.push(key);shell=value.clone()}}}
    },
    async fetch(_request,options){assert.equal(options.cache,'no-cache');if(offline)throw TypeError('Failed to fetch');return new Response(body,{status})}
  });
  vm.runInContext(source,context);
  listeners.fetch({
    request:{method:'GET',mode:'navigate',url:'https://portfolio.test/my-portfolio/'},
    respondWith(promise){result=promise},waitUntil(promise){waits.push(promise)}
  });
  const response=await result;await Promise.all(waits);
  return {response,writes,waits,shell};
}

for(const condition of [{status:503,body:'temporary outage'},{offline:true}]){
  const r=await navigate({cached:new Response('working shell'),...condition});
  assert.equal(r.response.status,200);assert.equal(await r.response.text(),'working shell');
  assert.equal(await r.shell.text(),'working shell');assert.equal(r.writes.length,0,'failure cannot replace the shell');
}

const fresh=await navigate({cached:new Response('previous shell')});
assert.equal(fresh.response.status,200);assert.equal(await fresh.response.text(),'fresh shell');
assert.deepEqual(fresh.writes,['./index.html']);assert.equal(fresh.waits.length,1,'cache write is retained for the fetch event lifetime');
assert.equal(await fresh.shell.text(),'fresh shell');

for(const status of [403,404,429]){
  const r=await navigate({cached:new Response('working shell'),status,body:'original client error'});
  assert.equal(r.response.status,status);assert.equal(await r.response.text(),'original client error');
  assert.equal(r.writes.length,0,'4xx is returned unchanged and never cached');
}

for(const cached of [null,new Response('previous bad cache',{status:503})]){
  const server=await navigate({cached,status:503,body:'original outage'});
  assert.equal(server.response.status,503);assert.equal(await server.response.text(),'original outage');
  assert.equal(server.writes.length,0,'without a good shell the original HTTP failure is preserved');
  const offline=await navigate({cached,offline:true});
  assert.equal(offline.response.type,'error');assert.equal(offline.response.status,0);
  assert.equal(offline.writes.length,0,'offline cache miss yields an explicit network-error Response');
}

const unreadable=await navigate({cached:new Response('working shell'),status:503,cacheReadError:true});
assert.equal(unreadable.response.status,503,'cache failure retains the real server response');
const unwritable=await navigate({body:'usable online shell',cacheWriteError:true});
assert.equal(await unwritable.response.text(),'usable online shell','cache write failure does not break online navigation');

console.log('Build209: navigation 503/offline shell recovery, preserved 4xx, cache miss and invalid cache, normal success and cache failures passed');

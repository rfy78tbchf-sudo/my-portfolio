// Isolated candidate generator: preserve sequential broker collection and Build264 barrier.
import fs from 'node:fs';import assert from 'node:assert/strict';
const file=process.argv[2];assert.ok(file&&file!=='index.html');
let s=fs.readFileSync(process.env.UI_SOURCE||'index.html','utf8');
const old='    if(syncBroker)liveRefreshPromise.then(function(){return completeBackgroundSync(true,now)}).catch(function(){});';
assert.equal(s.split(old).length,2);s=s.replace(old,'');
const mark="      var homeOnly=typeof currentTab!=='undefined'&&currentTab==='home',tools=document.getElementById('homeTools');";
assert.equal(s.split(mark).length,2);s=s.replace(mark,'      if(syncBroker)completeBackgroundSync(true,now).catch(function(){});\n'+mark);fs.writeFileSync(file,s);

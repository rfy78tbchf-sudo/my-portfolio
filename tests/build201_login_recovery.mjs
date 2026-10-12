import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
const s=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
function setup(){
 let stored={accessToken:'expired-fixture',refreshToken:'fixture-refresh',expiresAt:0},hidden=false,reads=0,starts=0,reply;
 const msg={textContent:''},events={};
 const c=vm.createContext({Promise,Date,JSON,Error,session:stored,refreshPromise:null,liveAuthEpoch:1,SUPABASE_URL:'https://fixture.invalid',SUPABASE_KEY:'fixture',navigator:{onLine:true},
 document:{visibilityState:'visible',getElementById:id=>id==='loginMsg'?msg:{classList:{contains:()=>hidden}},addEventListener:(k,f)=>events[k]=f},window:{addEventListener:(k,f)=>events[k]=f},
 readSession:()=>stored,consumeHash:()=>null,writeSession:x=>{stored=x;c.session=x;if(!x)c.liveAuthEpoch++},startLive:x=>{stored=x;c.session=x;c.liveAuthEpoch++;starts++;hidden=true},
 fetchTimeout:()=>{reads++;return new Promise((resolve,reject)=>{reply={resolve,reject}})}});
 vm.runInContext(s.slice(s.indexOf('  function sessionValid('),s.indexOf('  function ensureFreshSession(')),c);
 vm.runInContext(s.slice(s.indexOf('  var loginRestorePromise='),s.indexOf("  document.addEventListener('visibilitychange',function(){if(document.visibilityState==='visible'&&mode==='live'",s.indexOf('  var loginRestorePromise='))),c);
 return {c,events,msg,get stored(){return stored},get reads(){return reads},get starts(){return starts},fail:()=>reply.reject(Error('offline')),respond:(ok=true)=>reply.resolve({ok,status:ok?200:400,json:async()=>ok?{access_token:'new-fixture',refresh_token:'rotated-fixture',expires_in:3600}:{error_code:'refresh_token_not_found'}})};
}
const t=setup();let p=t.c.restoreLogin();t.fail();await p;assert.ok(t.stored);assert.equal(t.c.loginRecoveryPending,true);assert.equal(t.starts,0);
p=t.events.online();t.events.focus();t.events.pageshow();t.events.visibilitychange();assert.equal(t.reads,2,'resume events share one refresh');t.respond();await p;assert.equal(t.starts,1);assert.equal(t.c.loginRecoveryPending,false);await t.events.online();assert.equal(t.reads,2);
for(const event of ['online','focus','pageshow','visibilitychange']){const a=setup();let p=a.c.restoreLogin();a.fail();await p;p=a.events[event]();a.respond();await p;assert.equal(a.starts,1,event)}
const invalid=setup();p=invalid.c.restoreLogin();invalid.respond(false);await p;assert.equal(invalid.stored,null);assert.equal(invalid.c.loginRecoveryPending,false);await invalid.events.online();assert.equal(invalid.reads,1);assert.match(invalid.msg.textContent,/로그인/);
for(const success of [true,false]){const a=setup();p=a.c.restoreLogin();a.c.writeSession(null);a.c.writeSession({accessToken:'other-fixture',refreshToken:'other-refresh'});a.respond(success);await p;assert.equal(a.stored.refreshToken,'other-refresh');assert.equal(a.starts,0,'stale request cannot replace another login')}
const offline=setup();p=offline.c.restoreLogin();offline.fail();await p;offline.c.navigator.onLine=false;await offline.events.online();assert.equal(offline.reads,1);offline.c.navigator.onLine=true;offline.c.document.visibilityState='hidden';await offline.events.online();assert.equal(offline.reads,1);
assert.ok(!s.includes('homePerformanceControls'));
console.log('Build201: home toolbar reverted; transient login recovery, event deduplication, hidden/offline guards, terminal expiry and changed-session isolation passed (synthetic auth only)');

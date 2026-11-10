// First realized-view interaction during manual refresh with held history/total replies.
import {readFileSync,writeFileSync,unlinkSync} from 'node:fs';import {execFileSync} from 'node:child_process';import {randomUUID} from 'node:crypto';
let s=readFileSync('tests/refresh_view_switch253.mjs','utf8').replaceAll('refreshLive(true,false)','refreshLive(true,true)');
s=s.replace("const file=resolve(root,'.'+url.pathname);", "if(url.pathname==='/version.json')return json(route,{build:source.match(/var appBuild='([^']+)'/)[1]});const file=resolve(root,'.'+url.pathname);");
s=s.replace('const samples=[',"backgroundDelay.release();await page.waitForFunction(()=>window.__dailyTest.state().idle&&!window.__dailyTest.state().background);const samples=[");
const file='tests/.view265-'+randomUUID()+'.mjs';try{writeFileSync(file,s);process.stdout.write(execFileSync(process.execPath,[file],{env:{...process.env,HOLDINGS:'4',REQUIRE_FRESH_SWITCH:'1'},maxBuffer:20000000,stdio:['ignore','pipe','inherit']}))}finally{unlinkSync(file)}

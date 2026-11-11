// Follow-up: hold an already-running realized-details response, then select a new total period.
import {readFileSync,writeFileSync,unlinkSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {execFileSync} from 'node:child_process';
let s=readFileSync('experiments/period-delay255.mjs','utf8');
const delay="if(slow===body.p_period&&path.endsWith('/get_live_period_stock_pnl'))";
const wait="calls.slice(n).some(c=>c.path.endsWith('/get_live_period_stock_pnl')&&c.body.p_period===old)";
if(!s.includes(delay)||!s.includes(wait))throw Error('diagnostic anchors changed');
s=s.replace(delay,"if(slow===body.p_period&&path.endsWith('/get_live_realized_sales'))").replace(wait,"calls.slice(n).some(c=>c.path.endsWith('/get_live_realized_sales')&&c.body.p_period===old)");
s=s.replace("s=s.replace(/  render=","s=s.replace('extraDelayMs:1000','supersededRealizedExtraDelayMs:600');\ns=s.replace(/  render=");
const file='experiments/.realized-delay-'+randomUUID()+'.mjs';
try{writeFileSync(file,s);process.stdout.write(execFileSync(process.execPath,[file],{maxBuffer:20000000,stdio:['ignore','pipe','inherit']}))}finally{unlinkSync(file)}

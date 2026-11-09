// Matched SQL-plan warm-up for the final comparison; application caches remain cold.
import {readFileSync,writeFileSync,unlinkSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';
let source=readFileSync('experiments/realized-browser257.mjs','utf8');
const anchor="let variant='baseline';const sqlTrace=[];";
if(!source.includes(anchor))throw Error('warm-up anchor drift');
source=source.replace(anchor,"for(const p of Object.keys(expected))assert.deepEqual((await db.query('select candidate_realized_sales($1) r',[p])).rows[0].r,expected[p]);\n"+anchor);
const file='experiments/.realized-warm-'+randomUUID()+'.mjs';
try{writeFileSync(file,source);process.stdout.write(execFileSync(process.execPath,[file],{env:process.env,maxBuffer:20000000,stdio:['ignore','pipe','inherit']}))}finally{unlinkSync(file)}

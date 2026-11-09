import {PGlite} from '@electric-sql/pglite';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
const db=new PGlite();
for(const name of ['build125_cash','build125_corporate','build127_distribution','build137_period_cash','build138_period_corporate','build138_period_split','build140_period_membership','build140_period_opening']){
 try {const sql=execFileSync(process.execPath,[`tests/${name}_fixture.mjs`],{encoding:'utf8'});const r=await db.query(sql);console.log(name,JSON.stringify(r.rows));for(const row of r.rows)assert.equal(Number(row.failures),0);}catch(e){console.log(name,e.message);process.exitCode=1;}
}
await db.close();

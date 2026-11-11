import fs from 'node:fs';
const sql=fs.readFileSync('supabase/build137_period_cash.sql','utf8');
const core=sql.slice(sql.indexOf('domestic_raw as materialized ('),sql.indexOf('), pending as materialized ('))+')';
const cases=['normal','loan','negative_cash','combined','bad_sum','bad_raw','missing_field','manual','bad_quantity','negative_fee','foreign','future','buy','wrong_fee','wrong_tax_sum'];
const rows=[],expected=[];
for(const key of cases){
 const raw={dl_amt:'200',ec_amt:'197',fee:'1',tx:'3',arrs_fee:'0',etc_lndng_amt_rpay_amt:'0',incm_tx:'0',dl_tx:'2',rsdnt_tx:'0',ffs_tx:'0',trsf_tx:'0'};
 const t={id:key,security_id:key,account_id:1,type:'sell',currency:'KRW',source:'api',quantity:1,price:200,net_amount:197,fee:1,tax:2,provider_payload:raw,effective_at:'2026-06-01T00:00:00Z',trade_at:'2026-06-03T00:00:00Z',recovered_date:null,group_date_recovered:false};
 let cash=197,verified=true;
 if(key==='loan'){raw.ec_amt='167';raw.etc_lndng_amt_rpay_amt='30';t.net_amount=167;}
 if(key==='negative_cash'){raw.ec_amt='-50';raw.tx='250';raw.dl_tx='249';t.net_amount=50;t.tax=250;cash=-50;}
 if(key==='combined'){raw.ec_amt='193';raw.arrs_fee='4';t.net_amount=193;t.tax=3;cash=193;}
 if(key==='bad_sum'){raw.ec_amt='196';verified=false;}
 if(key==='bad_raw'){raw.arrs_fee='bad';verified=false;}
 if(key==='missing_field'){delete raw.ec_amt;verified=false;}
 if(key==='manual'){t.source='manual';verified=false;}
 if(key==='bad_quantity'){t.quantity=2;verified=false;}
 if(key==='negative_fee'){t.fee=-1;verified=false;}
 if(key==='foreign'){t.currency='USD';verified=false;}
 if(key==='future'){t.effective_at='2027-01-01T00:00:00Z';}
 if(key==='buy'){t.type='buy';raw.ec_amt='201';raw.tx='1';raw.dl_tx='0';t.net_amount=-201;t.tax=0;cash=-201;}
 if(key==='wrong_fee'){raw.fee='2';verified=false;}
 if(key==='wrong_tax_sum'){raw.dl_tx='4';raw.ec_amt='193';t.net_amount=193;cash=193;verified=false;}
 rows.push(t);expected.push({id:key,cash,verified,present:key!=='future'});
}
const j=x=>"'"+JSON.stringify(x).replaceAll("'","''")+"'::jsonb";
const prefix=`with account as(select 1 id),bounds as(select '2026-10-05T12:00:00Z'::timestamptz cutoff),keys as(select x id,x asset_key from unnest(array[${cases.map(x=>"'"+x+"'").join(',')}]) x),verified_domestic_cash as(select null::text id where false),dated_transactions as(select * from jsonb_to_recordset(${j(rows)}) t(id text,security_id text,account_id int,type text,currency text,source text,quantity numeric,price numeric,net_amount numeric,fee numeric,tax numeric,provider_payload jsonb,effective_at timestamptz,trade_at timestamptz,recovered_date date,group_date_recovered boolean)),`;
console.log(prefix+core.replaceAll('p_period',"'6M'")+`,expected as(select * from jsonb_to_recordset(${j(expected)}) e(id text,cash numeric,verified boolean,present boolean)) select count(*) cases,count(*) filter(where (l.security_id is not null)<>e.present or e.present and (l.cash is distinct from e.cash or l.cash_verified is distinct from e.verified)) failures from expected e left join ledger l on l.security_id=e.id;`);

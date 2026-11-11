import fs from 'node:fs';
import {batchOpeningCandidate} from './batch-opening-candidate273.mjs';
import {batchCycleCandidate} from './batch-cycle-candidate273.mjs';
import {batchReportCandidate} from './batch-report-candidate273.mjs';
import {batchReconciliationCandidate} from './batch-reconciliation-candidate273.mjs';
import {batchResolutionGate} from './batch-resolution-gate273.mjs';
const read=p=>fs.readFileSync(p,'utf8');
const extract=(s,n)=>{const start=s.indexOf('create or replace function public.'+n);if(start<0)throw Error('missing '+n);return s.slice(start,s.indexOf('end $function$;',start)+16);};
export function responseMigration(){
 const cases=batchResolutionGate(batchReconciliationCandidate(read('supabase/reconciliation_build44.sql')));
 const report=read('supabase/reconciliation_build44_event_types.sql');
 const readerSignatures=['get_live_period_stock_pnl(text)','get_live_realized_cycle_review(text)','get_live_reconciliation_report()','get_live_settlement_bridge(date)','get_reconciliation_case_timeline(uuid)'];
 return ['-- Build275: explicit source rows only; absence is unknown. No historical backfill.',
 'begin;\nset local lock_timeout=\'5s\';\nset local statement_timeout=\'60s\';',
 read('experiments/position_response_schema273.sql'),read('experiments/batch-reconciliation273.sql'),read('experiments/batch-effective273.sql'),
 read('experiments/batch_settlement_bridge_273.sql').replaceAll('get_batch_settlement_bridge_273','get_live_settlement_bridge'),
 batchOpeningCandidate(read('supabase/build260_closed_opening_quantity.sql')),
 batchCycleCandidate(read('supabase/build54e_lifecycle_review.sql')),
 batchReportCandidate(report.slice(report.indexOf('create or replace function public.get_live_reconciliation_report()'))),
 extract(cases,'get_reconciliation_case_timeline'),extract(cases,'refresh_reconciliation_cases_for_service'),
 read('experiments/batch-settlement-view273.sql'),
 // Historical source files predate security hardening. Never restore SECURITY DEFINER readers.
 ...readerSignatures.map(s=>`alter function public.${s} security invoker;\nrevoke all on function public.${s} from public,anon;\ngrant execute on function public.${s} to authenticated,service_role;`),
 'revoke all on function public.refresh_reconciliation_cases_for_service(uuid) from public,anon,authenticated;\ngrant execute on function public.refresh_reconciliation_cases_for_service(uuid) to service_role;',
 'grant execute on function public.read_batch_at_273(text,timestamptz) to service_role;',
 'commit;'].join('\n\n');
}
if(process.argv[1]?.endsWith('assemble-response-migration273.mjs'))fs.writeFileSync('experiments/response-migration273.sql',responseMigration());

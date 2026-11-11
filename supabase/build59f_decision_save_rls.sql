-- The owner-scoped ten-argument RPC checks the selected holding, linked AI
-- analysis, approved breakout rule, and current comparison before inserting.
-- Its final snapshot UPDATE affected zero rows because decisions intentionally
-- have no UPDATE RLS policy. Run this vetted RPC as its database owner so only
-- that UPDATE can finalize the newly inserted decision; do not grant client
-- UPDATE access or relax the decisions' append-only RLS rules.
alter function public.save_investment_decision(
  uuid,text,text,text,uuid,uuid,numeric,numeric,numeric,timestamptz)
  security definer;

-- The older six-argument RPC skips comparison validation. It remains callable
-- from the owner-scoped ten-argument function but not from a client directly.
revoke execute on function public.save_investment_decision(
  uuid,text,text,text,uuid,uuid) from public,anon,authenticated;
grant execute on function public.save_investment_decision(
  uuid,text,text,text,uuid,uuid,numeric,numeric,numeric,timestamptz) to authenticated;

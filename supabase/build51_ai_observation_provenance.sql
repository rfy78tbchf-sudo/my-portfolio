-- Historical answers retain the exact account-total observation used at analysis time.
alter table public.ai_analysis_history
  add column if not exists isa_observation_id uuid references public.account_total_observations(id),
  add column if not exists isa_capture_at timestamptz,
  add column if not exists account_scope_state text;
comment on column public.ai_analysis_history.isa_capture_at is
  'Screenshot capture time, not proven effective time of ISA account valuation';

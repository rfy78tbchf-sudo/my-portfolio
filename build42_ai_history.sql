create table if not exists public.ai_analysis_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  question text not null check(length(question) between 1 and 800),
  symbol text,
  answer text not null,
  confidence text not null check(confidence in ('confirmed','estimated','unresolved')),
  context_sources jsonb not null default '[]'::jsonb,
  model text not null,
  created_at timestamptz not null default now()
);
create index if not exists ai_analysis_history_user_recent on public.ai_analysis_history(user_id,created_at desc);
alter table public.ai_analysis_history enable row level security;
revoke all on public.ai_analysis_history from public,anon;
grant select,insert on public.ai_analysis_history to authenticated;
create policy ai_history_owner_select on public.ai_analysis_history for select to authenticated
  using(user_id=(select auth.uid()));
create policy ai_history_owner_insert on public.ai_analysis_history for insert to authenticated
  with check(user_id=(select auth.uid()));

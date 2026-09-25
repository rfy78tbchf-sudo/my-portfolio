-- A historical alias must never silently inherit the current ticker's bars.
-- Price mapping only becomes usable after the successor/delisting has evidence.
create table if not exists public.security_symbol_resolutions (
  account_id uuid not null references public.accounts(id),
  original_security_id uuid not null references public.securities(id),
  successor_security_id uuid references public.securities(id),
  state text not null default 'review_required'
    check(state in ('review_required','confirmed_successor','confirmed_delisted')),
  reason text not null,
  proof_reference text,
  checked_at timestamptz not null default now(),
  primary key(account_id,original_security_id),
  check(state<>'confirmed_successor' or
    (successor_security_id is not null and length(coalesce(proof_reference,''))>3)),
  check(state<>'confirmed_delisted' or length(coalesce(proof_reference,''))>3)
);
alter table public.security_symbol_resolutions enable row level security;
create policy "Owner reads symbol resolution evidence" on public.security_symbol_resolutions
  for select to authenticated using(exists(select 1 from public.accounts a
    where a.id=account_id and a.user_id=(select auth.uid())));
revoke all on public.security_symbol_resolutions from public,anon,authenticated;
grant select on public.security_symbol_resolutions to authenticated;
grant all on public.security_symbol_resolutions to service_role;

insert into public.security_symbol_resolutions(account_id,original_security_id,reason)
select distinct t.account_id,t.security_id,
  case when s.symbol like 'OLD%' then 'legacy_alias_mapping_requires_primary_evidence'
       when s.symbol ~ '^US[0-9A-Z]{10}$' then 'isin_identifier_not_verified_as_chart_ticker'
       when s.symbol='VLDR' then 'historical_listing_or_successor_needs_confirmation'
       else 'instrument_historical_price_source_missing' end
from public.transactions t join public.accounts a on a.id=t.account_id
join public.securities s on s.id=t.security_id
where a.mode='live' and a.is_active and t.type in ('buy','sell')
  and not exists(select 1 from public.daily_security_prices p
     where p.security_id=t.security_id)
on conflict(account_id,original_security_id) do nothing;

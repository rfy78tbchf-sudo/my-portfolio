create table if not exists public.corporate_unadjusted_prices (
 symbol text not null check(symbol in ('MSTY','SOXS')),
 price_date date not null,
 close numeric not null check(close>0),
 currency text not null check(currency='USD'),
 source text not null check(source='kb_gsc10060_unadjusted'),
 observed_at timestamptz not null default now(),
 primary key(symbol,price_date)
);
alter table public.corporate_unadjusted_prices enable row level security;
revoke all on public.corporate_unadjusted_prices from public,anon,authenticated;
grant select on public.corporate_unadjusted_prices to authenticated;
grant all on public.corporate_unadjusted_prices to service_role;
create policy corporate_unadjusted_prices_read on public.corporate_unadjusted_prices for select to authenticated using(true);

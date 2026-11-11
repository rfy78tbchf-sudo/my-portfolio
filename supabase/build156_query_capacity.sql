-- Applied after exact JSON equality validation under the account owner's authenticated role.
create index if not exists transactions_account_security_effective_day_idx
on public.transactions(account_id,security_id,((coalesce(order_at,trade_at) at time zone 'Asia/Seoul')::date));
create index if not exists transactions_settlement_match_idx
on public.transactions(account_id,(trim(provider_payload->>'stnd_is_cd')),((trade_at at time zone 'Asia/Seoul')::date),quantity,price)
where type='sell';
alter function public.get_live_realized_sales(text,uuid) set jit='off';
-- Bound only these two expensive user-requested reports. Other API timeouts remain 8s.
alter function public.get_live_period_stock_pnl(text) set statement_timeout='20s';
alter function public.get_live_realized_sales(text,uuid) set statement_timeout='20s';

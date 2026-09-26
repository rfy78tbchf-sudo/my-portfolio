-- Sandisk's unchanged ISIN was left as a chart ticker. The issuer identifies
-- SNDK as the NASDAQ ticker and the SEC filing identifies the same ISIN.
-- Preserve the security id, trades and broker payloads. The chart endpoint
-- must still supply its own dated USD bars before any historical valuation.
alter table public.security_symbol_resolutions
  drop constraint security_symbol_resolutions_state_check;
alter table public.security_symbol_resolutions
  add constraint security_symbol_resolutions_state_check
    check (state in ('review_required','confirmed_successor','confirmed_delisted','confirmed_canonical'));
alter table public.security_symbol_resolutions
  add constraint security_symbol_resolutions_canonical_proof_check
    check (state<>'confirmed_canonical' or length(coalesce(proof_reference,''))>3);

update public.securities s set symbol='SNDK',market='NAS'
where s.isin='US80004C2008' and s.symbol='US80004C2008'
  and s.market='UNKNOWN' and s.currency='USD'
  and not exists (select 1 from public.securities other
    where other.id<>s.id and other.symbol='SNDK' and other.currency='USD');

update public.security_symbol_resolutions r
set state='confirmed_canonical',reason='same_ISIN_verified_current_NASDAQ_ticker',
  proof_reference='https://www.sec.gov/Archives/edgar/data/1131042/000089418925015850/0000894189-25-015850.txt',
  checked_at=now()
from public.securities s
where r.original_security_id=s.id and s.isin='US80004C2008'
  and s.symbol='SNDK' and s.market='NAS' and r.state='review_required';

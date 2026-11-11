-- KB's interest-tax cash conversion contains the word 매도 but has no shares.
-- Correct its type using the original provider description, never a synthetic
-- balancing trade. Preserve original amount, ID, payload and source.
update public.transactions t set type='fx',updated_at=now()
where t.source='api' and t.type='sell' and t.security_id is null
  and t.quantity is null and t.price is null
  and t.provider_payload->>'smry_nm'='예탁금세액충당매도';

-- Classify source-backed rights and stock dividend legs without adding synthetic fills.
create or replace function public.audit_kb_transaction_type() returns trigger
language plpgsql set search_path='' as $function$
declare v_summary text;v_date text;
begin
  if new.source<>'api' then return new; end if;
  v_summary:=coalesce(new.provider_payload->>'smry_nm','');
  new.raw_type:=coalesce(nullif(new.raw_type,''),v_summary);
  new.normalized_type:=case
    when new.type='transfer_in' and v_summary~'타사|타계좌' then 'BROKER_TRANSFER_IN'
    when new.type='transfer_out' and v_summary~'타사|타계좌' then 'BROKER_TRANSFER_OUT'
    when new.type in ('transfer_in','transfer_out') and v_summary~'대체|계좌' then 'ACCOUNT_TRANSFER'
    when new.type='transfer_in' then 'TRANSFER_IN'
    when new.type='transfer_out' then 'TRANSFER_OUT'
    when new.type in ('split_in','split_out') and v_summary~'병합' then 'REVERSE_SPLIT'
    when new.type in ('split_in','split_out') then 'STOCK_SPLIT'
    when new.type in ('corporate_in','corporate_out') and v_summary~'종목변경' then 'SYMBOL_CHANGE'
    when new.type in ('corporate_in','corporate_out') and v_summary~'스핀오프' then 'SPINOFF'
    when new.type in ('corporate_in','corporate_out') and v_summary~'합병' then 'MERGER'
    when new.type in ('corporate_in','corporate_out') and v_summary~'주식배당|무상증자' then 'STOCK_DIVIDEND'
    when new.type in ('corporate_in','corporate_out') and v_summary~'권리|유상증자' then 'RIGHTS_EVENT'
    else upper(new.type) end;
  new.fetched_at:=now();
  v_date:=coalesce(new.provider_payload->>'ordr_dt','');
  if v_date ~ '^\d{8}$' then new.order_at:=to_date(v_date,'YYYYMMDD')::timestamp at time zone 'Asia/Seoul'; end if;
  v_date:=coalesce(new.provider_payload->>'stmt_dt','');
  if v_date ~ '^\d{8}$' then new.settlement_at:=to_date(v_date,'YYYYMMDD')::timestamp at time zone 'Asia/Seoul'; end if;
  return new;
end $function$;
drop trigger if exists audit_kb_transaction_type on public.transactions;
create trigger audit_kb_transaction_type before insert or update on public.transactions
  for each row execute function public.audit_kb_transaction_type();


update public.transactions set normalized_type=normalized_type
where source='api' and type in ('transfer_in','transfer_out','split_in','split_out','corporate_in','corporate_out');

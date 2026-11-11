-- Build275 response schema, deployed together with its bound readers and writer.
-- No backfill: old normalized evidence never acquires alleged completeness.
create table public.kb_position_response_batches (
 source_observation_id uuid primary key references public.account_observations(id),
 account_id uuid not null references public.accounts(id),
 observed_at timestamptz not null, complete boolean not null,
 rows jsonb not null check(jsonb_typeof(rows)='array'),
 validation jsonb not null check(jsonb_typeof(validation)='object'),
 unique(account_id,observed_at)
);
alter table public.kb_position_response_batches enable row level security;
revoke all on public.kb_position_response_batches from public,anon,authenticated,service_role;
grant select on public.kb_position_response_batches to authenticated;
create policy own_position_response on public.kb_position_response_batches for select to authenticated
 using(exists(select 1 from public.accounts a where a.id=account_id and a.user_id=(select auth.uid())));
create function public.save_kb_position_batch_for_response_for_service(p_user_id uuid,p_source_requested_at timestamptz,p_complete boolean,p_rows jsonb,p_validation jsonb)
returns void language plpgsql security definer set search_path='' as $$
declare ids uuid[];a uuid;t timestamptz;r jsonb;k text;
begin
 if p_user_id is null or p_source_requested_at is null or p_complete is null
 or jsonb_typeof(p_rows) is distinct from 'array' or jsonb_typeof(p_validation) is distinct from 'object'
 then raise exception 'INVALID_BATCH';end if;
 if jsonb_array_length(p_rows)>1000 or p_validation->>'version' is distinct from 'response-adapter-273'
 or p_validation->>'source' is distinct from 'SSQM2952'
 or p_validation->'complete' is distinct from to_jsonb(p_complete)
 or jsonb_typeof(p_validation->'reasons') is distinct from 'array'
 then raise exception 'BATCH_VALIDATION_INVALID';end if;
 if p_complete and jsonb_array_length(p_validation->'reasons')<>0 then raise exception 'BATCH_VALIDATION_INVALID';end if;
 if (select count(*)<>count(distinct (value->>'symbol',value->>'currency')) from jsonb_array_elements(p_rows)) then raise exception 'DUPLICATE_IDENTITY';end if;
 for r in select value from jsonb_array_elements(p_rows) loop
  if coalesce(r->>'symbol','') !~ '^[A-Z0-9.]{1,12}$' or coalesce(r->>'currency','') !~ '^[A-Z]{3}$' or r->>'source' is distinct from 'SSQM2952' then raise exception 'INVALID_IDENTITY';end if;
  foreach k in array array['effective_quantity','settled_quantity','pending_buy_quantity','pending_sell_quantity'] loop
   if r ? k and jsonb_typeof(r->k) not in ('number','null') then raise exception 'INVALID_QUANTITY';end if;
   if (r->>k)::numeric<0 or (p_complete and r->>k is null) then raise exception 'INVALID_QUANTITY';end if;
  end loop;
  if p_complete and (r->>'effective_quantity')::numeric is distinct from (r->>'settled_quantity')::numeric+(r->>'pending_buy_quantity')::numeric-(r->>'pending_sell_quantity')::numeric then raise exception 'INCONSISTENT_QUANTITY';end if;
 end loop;
 select array_agg(distinct o.id) into ids from public.account_observations o
 join public.accounts a on a.id=o.account_id join public.sync_logs l on l.account_id=a.id and l.started_at=o.fetched_at
 where a.user_id=p_user_id and a.mode='live' and a.provider='kb_securities'
 and l.scope='kb_current_snapshot' and l.status='success'
 and (l.detail->>'source_requested_at')::timestamptz=p_source_requested_at;
 if coalesce(cardinality(ids),0)<>1 then raise exception 'SOURCE_BINDING_UNAVAILABLE';end if;
 select account_id,fetched_at into a,t from public.account_observations where id=ids[1];
 insert into public.kb_position_response_batches values(ids[1],a,t,p_complete,p_rows,p_validation) on conflict(source_observation_id) do nothing;
 if not exists(select 1 from public.kb_position_response_batches b where b.source_observation_id=ids[1] and b.account_id=a and b.observed_at=t and b.complete=p_complete and b.rows=p_rows and b.validation=p_validation) then raise exception 'CONFLICTING_RETRY';end if;
end $$;
revoke all on function public.save_kb_position_batch_for_response_for_service(uuid,timestamptz,boolean,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.save_kb_position_batch_for_response_for_service(uuid,timestamptz,boolean,jsonb,jsonb) to service_role;
-- Transitional name keeps the tested consumers on the same read contract.
create function public.read_batch_at_273(a text,t timestamptz) returns jsonb
language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('response_id',source_observation_id,'observed_at',observed_at,'complete',complete,'rows',rows,'coverage_policy','EXPLICIT_ROWS_ONLY')
 from public.kb_position_response_batches where account_id=a::uuid and observed_at<=t order by observed_at desc limit 1
$$;
revoke all on function public.read_batch_at_273(text,timestamptz) from public,anon;
grant execute on function public.read_batch_at_273(text,timestamptz) to authenticated;

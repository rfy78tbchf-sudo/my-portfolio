-- Local integration candidate only. Existing accounts, account_observations,
-- sync_logs and auth.uid are supplied by the test fixture. NOT deployable alone.
create schema batch_273_private;
revoke all on schema batch_273_private from public;
grant usage on schema batch_273_private to service_role;
alter table public.evidence_batch_273 enable row level security;
revoke all on public.evidence_batch_273 from public,anon,authenticated,service_role;
grant select on public.evidence_batch_273 to authenticated;
create policy owner_read_273 on public.evidence_batch_273 for select to authenticated
 using(exists(select 1 from public.accounts a where a.id::text=account and a.user_id=(select auth.uid())));
revoke all on function public.save_batch_273(text,text,timestamptz,boolean,jsonb) from public,anon,authenticated,service_role;
revoke all on function public.read_batch_273(text) from public,anon;
grant execute on function public.read_batch_273(text) to authenticated;
create function batch_273_private.save_owned_response(p_user uuid,p_requested_at timestamptz,p_complete boolean,p_rows jsonb)
returns void language plpgsql security definer set search_path='' as $$
declare ids uuid[];v_account uuid;v_at timestamptz;
begin
 select array_agg(distinct o.id) into ids
 from public.account_observations o join public.accounts a on a.id=o.account_id
 join public.sync_logs l on l.account_id=a.id and l.started_at=o.fetched_at
 where a.user_id=p_user and a.mode='live' and a.provider='kb_securities'
 and l.scope='kb_current_snapshot' and l.status='success'
 and (l.detail->>'source_requested_at')::timestamptz=p_requested_at;
 if coalesce(cardinality(ids),0)<>1 then raise exception 'SOURCE_BINDING_UNAVAILABLE';end if;
 select account_id,fetched_at into v_account,v_at from public.account_observations where id=ids[1];
 perform public.save_batch_273(v_account::text,ids[1]::text,v_at,p_complete,p_rows);
end $$;
revoke all on function batch_273_private.save_owned_response(uuid,timestamptz,boolean,jsonb) from public,anon,authenticated;
grant execute on function batch_273_private.save_owned_response(uuid,timestamptz,boolean,jsonb) to service_role;
create function public.read_batch_at_273(a text,t timestamptz) returns jsonb
language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('response_id',response_id,'observed_at',observed_at,'complete',complete,'rows',rows)
 from public.evidence_batch_273 where account=a and observed_at<=t order by observed_at desc limit 1
$$;
revoke all on function public.read_batch_at_273(text,timestamptz) from public,anon;
grant execute on function public.read_batch_at_273(text,timestamptz) to authenticated;

-- Local-only candidate. Not a production migration or an authorized ingestion API.
-- Completeness is supplied only by the synthetic source adapter in this experiment.
create table evidence_batch_273 (
 account text not null, response_id text not null, observed_at timestamptz not null,
 complete boolean not null, rows jsonb not null check(jsonb_typeof(rows)='array'),
 primary key(account,response_id), unique(account,observed_at)
);
create function save_batch_273(a text,r text,t timestamptz,c boolean,j jsonb)
returns void language plpgsql as $$
begin
 if a is null or r is null or t is null or c is null or jsonb_typeof(j) is distinct from 'array' then raise exception 'INVALID_BATCH';end if;
 if exists(select 1 from jsonb_array_elements(j) e where nullif(e->>'symbol','') is null or nullif(e->>'currency','') is null) then raise exception 'IDENTITY_MISSING';end if;
 if (select count(*)<>count(distinct (e->>'symbol',e->>'currency')) from jsonb_array_elements(j) e) then raise exception 'DUPLICATE_IDENTITY';end if;
 insert into evidence_batch_273 values(a,r,t,c,j) on conflict(account,response_id) do nothing;
 if not exists(select 1 from evidence_batch_273 b where b.account=a and b.response_id=r and b.observed_at=t and b.complete=c and b.rows=j) then raise exception 'CONFLICTING_RETRY';end if;
end $$;
-- Select the response before expanding rows. An empty/partial response must not
-- silently select older per-symbol evidence. This function does not produce P&L.
create function read_batch_273(a text) returns jsonb language sql as $$
 select jsonb_build_object('response_id',response_id,'observed_at',observed_at,
 'complete',complete,'rows',rows) from evidence_batch_273 where account=a
 order by observed_at desc limit 1
$$;

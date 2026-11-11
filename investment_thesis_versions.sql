create table if not exists public.investment_theses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  security_id uuid not null references public.securities(id),
  version integer not null default 1 check (version>0),
  rationale text not null default '',
  catalysts text not null default '',
  risks text not null default '',
  add_condition text not null default '',
  trim_condition text not null default '',
  exit_condition text not null default '',
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id,security_id)
);
create table if not exists public.investment_thesis_versions (
  id uuid primary key default gen_random_uuid(),
  thesis_id uuid not null references public.investment_theses(id) on delete cascade,
  version integer not null check (version>0),
  fields jsonb not null,
  created_at timestamptz not null default now(),
  unique(thesis_id,version)
);
create index if not exists thesis_versions_recent_idx
  on public.investment_thesis_versions(thesis_id,version desc);
alter table public.investment_theses enable row level security;
alter table public.investment_thesis_versions enable row level security;
revoke all on public.investment_theses,public.investment_thesis_versions from public,anon;
grant select,insert,update on public.investment_theses to authenticated;
grant select on public.investment_thesis_versions to authenticated;

create policy theses_owner_select on public.investment_theses
  for select to authenticated using (user_id=(select auth.uid()));
create policy theses_owner_insert on public.investment_theses
  for insert to authenticated with check (user_id=(select auth.uid()));
create policy theses_owner_update on public.investment_theses
  for update to authenticated using (user_id=(select auth.uid()))
    with check (user_id=(select auth.uid()));
create policy thesis_versions_owner_read on public.investment_thesis_versions
  for select to authenticated using (
    exists (select 1 from public.investment_theses t
      where t.id=thesis_id and t.user_id=(select auth.uid()))
  );

create or replace function private.version_investment_thesis()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op='UPDATE' then
    if new.user_id is distinct from old.user_id
       or new.security_id is distinct from old.security_id then
      raise exception 'The thesis owner and security cannot change';
    end if;
    if row(new.rationale,new.catalysts,new.risks,new.add_condition,
        new.trim_condition,new.exit_condition,new.notes)
       is not distinct from
       row(old.rationale,old.catalysts,old.risks,old.add_condition,
         old.trim_condition,old.exit_condition,old.notes) then
      new.version:=old.version;
      new.updated_at:=old.updated_at;
      return new;
    end if;
    new.version:=old.version+1;
    new.updated_at:=now();
  else
    new.version:=1;
  end if;
  return new;
end $$;
revoke all on function private.version_investment_thesis() from public,anon,authenticated;
create trigger thesis_before_version before insert or update on public.investment_theses
for each row execute function private.version_investment_thesis();

create or replace function private.record_investment_thesis_version()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_write boolean:=false;
begin
  if tg_op='INSERT' then v_write:=true;
  else v_write:=new.version<>old.version; end if;
  if v_write then
    insert into public.investment_thesis_versions(thesis_id,version,fields)
    values(new.id,new.version,jsonb_build_object(
      'rationale',new.rationale,'catalysts',new.catalysts,'risks',new.risks,
      'add_condition',new.add_condition,'trim_condition',new.trim_condition,
      'exit_condition',new.exit_condition,'notes',new.notes));
  end if;
  return null;
end $$;
revoke all on function private.record_investment_thesis_version() from public,anon,authenticated;
create trigger thesis_after_version after insert or update on public.investment_theses
for each row execute function private.record_investment_thesis_version();

create or replace function public.save_investment_thesis(p_security_id uuid,p_fields jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare v_user uuid:=(select auth.uid());
declare v_row public.investment_theses%rowtype;
begin
  if v_user is null then raise exception 'authentication required'; end if;
  if p_fields is null or jsonb_typeof(p_fields)<>'object' then
    raise exception 'invalid thesis fields';
  end if;
  if not exists(select 1 from public.securities s where s.id=p_security_id) then
    raise exception 'security not found';
  end if;
  if exists(select 1 from jsonb_each_text(p_fields) e where length(e.value)>4000)
     or length(p_fields::text)>18000 then
    raise exception 'thesis text is too long';
  end if;
  insert into public.investment_theses(user_id,security_id,rationale,catalysts,risks,
    add_condition,trim_condition,exit_condition,notes)
  values(v_user,p_security_id,coalesce(p_fields->>'rationale',''),
    coalesce(p_fields->>'catalysts',''),coalesce(p_fields->>'risks',''),
    coalesce(p_fields->>'add_condition',''),coalesce(p_fields->>'trim_condition',''),
    coalesce(p_fields->>'exit_condition',''),coalesce(p_fields->>'notes',''))
  on conflict(user_id,security_id) do update set
    rationale=excluded.rationale,catalysts=excluded.catalysts,risks=excluded.risks,
    add_condition=excluded.add_condition,trim_condition=excluded.trim_condition,
    exit_condition=excluded.exit_condition,notes=excluded.notes
  where row(public.investment_theses.rationale,public.investment_theses.catalysts,
      public.investment_theses.risks,public.investment_theses.add_condition,
      public.investment_theses.trim_condition,public.investment_theses.exit_condition,
      public.investment_theses.notes)
    is distinct from row(excluded.rationale,excluded.catalysts,excluded.risks,
      excluded.add_condition,excluded.trim_condition,excluded.exit_condition,excluded.notes);
  select * into v_row from public.investment_theses
    where user_id=v_user and security_id=p_security_id;
  return jsonb_build_object('ok',true,'id',v_row.id,'version',v_row.version,
    'updated_at',v_row.updated_at);
end $$;
revoke all on function public.save_investment_thesis(uuid,jsonb) from public,anon;
grant execute on function public.save_investment_thesis(uuid,jsonb) to authenticated;

create or replace function public.get_investment_thesis(p_security_id uuid)
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
declare v_user uuid:=(select auth.uid());
declare v_thesis public.investment_theses%rowtype;
declare v_history jsonb;
begin
  if v_user is null then raise exception 'authentication required'; end if;
  select * into v_thesis from public.investment_theses
    where user_id=v_user and security_id=p_security_id;
  if not found then
    return jsonb_build_object('ok',true,'thesis',null,'versions','[]'::jsonb);
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('version',v.version,
    'created_at',v.created_at,'fields',v.fields) order by v.version desc),'[]'::jsonb)
  into v_history from public.investment_thesis_versions v
  where v.thesis_id=v_thesis.id;
  return jsonb_build_object('ok',true,'thesis',to_jsonb(v_thesis),
    'versions',v_history);
end $$;
revoke all on function public.get_investment_thesis(uuid) from public,anon;
grant execute on function public.get_investment_thesis(uuid) to authenticated;

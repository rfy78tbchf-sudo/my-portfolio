-- Per-account AI key: only the server-side service principal can read it.
-- Vault encrypts the credential; the frontend receives only connection status.
create table if not exists public.ai_api_key_refs (
  user_id uuid primary key references auth.users(id) on delete cascade,
  secret_id uuid not null unique,
  updated_at timestamptz not null default now()
);
alter table public.ai_api_key_refs enable row level security;
revoke all on public.ai_api_key_refs from public,anon,authenticated;

create or replace function public.set_ai_api_key_for_service(p_user_id uuid,p_api_key text)
returns boolean language plpgsql security definer set search_path='' as $$
declare v_id uuid;
begin
 if (select auth.role())<>'service_role' or p_user_id is null or
    p_api_key !~ '^sk-[A-Za-z0-9_-]{30,200}$' then
   raise exception 'invalid AI credential request';
 end if;
 select r.secret_id into v_id from public.ai_api_key_refs r where r.user_id=p_user_id for update;
 if v_id is null then
   v_id:=vault.create_secret(p_api_key,'investment_ai_'||p_user_id::text,
     'Personal investment assistant credential');
   insert into public.ai_api_key_refs(user_id,secret_id) values(p_user_id,v_id);
 else
   perform vault.update_secret(v_id,new_secret:=p_api_key);
   update public.ai_api_key_refs set updated_at=now() where user_id=p_user_id;
 end if;
 return true;
end $$;
revoke all on function public.set_ai_api_key_for_service(uuid,text) from public,anon,authenticated;
grant execute on function public.set_ai_api_key_for_service(uuid,text) to service_role;

create or replace function public.get_ai_api_key_for_service(p_user_id uuid)
returns text language plpgsql security definer set search_path='' as $$
declare v_key text;
begin
 if (select auth.role())<>'service_role' then raise exception 'service role only'; end if;
 select s.decrypted_secret into v_key
 from public.ai_api_key_refs r join vault.decrypted_secrets s on s.id=r.secret_id
 where r.user_id=p_user_id;
 return v_key;
end $$;
revoke all on function public.get_ai_api_key_for_service(uuid) from public,anon,authenticated;
grant execute on function public.get_ai_api_key_for_service(uuid) to service_role;

-- Local integration bridge; uses prototype ownership binding. Production UUID/FK schema pending.
create function public.save_kb_position_batch_for_response_for_service(p_user_id uuid,p_source_requested_at timestamptz,p_complete boolean,p_rows jsonb,p_validation jsonb)
returns void language plpgsql security definer set search_path='' as $$
begin
 if p_validation->>'version' is distinct from 'response-adapter-273'
 or p_validation->>'source' is distinct from 'SSQM2952'
 or p_validation->'complete' is distinct from to_jsonb(p_complete)
 or jsonb_typeof(p_validation->'reasons') is distinct from 'array'
 or (p_complete and jsonb_array_length(p_validation->'reasons')<>0)
 then raise exception 'BATCH_VALIDATION_INVALID';end if;
 perform batch_273_private.save_owned_response(p_user_id,p_source_requested_at,p_complete,p_rows);
end $$;
revoke all on function public.save_kb_position_batch_for_response_for_service(uuid,timestamptz,boolean,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.save_kb_position_batch_for_response_for_service(uuid,timestamptz,boolean,jsonb,jsonb) to service_role;

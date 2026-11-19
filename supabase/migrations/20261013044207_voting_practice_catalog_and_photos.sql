-- Catálogo de simulacro reutilizable y almacenamiento de fotos.
alter table public.voting_candidates alter column election_id drop not null;
alter table public.voting_candidates add column if not exists reference_year integer;
alter table public.voting_candidates drop constraint if exists voting_candidates_practice_scope_check;
alter table public.voting_candidates add constraint voting_candidates_practice_scope_check check (
  (is_practice_reference and election_id is null and reference_year is not null)
  or (not is_practice_reference and election_id is not null and reference_year is null)
);
create unique index if not exists voting_practice_candidate_name_year
  on public.voting_candidates(reference_year,full_name) where is_practice_reference;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('voting-photos','voting-photos',true,5242880,array['image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=excluded.public,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists voting_admin_insert_photos on storage.objects;
create policy voting_admin_insert_photos on storage.objects for insert to authenticated
with check(bucket_id='voting-photos' and bethel_security.caller_is_admin());
drop policy if exists voting_admin_update_photos on storage.objects;
create policy voting_admin_update_photos on storage.objects for update to authenticated
using(bucket_id='voting-photos' and bethel_security.caller_is_admin())
with check(bucket_id='voting-photos' and bethel_security.caller_is_admin());
drop policy if exists voting_admin_delete_photos on storage.objects;
create policy voting_admin_delete_photos on storage.objects for delete to authenticated
using(bucket_id='voting-photos' and bethel_security.caller_is_admin());

create or replace function public.voting_admin_save_candidate(
  p_id uuid,p_election_id uuid,p_full_name text,p_gender text,p_photo_url text,p_practice boolean,p_active boolean)
returns uuid language plpgsql security definer set search_path = '' as $$
declare cid uuid; target_election uuid; target_reference integer;
begin
  if not voting_private.is_admin() then raise exception 'Solo Administración' using errcode='42501'; end if;
  target_election:=case when p_practice then null else p_election_id end;
  target_reference:=case when p_practice then 2026 else null end;
  if not p_practice and p_election_id is null then raise exception 'El candidato oficial requiere elección'; end if;
  if p_id is null then
    insert into public.voting_candidates(election_id,reference_year,full_name,gender,photo_url,is_practice_reference,active,created_by)
      values(target_election,target_reference,trim(p_full_name),p_gender,p_photo_url,p_practice,p_active,auth.uid()) returning id into cid;
  else
    update public.voting_candidates set election_id=target_election,reference_year=target_reference,full_name=trim(p_full_name),
      gender=p_gender,photo_url=p_photo_url,is_practice_reference=p_practice,active=p_active where id=p_id returning id into cid;
  end if;
  if cid is null then raise exception 'Candidato no encontrado'; end if;
  insert into voting_private.audit_log(actor_id,action,entity_type,entity_id) values(auth.uid(),'save','candidate',cid::text);
  return cid;
end;
$$;
revoke all on function public.voting_admin_save_candidate(uuid,uuid,text,text,text,boolean,boolean) from public;
grant execute on function public.voting_admin_save_candidate(uuid,uuid,text,text,text,boolean,boolean) to authenticated;

create or replace function public.voting_admin_save_round(
  p_id uuid,p_election_id uuid,p_kind text,p_number integer,p_attendance_policy text,
  p_male_slots integer,p_female_slots integer,p_candidate_ids uuid[])
returns uuid language plpgsql security definer set search_path = '' as $$
declare rid uuid; expected int; actual int;
begin
  if not voting_private.is_admin() then raise exception 'Solo Administración' using errcode='42501'; end if;
  if p_kind='tie' then raise exception 'Use la función de desempate'; end if;
  select count(*) into expected from unnest(coalesce(p_candidate_ids,'{}'::uuid[])) x;
  select count(*) into actual from unnest(coalesce(p_candidate_ids,'{}'::uuid[])) x
    join public.voting_candidates c on c.id=x and c.active
    where (p_kind='practice' and c.is_practice_reference)
       or (p_kind='official' and not c.is_practice_reference and c.election_id=p_election_id);
  if expected=0 or actual<>expected then raise exception 'Lista de candidatos inválida'; end if;
  if p_id is null then
    insert into public.voting_rounds(election_id,round_kind,round_number,attendance_policy,male_slots,female_slots,created_by)
      values(p_election_id,p_kind,p_number,p_attendance_policy,p_male_slots,p_female_slots,auth.uid()) returning id into rid;
  else
    update public.voting_rounds set round_kind=p_kind,round_number=p_number,attendance_policy=p_attendance_policy,
      male_slots=p_male_slots,female_slots=p_female_slots where id=p_id and election_id=p_election_id and status='draft' returning id into rid;
  end if;
  if rid is null then raise exception 'Ronda no editable'; end if;
  insert into public.voting_round_candidates(round_id,candidate_id) select rid,x from unnest(p_candidate_ids) x on conflict do nothing;
  insert into voting_private.audit_log(actor_id,action,entity_type,entity_id) values(auth.uid(),'save','round',rid::text);
  return rid;
end;
$$;
revoke all on function public.voting_admin_save_round(uuid,uuid,text,integer,text,integer,integer,uuid[]) from public;
grant execute on function public.voting_admin_save_round(uuid,uuid,text,integer,text,integer,integer,uuid[]) to authenticated;

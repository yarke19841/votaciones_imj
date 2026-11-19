-- Keep used practice versions immutable; later rounds select the current version.
alter table public.voting_candidates add column catalog_current boolean not null default true;
alter table public.voting_candidates add column previous_candidate_id uuid references public.voting_candidates(id) on delete restrict;
drop index public.voting_practice_candidate_name_year;
create unique index voting_practice_candidate_name_year on public.voting_candidates(reference_year,full_name)
 where is_practice_reference and catalog_current;

create or replace function public.voting_admin_save_candidate(
 p_id uuid,p_election_id uuid,p_full_name text,p_gender text,p_photo_url text,p_practice boolean,p_active boolean)
returns uuid language plpgsql security definer set search_path = '' as $$
declare cid uuid; prior public.voting_candidates%rowtype; used boolean;
begin
 if not voting_private.is_admin() then raise exception 'Solo Administración' using errcode='42501'; end if;
 if not p_practice and p_election_id is null then raise exception 'El candidato oficial requiere elección'; end if;
 if trim(coalesce(p_full_name,''))='' then raise exception 'Nombre obligatorio'; end if;
 if p_id is not null then
  select * into prior from public.voting_candidates where id=p_id for update;
  if prior.id is null then raise exception 'Candidato no encontrado'; end if;
  if not prior.catalog_current then raise exception 'Versión anterior; actualiza el catálogo antes de editar'; end if;
  if prior.is_practice_reference is distinct from p_practice or (not p_practice and prior.election_id is distinct from p_election_id) then
   raise exception 'No se cambia el conjunto ni el año de un candidato existente';
  end if;
  -- Opening a round locks the same row; an edit cannot race its transition.
  perform r.id from public.voting_rounds r join public.voting_round_candidates rc on rc.round_id=r.id
   where rc.candidate_id=p_id order by r.id for update of r;
  select exists(select 1 from public.voting_round_candidates rc join public.voting_rounds r on r.id=rc.round_id
   where rc.candidate_id=p_id and r.status<>'draft') into used;
  if used and not p_practice then raise exception 'Candidato utilizado por una ronda iniciada; historial protegido'; end if;
  if used then update public.voting_candidates set catalog_current=false where id=p_id; end if;
 end if;
 if p_id is null or used then
  insert into public.voting_candidates(election_id,reference_year,full_name,gender,photo_url,is_practice_reference,active,created_by,previous_candidate_id)
   values(case when p_practice then null else p_election_id end,case when p_practice then 2026 else null end,
    trim(p_full_name),p_gender,p_photo_url,p_practice,p_active,auth.uid(),case when used then p_id else null end) returning id into cid;
  if used then
   update public.voting_round_candidates rc set candidate_id=cid from public.voting_rounds r
    where rc.round_id=r.id and r.status='draft' and rc.candidate_id=p_id;
  end if;
 else
  update public.voting_candidates set full_name=trim(p_full_name),gender=p_gender,photo_url=p_photo_url,active=p_active
   where id=p_id returning id into cid;
 end if;
 insert into voting_private.audit_log(actor_id,action,entity_type,entity_id,detail)
  values(auth.uid(),case when used then 'version_candidate' else 'save' end,'candidate',cid::text,
   case when used then jsonb_build_object('previous_candidate_id',p_id) else '{}'::jsonb end);
 return cid;
end;
$$;

-- All membership=true records participate in coverage. Missing documents remain
-- explicitly unresolved rather than being counted as separate people or enabled voters.
create or replace function public.voting_admin_member_coverage()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare result jsonb;
begin
 if not voting_private.is_admin() then raise exception 'Solo Administración' using errcode='42501'; end if;
 with members as (select distinct m.person_id from public.memberships m join public.people p on p.id=m.person_id where m.is_member is true),
 covered as (select m.person_id,ip.identity_id from members m left join voting_private.identity_people ip on ip.person_id=m.person_id),
 counts as (select count(*) records,count(distinct identity_id) known,count(*) filter(where identity_id is null) missing from covered)
 select jsonb_build_object('member_records',records,'identified_members',known,'unidentified_records',missing,
  'total_members',case when missing=0 then known else null end,'complete',missing=0) into result from counts;
 return result;
end;
$$;
revoke all on function public.voting_admin_member_coverage() from public,anon,authenticated;
grant execute on function public.voting_admin_member_coverage() to authenticated;

-- Used image bytes must remain available for history. New uploads use new paths.
create or replace function public.voting_storage_photo_mutable(p_name text)
returns boolean language sql stable security definer set search_path = '' as $$
 select voting_private.is_admin() and not exists(
  select 1 from public.voting_candidates c join public.voting_round_candidates rc on rc.candidate_id=c.id
  join public.voting_rounds r on r.id=rc.round_id where c.photo_url=p_name and r.status<>'draft');
$$;
revoke all on function public.voting_storage_photo_mutable(text) from public,anon,authenticated;
grant execute on function public.voting_storage_photo_mutable(text) to authenticated;
drop policy voting_admin_update_photos on storage.objects;
create policy voting_admin_update_photos on storage.objects for update to authenticated
 using(bucket_id='voting-photos' and public.voting_storage_photo_mutable(name))
 with check(bucket_id='voting-photos' and public.voting_storage_photo_mutable(name));
drop policy voting_admin_delete_photos on storage.objects;
create policy voting_admin_delete_photos on storage.objects for delete to authenticated
 using(bucket_id='voting-photos' and public.voting_storage_photo_mutable(name));

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
    join public.voting_candidates c on c.id=x and c.active and c.catalog_current
    where (p_kind='practice' and c.is_practice_reference)
       or (p_kind='official' and not c.is_practice_reference and c.election_id=p_election_id);
  if expected=0 or actual<>expected then raise exception 'Lista de candidatos inválida'; end if;
  if cardinality(p_candidate_ids)<>(select count(distinct x) from unnest(p_candidate_ids) x) then raise exception 'Candidatos duplicados'; end if;
  if p_male_slots+p_female_slots=0 or p_male_slots>(select count(*) from public.voting_candidates where id=any(p_candidate_ids) and gender='M') or p_female_slots>(select count(*) from public.voting_candidates where id=any(p_candidate_ids) and gender='F') then raise exception 'Cupos incompatibles con candidatos'; end if;
  if p_attendance_policy<>'new' then raise exception 'La política de origen solo corresponde a desempates'; end if;
  if p_id is null then
    insert into public.voting_rounds(election_id,round_kind,round_number,attendance_policy,male_slots,female_slots,created_by)
      values(p_election_id,p_kind,p_number,p_attendance_policy,p_male_slots,p_female_slots,auth.uid()) returning id into rid;
  else
    update public.voting_rounds set round_kind=p_kind,round_number=p_number,attendance_policy=p_attendance_policy,
      male_slots=p_male_slots,female_slots=p_female_slots where id=p_id and election_id=p_election_id and status='draft' returning id into rid;
  end if;
  if rid is null then raise exception 'Ronda no editable'; end if;
  delete from public.voting_round_candidates where round_id=rid;
  insert into public.voting_round_candidates(round_id,candidate_id) select rid,x from unnest(p_candidate_ids) x on conflict do nothing;
  insert into voting_private.audit_log(actor_id,action,entity_type,entity_id) values(auth.uid(),'save','round',rid::text);
  return rid;
end;
$$;


create or replace function public.voting_admin_snapshot()
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if not voting_private.is_admin() then raise exception 'Solo Administración' using errcode='42501'; end if;
  return jsonb_build_object(
    'elections',(select coalesce(jsonb_agg(to_jsonb(e) order by e.election_year desc),'[]'::jsonb) from public.voting_elections e),
    'member_coverage',public.voting_admin_member_coverage(),
    'candidates',(select coalesce(jsonb_agg(to_jsonb(c) order by c.full_name),'[]'::jsonb) from public.voting_candidates c where c.catalog_current),
    'rounds',(select coalesce(jsonb_agg(to_jsonb(r) || jsonb_build_object(
      'candidate_ids',(select coalesce(jsonb_agg(rc.candidate_id),'[]'::jsonb) from public.voting_round_candidates rc where rc.round_id=r.id),
      'attendance_count',(select count(*) from voting_private.attendance a where a.round_id=r.id),
      'member_attendance_count',(select count(*) from voting_private.attendance a where a.round_id=r.id and exists(select 1 from voting_private.identity_people ip join public.memberships m on m.person_id=ip.person_id and m.is_member is true where ip.identity_id=a.identity_id)),
      'voter_count',(select count(*) from voting_private.participation p where p.round_id=r.id)
    ) order by r.created_at desc),'[]'::jsonb) from public.voting_rounds r)
  );
end;
$$;



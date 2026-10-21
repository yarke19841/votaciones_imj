-- Corrective migration, additive to the two installed QA migrations.
-- No elections/data seeded, no production operation and no Bethel records altered.
create table if not exists voting_private.identity_people (
 person_id bigint primary key references public.people(id) on delete restrict,
 identity_id uuid not null references voting_private.identities(id) on delete restrict
);
insert into voting_private.identity_people(person_id,identity_id)
select person_id,id from voting_private.identities on conflict do nothing;
revoke all on voting_private.identity_people from public,anon,authenticated;
alter table voting_private.identity_people enable row level security;
alter table voting_private.sessions add column if not exists round_id uuid references public.voting_rounds(id) on delete restrict;
alter table voting_private.attendance alter column latitude drop not null;
alter table voting_private.attendance alter column longitude drop not null;
create or replace function voting_private.cedula_hash(raw text)
returns text language sql immutable set search_path = '' as $$
  select encode(extensions.digest(upper(regexp_replace(coalesce(raw,''),'[^0-9A-Za-z]','','g')),'sha256'),'hex');
$$;

create or replace function voting_private.identity_in_actor_scope(target_person_id bigint)
returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and coalesce((
    select case p.role
      when 'admin' then p.is_active
      when 'leader' then p.is_active and exists (
        select 1 from public.memberships m join public.groups g on g.id=m.group_id
        where m.person_id=target_person_id and m.is_member is true
          and g.leader_user_id=p.user_id and g.active is true
      )
      when 'pastor' then p.is_active and exists (
        select 1 from public.memberships m
        join public.groups g on g.id=m.group_id and g.active is true
        join public.pastor_territories pt on pt.territory_id=g.territory_id
        join public.territories t on t.id=pt.territory_id and t.is_active
        where m.person_id=target_person_id and m.is_member is true
          and pt.pastor_user_id=p.user_id
      )
      else false end
    from public.profiles p where p.user_id=auth.uid()
  ), false);
$$;

create or replace function voting_private.access_state(target_identity uuid, target_round uuid)
returns text language plpgsql stable security definer set search_path = '' as $$
declare r public.voting_rounds%rowtype;
begin
  select * into r from public.voting_rounds where id=target_round;
  if r.id is null then return 'waiting'; end if;
  if r.round_kind<>'tie' and not exists(select 1 from voting_private.eligibility e where e.identity_id=target_identity and e.election_id=r.election_id and e.enabled) then return 'not_enabled'; end if;
  if r.round_kind='tie' and not exists(select 1 from voting_private.participation p where p.identity_id=target_identity and p.round_id=r.origin_round_id) then return 'not_in_tie_electorate'; end if;
  if not (case r.attendance_policy
    when 'origin' then exists(select 1 from voting_private.attendance a where a.identity_id=target_identity and a.round_id=r.origin_round_id)
    when 'either' then exists(select 1 from voting_private.attendance a where a.identity_id=target_identity and a.round_id in(r.id,r.origin_round_id))
    else exists(select 1 from voting_private.attendance a where a.identity_id=target_identity and a.round_id=r.id) end) then return 'attendance_required'; end if;
  return null;
end;
$$;

-- An exception permits location access; it never attests a physical arrival.
-- Prefer GPS when a valid fix is inside, even if an exception also exists.
create or replace function voting_private.location_allowed(target_identity uuid, target_round uuid, lat double precision, lon double precision)
returns text language plpgsql stable security definer set search_path = '' as $$
declare e public.voting_elections%rowtype;
begin
  select ve.* into e from public.voting_rounds r join public.voting_elections ve on ve.id=r.election_id where r.id=target_round;
  if e.id is null then return null; end if;
  if e.church_latitude is not null and e.church_longitude is not null and e.radius_meters is not null
    and lat between -90 and 90 and lon between -180 and 180
    and voting_private.distance_m(e.church_latitude,e.church_longitude,lat,lon) <= e.radius_meters then return 'gps'; end if;
  if exists(select 1 from voting_private.location_exceptions x where x.identity_id=target_identity and x.round_id=target_round
    and x.revoked_at is null and now() between x.valid_from and x.valid_until) then return 'exception'; end if;
  return null;
end;
$$;

create or replace function public.voting_enter(p_cedula text, p_latitude double precision, p_longitude double precision)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare ident voting_private.identities%rowtype; rnd public.voting_rounds%rowtype; elect public.voting_elections%rowtype;
  tok uuid; loc text; already boolean; allowed_attendance boolean;
begin
  if length(regexp_replace(coalesce(p_cedula,''),'[^0-9A-Za-z]','','g')) < 5 then
    return jsonb_build_object('state','not_found');
  end if;
  select * into ident from voting_private.identities where cedula_hash=voting_private.cedula_hash(p_cedula);
  if ident.id is null then return jsonb_build_object('state','not_found'); end if;
  select * into rnd from public.voting_rounds where status in ('open','checkin') order by (status='open') desc limit 1;
  if rnd.id is null then return jsonb_build_object('state','waiting','reason','no_active_round','attended',false,'enabled',false); end if;
  select * into elect from public.voting_elections where id=rnd.election_id;
  loc := voting_private.location_allowed(ident.id,rnd.id,p_latitude,p_longitude);
  if loc is null then return jsonb_build_object('state','location_denied'); end if;
  if loc='gps' then
    insert into voting_private.attendance(round_id,identity_id,latitude,longitude,source)
      values(rnd.id,ident.id,p_latitude,p_longitude,loc) on conflict do nothing;
  end if;
  -- Arrival is independent of eligibility; registering it never enables a voter.
  loc := voting_private.access_state(ident.id,rnd.id);

  tok := gen_random_uuid();
  insert into voting_private.sessions(token_hash,identity_id,election_id,round_id,expires_at)
    values(voting_private.cedula_hash(tok::text),ident.id,elect.id,rnd.id,now()+interval '4 hours');
  if loc is not null then return jsonb_build_object('state','waiting','reason',loc,'attended',exists(select 1 from voting_private.attendance a where a.identity_id=ident.id and a.round_id=rnd.id),'enabled',loc not in ('not_enabled','not_in_tie_electorate'),'attendance_registered',exists(select 1 from voting_private.attendance a where a.identity_id=ident.id and a.round_id=rnd.id),'token',tok,'round_id',rnd.id,'round_kind',rnd.round_kind,'year',elect.election_year,'title',elect.title); end if;
  if rnd.status='checkin' then
    return jsonb_build_object('state','waiting','attended',true,'enabled',true,'attendance_registered',true,'token',tok,'round_id',rnd.id,'round_kind',rnd.round_kind,
      'year',elect.election_year,'title',elect.title);
  end if;
  select exists(select 1 from voting_private.participation p where p.round_id=rnd.id and p.identity_id=ident.id) into already;
  return jsonb_build_object('state',case when already then 'already_voted' else 'ready' end,'token',tok,
    'attended',true,'enabled',true,'round_id',rnd.id,'round_kind',rnd.round_kind,'year',elect.election_year,'title',elect.title);
end;
$$;

create or replace function public.voting_ballot(p_token uuid, p_latitude double precision, p_longitude double precision)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare ses voting_private.sessions%rowtype; rnd public.voting_rounds%rowtype; loc text;
begin
  select * into ses from voting_private.sessions where token_hash=voting_private.cedula_hash(p_token::text) and expires_at>now();
  if ses.token_hash is null then return jsonb_build_object('state','session_expired'); end if;
  select * into rnd from public.voting_rounds where election_id=ses.election_id and id=ses.round_id and status='open' limit 1;
  if rnd.id is null then return jsonb_build_object('state',case when exists(select 1 from public.voting_rounds where id=ses.round_id and status='closed') then 'closed' else 'waiting' end); end if;
  if exists(select 1 from voting_private.participation p where p.round_id=rnd.id and p.identity_id=ses.identity_id) then
    return jsonb_build_object('state','already_voted'); end if;
  loc := voting_private.access_state(ses.identity_id,rnd.id);
  if loc is not null then return jsonb_build_object('state',loc); end if;
  loc := voting_private.location_allowed(ses.identity_id,rnd.id,p_latitude,p_longitude);
  if loc is null then return jsonb_build_object('state','location_denied'); end if;
  update voting_private.sessions set last_seen_at=now() where token_hash=ses.token_hash;
  return jsonb_build_object('state','ready','round_id',rnd.id,'round_kind',rnd.round_kind,'year',(select election_year from public.voting_elections where id=rnd.election_id),'attended',true,'enabled',true,'male_slots',rnd.male_slots,'female_slots',rnd.female_slots,
    'candidates',(select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'name',c.full_name,'gender',c.gender,'photo_url',c.photo_url) order by c.full_name),'[]'::jsonb)
      from public.voting_round_candidates rc join public.voting_candidates c on c.id=rc.candidate_id and c.active where rc.round_id=rnd.id));
end;
$$;

create or replace function public.voting_submit(p_token uuid, p_candidate_ids uuid[], p_latitude double precision, p_longitude double precision)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare ses voting_private.sessions%rowtype; rnd public.voting_rounds%rowtype; loc text; m int; f int; total int; distinct_total int;
begin
  select * into ses from voting_private.sessions where token_hash=voting_private.cedula_hash(p_token::text) and expires_at>now() for update;
  if ses.token_hash is null then return jsonb_build_object('state','session_expired'); end if;
  select * into rnd from public.voting_rounds where election_id=ses.election_id and id=ses.round_id and status='open' limit 1 for update;
  if rnd.id is null then return jsonb_build_object('state',case when exists(select 1 from public.voting_rounds where id=ses.round_id and status='closed') then 'closed' else 'waiting' end); end if;
  loc := voting_private.access_state(ses.identity_id,rnd.id);
  if loc is not null then return jsonb_build_object('state',loc); end if;
  loc := voting_private.location_allowed(ses.identity_id,rnd.id,p_latitude,p_longitude);
  if loc is null then return jsonb_build_object('state','location_denied'); end if;
  if exists(select 1 from voting_private.participation p where p.round_id=rnd.id and p.identity_id=ses.identity_id) then
    return jsonb_build_object('state','already_voted'); end if;
  select count(*),count(distinct x) into total,distinct_total from unnest(coalesce(p_candidate_ids,'{}'::uuid[])) x;
  if total<>distinct_total or total<>rnd.male_slots+rnd.female_slots then return jsonb_build_object('state','invalid_quota'); end if;
  select count(*) filter(where c.gender='M'),count(*) filter(where c.gender='F') into m,f
    from unnest(p_candidate_ids) x join public.voting_round_candidates rc on rc.round_id=rnd.id and rc.candidate_id=x
    join public.voting_candidates c on c.id=x and c.active;
  if m<>rnd.male_slots or f<>rnd.female_slots then return jsonb_build_object('state','invalid_quota'); end if;
  insert into voting_private.participation(round_id,identity_id) values(rnd.id,ses.identity_id);
  insert into public.voting_tallies(round_id,candidate_id,vote_count)
    select rnd.id,x,1 from unnest(p_candidate_ids) x
    on conflict(round_id,candidate_id) do update set vote_count=public.voting_tallies.vote_count+1;
  delete from voting_private.sessions where token_hash=ses.token_hash;
  return jsonb_build_object('state','accepted');
end;
$$;

create or replace function public.voting_enable_person(p_election_id uuid, p_person_id bigint, p_cedula text, p_enabled boolean default true)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare ident uuid; linked uuid; normalized text;
begin
  if not voting_private.identity_in_actor_scope(p_person_id) then raise exception 'Fuera de alcance' using errcode='42501'; end if;
  if not exists(select 1 from public.people where id=p_person_id) then raise exception 'Persona no existe'; end if;
  normalized:=upper(regexp_replace(coalesce(p_cedula,''),'[^0-9A-Za-z]','','g'));
  if length(normalized)<5 then raise exception 'Cédula inválida'; end if;
  -- Serialize this normalized document so separate territorial records cannot race.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(normalized,0));
  select id into ident from voting_private.identities where cedula_hash=voting_private.cedula_hash(normalized);
  select identity_id into linked from voting_private.identity_people where person_id=p_person_id;
  if linked is not null and (ident is null or linked<>ident) then raise exception 'La cédula ya vinculada requiere revisión administrativa; no se reasigna historial'; end if;
  if ident is null then
    insert into voting_private.identities(person_id,cedula_hash,cedula_last4,created_by)
      values(p_person_id,voting_private.cedula_hash(normalized),right(normalized,4),auth.uid()) returning id into ident;
  end if;
  insert into voting_private.identity_people(person_id,identity_id) values(p_person_id,ident) on conflict do nothing;
  insert into voting_private.eligibility(election_id,identity_id,enabled,enabled_by)
    values(p_election_id,ident,p_enabled,auth.uid()) on conflict(election_id,identity_id)
    do update set enabled=excluded.enabled,enabled_at=now(),enabled_by=auth.uid();
  insert into voting_private.audit_log(actor_id,action,entity_type,entity_id,detail)
    values(auth.uid(),case when p_enabled then 'enable' else 'disable' end,'person',p_person_id::text,jsonb_build_object('election_id',p_election_id));
  return jsonb_build_object('ok',true);
end;
$$;

create or replace function public.voting_admin_save_candidate(
  p_id uuid,p_election_id uuid,p_full_name text,p_gender text,p_photo_url text,p_practice boolean,p_active boolean)
returns uuid language plpgsql security definer set search_path = '' as $$
declare cid uuid; target_election uuid; target_reference integer;
begin
  if not voting_private.is_admin() then raise exception 'Solo Administración' using errcode='42501'; end if;
  target_election:=case when p_practice then null else p_election_id end;
  target_reference:=case when p_practice then 2026 else null end;
  if not p_practice and p_election_id is null then raise exception 'El candidato oficial requiere elección'; end if;
  if p_id is not null and exists(select 1 from public.voting_round_candidates rc join public.voting_rounds r on r.id=rc.round_id where rc.candidate_id=p_id and r.status<>'draft') then raise exception 'Candidato utilizado por una ronda iniciada; historial protegido'; end if;
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

create or replace function public.voting_admin_open_round(p_round_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if not voting_private.is_admin() then raise exception 'Solo Administración' using errcode='42501'; end if;
  if exists(select 1 from public.voting_rounds where status='open' and id<>p_round_id) then raise exception 'Ya hay una votación abierta'; end if;
  if not exists(select 1 from public.voting_round_candidates where round_id=p_round_id) then raise exception 'Ronda sin candidatos'; end if;
  if not exists(select 1 from public.voting_rounds r join public.voting_elections e on e.id=r.election_id where r.id=p_round_id and e.church_latitude is not null and e.church_longitude is not null and e.radius_meters is not null) then raise exception 'Pendiente de configuración: ubicación y radio'; end if;
  if exists(select 1 from public.voting_rounds r where r.id=p_round_id and (
    r.male_slots+r.female_slots=0 or
    r.male_slots>(select count(*) from public.voting_round_candidates rc join public.voting_candidates c on c.id=rc.candidate_id where rc.round_id=r.id and c.active and c.gender='M') or
    r.female_slots>(select count(*) from public.voting_round_candidates rc join public.voting_candidates c on c.id=rc.candidate_id where rc.round_id=r.id and c.active and c.gender='F'))) then raise exception 'Cupos incompatibles con candidatos activos'; end if;
  update public.voting_rounds set status='open',opened_at=now(),closed_at=null where id=p_round_id and status in ('draft','checkin');
  if not found then raise exception 'Ronda no disponible'; end if;
  insert into voting_private.audit_log(actor_id,action,entity_type,entity_id) values(auth.uid(),'open','round',p_round_id::text);
  return jsonb_build_object('ok',true);
end;
$$;

create or replace function public.voting_admin_results(p_round_id uuid)
returns table(candidate_id uuid,full_name text,gender text,vote_count integer) language plpgsql security definer set search_path = '' as $$
begin
  if not voting_private.is_admin() then raise exception 'Solo Administración' using errcode='42501'; end if;
  if not exists(select 1 from public.voting_rounds where id=p_round_id and status='closed') then raise exception 'Resultados disponibles al cerrar la ronda'; end if;
  return query select c.id,c.full_name,c.gender,coalesce(t.vote_count,0)
    from public.voting_round_candidates rc join public.voting_candidates c on c.id=rc.candidate_id
    left join public.voting_tallies t on t.round_id=rc.round_id and t.candidate_id=rc.candidate_id
    where rc.round_id=p_round_id order by c.gender,coalesce(t.vote_count,0) desc,c.full_name;
end;
$$;

create or replace function public.voting_admin_set_exception(p_round_id uuid,p_person_id bigint,p_valid_from timestamptz,p_valid_until timestamptz,p_reason text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare ident uuid; xid uuid;
begin
  if not voting_private.is_admin() then raise exception 'Solo Administración' using errcode='42501'; end if;
  select identity_id into ident from voting_private.identity_people where person_id=p_person_id;
  if ident is null then raise exception 'Persona sin identidad electoral'; end if;
  update voting_private.location_exceptions set revoked_at=now() where identity_id=ident and round_id=p_round_id and revoked_at is null;
  insert into voting_private.location_exceptions(identity_id,round_id,valid_from,valid_until,reason,created_by)
    values(ident,p_round_id,p_valid_from,p_valid_until,p_reason,auth.uid()) returning id into xid;
  insert into voting_private.audit_log(actor_id,action,entity_type,entity_id,detail)
    values(auth.uid(),'location_exception','exception',xid::text,jsonb_build_object('person_id',p_person_id,'round_id',p_round_id));
  return jsonb_build_object('ok',true,'exception_id',xid);
end;
$$;

create or replace function public.voting_staff_pending(p_round_id uuid)
returns table(person_id bigint,full_name text,cedula_last4 text,attended boolean,voted boolean) language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Autenticación requerida' using errcode='42501'; end if;
  return query select scoped.person_id,p.full_name,i.cedula_last4,
    (case r.attendance_policy
      when 'origin' then exists(select 1 from voting_private.attendance a where a.round_id=r.origin_round_id and a.identity_id=i.id)
      when 'either' then exists(select 1 from voting_private.attendance a where a.round_id in(r.id,r.origin_round_id) and a.identity_id=i.id)
      else exists(select 1 from voting_private.attendance a where a.round_id=r.id and a.identity_id=i.id) end),
    false
    from voting_private.eligibility e join voting_private.identities i on i.id=e.identity_id
    join public.voting_rounds r on r.election_id=e.election_id and r.id=p_round_id
    join lateral (select min(ip.person_id) person_id from voting_private.identity_people ip
      where ip.identity_id=i.id and voting_private.identity_in_actor_scope(ip.person_id)) scoped on scoped.person_id is not null
    join public.people p on p.id=scoped.person_id
    where (e.enabled or r.round_kind='tie')
      and not exists(select 1 from voting_private.participation v where v.round_id=r.id and v.identity_id=i.id)
      and (r.round_kind<>'tie' or exists(select 1 from voting_private.participation v where v.round_id=r.origin_round_id and v.identity_id=i.id))
    order by p.full_name;
end;
$$;

create or replace function voting_private.group_in_actor_scope(target_group_id bigint)
returns boolean language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.groups g join public.profiles p on p.user_id=auth.uid() and p.is_active
 where g.id=target_group_id and g.active is true and (
 p.role='admin' or (p.role='leader' and g.leader_user_id=p.user_id) or
 (p.role='pastor' and exists(select 1 from public.pastor_territories pt join public.territories t on t.id=pt.territory_id and t.is_active
 where pt.pastor_user_id=p.user_id and pt.territory_id=g.territory_id))));
$$;
revoke all on function voting_private.group_in_actor_scope(bigint) from public,anon,authenticated;

create or replace function public.voting_staff_people(p_election_id uuid)
returns table(person_id bigint,full_name text,group_name text,cedula_last4 text,enabled boolean) language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Autenticación requerida' using errcode='42501'; end if;
  return query select p.id,p.full_name,min(g.name),max(i.cedula_last4),coalesce(bool_or(e.enabled),false)
    from public.people p join public.memberships m on m.person_id=p.id and m.is_member is true
    join public.groups g on g.id=m.group_id and g.active is true
    left join voting_private.identity_people ip on ip.person_id=p.id
    left join voting_private.identities i on i.id=ip.identity_id
    left join voting_private.eligibility e on e.identity_id=i.id and e.election_id=p_election_id
    where voting_private.identity_in_actor_scope(p.id) and voting_private.group_in_actor_scope(g.id)
    group by p.id,p.full_name order by p.full_name;
end;
$$;

create or replace function public.voting_staff_snapshot()
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
 if auth.uid() is null or not exists(select 1 from public.profiles p where p.user_id=auth.uid() and p.is_active and p.role in('admin','leader','pastor')) then raise exception 'Personal autorizado requerido' using errcode='42501'; end if;
 return jsonb_build_object(
 'elections',(select coalesce(jsonb_agg(to_jsonb(e) order by e.election_year desc),'[]'::jsonb) from public.voting_elections e),
 'rounds',(select coalesce(jsonb_agg(to_jsonb(r) order by r.created_at desc),'[]'::jsonb) from public.voting_rounds r));
end;
$$;

create or replace function public.voting_admin_exceptions(p_round_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
 if not voting_private.is_admin() then raise exception 'Solo Administración' using errcode='42501'; end if;
 return (select coalesce(jsonb_agg(to_jsonb(x) || jsonb_build_object('person_id',i.person_id,'full_name',p.full_name) order by x.created_at desc),'[]'::jsonb)
 from voting_private.location_exceptions x join voting_private.identities i on i.id=x.identity_id join public.people p on p.id=i.person_id where x.round_id=p_round_id);
end;
$$;

create or replace function public.voting_admin_revoke_exception(p_exception_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
 if not voting_private.is_admin() then raise exception 'Solo Administración' using errcode='42501'; end if;
 update voting_private.location_exceptions set revoked_at=now() where id=p_exception_id and revoked_at is null;
 if not found then raise exception 'Excepción no vigente'; end if;
 insert into voting_private.audit_log(actor_id,action,entity_type,entity_id) values(auth.uid(),'revoke_location_exception','exception',p_exception_id::text);
 return jsonb_build_object('ok',true);
end;
$$;

-- No snapshots of ongoing aggregate tallies: final results become visible only after close.
-- Private photographs can be downloaded with the anon key only after their round opens.
update storage.buckets set public=false where id='voting-photos';
create or replace function public.voting_storage_admin()
returns boolean language sql stable security definer set search_path = '' as $$ select voting_private.is_admin(); $$;
create or replace function public.voting_photo_visible(p_name text)
returns boolean language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.voting_candidates c join public.voting_round_candidates rc on rc.candidate_id=c.id
 join public.voting_rounds r on r.id=rc.round_id where c.photo_url=p_name and r.status='open' and c.active);
$$;
drop policy if exists voting_admin_select_photos on storage.objects;
create policy voting_admin_select_photos on storage.objects for select to authenticated using(bucket_id='voting-photos' and public.voting_storage_admin());
drop policy if exists voting_open_round_select_photos on storage.objects;
create policy voting_open_round_select_photos on storage.objects for select to anon,authenticated using(bucket_id='voting-photos' and public.voting_photo_visible(name));
drop policy if exists voting_admin_insert_photos on storage.objects;
create policy voting_admin_insert_photos on storage.objects for insert to authenticated with check(bucket_id='voting-photos' and public.voting_storage_admin());
drop policy if exists voting_admin_update_photos on storage.objects;
create policy voting_admin_update_photos on storage.objects for update to authenticated using(bucket_id='voting-photos' and public.voting_storage_admin()) with check(bucket_id='voting-photos' and public.voting_storage_admin());
drop policy if exists voting_admin_delete_photos on storage.objects;
create policy voting_admin_delete_photos on storage.objects for delete to authenticated using(bucket_id='voting-photos' and public.voting_storage_admin());
revoke all on function voting_private.access_state(uuid,uuid) from public,anon,authenticated;
revoke all on function public.voting_staff_snapshot() from public;
revoke all on function public.voting_admin_exceptions(uuid) from public;
revoke all on function public.voting_admin_revoke_exception(uuid) from public;
revoke all on function public.voting_storage_admin() from public;
revoke all on function public.voting_photo_visible(text) from public;
grant execute on function public.voting_staff_snapshot(),public.voting_admin_exceptions(uuid),public.voting_admin_revoke_exception(uuid),public.voting_storage_admin() to authenticated;
grant execute on function public.voting_photo_visible(text) to anon,authenticated;

create or replace function public.voting_admin_save_election(
  p_id uuid, p_year integer, p_title text, p_male_slots integer, p_female_slots integer,
  p_latitude double precision, p_longitude double precision, p_radius_meters integer)
returns uuid language plpgsql security definer set search_path = '' as $$
declare eid uuid;
begin
  if not voting_private.is_admin() then raise exception 'Solo Administración' using errcode='42501'; end if;
  if p_id is not null and exists(select 1 from public.voting_rounds where election_id=p_id and status<>'draft') and exists(select 1 from public.voting_elections e where e.id=p_id and (e.election_year is distinct from p_year or e.title is distinct from trim(p_title) or e.male_slots is distinct from p_male_slots or e.female_slots is distinct from p_female_slots)) then raise exception 'Historial protegido: año, título y cupos de una elección iniciada'; end if;
  if p_id is null then
    insert into public.voting_elections(election_year,title,male_slots,female_slots,church_latitude,church_longitude,radius_meters,created_by)
      values(p_year,trim(p_title),p_male_slots,p_female_slots,p_latitude,p_longitude,p_radius_meters,auth.uid()) returning id into eid;
  else
    update public.voting_elections set election_year=p_year,title=trim(p_title),male_slots=p_male_slots,female_slots=p_female_slots,
      church_latitude=p_latitude,church_longitude=p_longitude,radius_meters=p_radius_meters where id=p_id returning id into eid;
  end if;
  if eid is null then raise exception 'Elección no encontrada'; end if;
  insert into voting_private.audit_log(actor_id,action,entity_type,entity_id) values(auth.uid(),'save','election',eid::text);
  return eid;
end;
$$;

-- Defense in depth: private tables remain unreachable even if privileges drift.
alter table voting_private.identities enable row level security;
alter table voting_private.eligibility enable row level security;
alter table voting_private.attendance enable row level security;
alter table voting_private.location_exceptions enable row level security;
alter table voting_private.sessions enable row level security;
alter table voting_private.participation enable row level security;
alter table voting_private.audit_log enable row level security;

-- Preserve all permitted leader lists; one membership row is never substituted for another.
create or replace function public.voting_staff_roster(p_election_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
 if auth.uid() is null or not exists(select 1 from public.profiles p where p.user_id=auth.uid() and p.is_active and p.role in('admin','leader','pastor')) then raise exception 'Personal autorizado requerido' using errcode='42501'; end if;
 return (select coalesce(jsonb_agg(to_jsonb(x) order by x.full_name),'[]'::jsonb) from (
  select p.id person_id,p.full_name,i.cedula_last4,coalesce(e.enabled,false) enabled,
  (select coalesce(jsonb_agg(jsonb_build_object('id',sg.id,'name',sg.name,'leader_user_id',sg.leader_user_id) order by sg.name),'[]'::jsonb)
   from public.groups sg where voting_private.group_in_actor_scope(sg.id) and exists(select 1 from public.memberships sm where sm.group_id=sg.id and sm.person_id=p.id and sm.is_member is true)) groups
  from public.people p
  left join voting_private.identity_people ip on ip.person_id=p.id
  left join voting_private.identities i on i.id=ip.identity_id
  left join voting_private.eligibility e on e.identity_id=i.id and e.election_id=p_election_id
  where voting_private.identity_in_actor_scope(p.id) and exists(select 1 from public.memberships m where m.person_id=p.id and m.is_member is true and voting_private.group_in_actor_scope(m.group_id))
 ) x);
end;
$$;
revoke all on function public.voting_staff_roster(uuid) from public;
grant execute on function public.voting_staff_roster(uuid) to authenticated;

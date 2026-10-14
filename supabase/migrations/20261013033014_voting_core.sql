-- Votaciones IMJ: núcleo aditivo, aislado de las tablas históricas inseguras.
-- No migra datos ni abre elecciones. Diseñado para Bethel_IMJ QA/producción.

create schema if not exists voting_private;
revoke all on schema voting_private from public, anon, authenticated;

create table if not exists public.voting_elections (
  id uuid primary key default gen_random_uuid(),
  election_year integer not null unique check (election_year >= 2026),
  title text not null,
  male_slots integer not null check (male_slots >= 0),
  female_slots integer not null check (female_slots >= 0),
  church_latitude double precision,
  church_longitude double precision,
  radius_meters integer check (radius_meters is null or radius_meters > 0),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  check ((church_latitude is null and church_longitude is null and radius_meters is null)
    or (church_latitude between -90 and 90 and church_longitude between -180 and 180 and radius_meters is not null))
);

create table if not exists public.voting_candidates (
  id uuid primary key default gen_random_uuid(),
  election_id uuid not null references public.voting_elections(id) on delete restrict,
  full_name text not null,
  gender text not null check (gender in ('M','F')),
  photo_url text,
  is_practice_reference boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  unique (election_id, full_name)
);

create table if not exists public.voting_rounds (
  id uuid primary key default gen_random_uuid(),
  election_id uuid not null references public.voting_elections(id) on delete restrict,
  round_kind text not null check (round_kind in ('practice','official','tie')),
  round_number integer not null default 1 check (round_number > 0),
  status text not null default 'draft' check (status in ('draft','checkin','open','closed')),
  origin_round_id uuid references public.voting_rounds(id) on delete restrict,
  attendance_policy text not null default 'new' check (attendance_policy in ('origin','new','either')),
  male_slots integer not null check (male_slots >= 0),
  female_slots integer not null check (female_slots >= 0),
  opened_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  unique (election_id, round_kind, round_number),
  check ((round_kind = 'tie' and origin_round_id is not null) or (round_kind <> 'tie' and origin_round_id is null))
);

create unique index if not exists voting_only_one_open_round
  on public.voting_rounds ((status)) where status = 'open';
create unique index if not exists voting_only_one_active_round
  on public.voting_rounds ((true)) where status in ('checkin','open');

create table if not exists public.voting_round_candidates (
  round_id uuid not null references public.voting_rounds(id) on delete restrict,
  candidate_id uuid not null references public.voting_candidates(id) on delete restrict,
  primary key (round_id, candidate_id)
);

create table if not exists public.voting_tallies (
  round_id uuid not null,
  candidate_id uuid not null,
  vote_count integer not null default 0 check (vote_count >= 0),
  primary key (round_id, candidate_id),
  foreign key (round_id, candidate_id)
    references public.voting_round_candidates(round_id, candidate_id) on delete restrict
);

create table if not exists voting_private.identities (
  id uuid primary key default gen_random_uuid(),
  person_id bigint not null unique references public.people(id) on delete restrict,
  cedula_hash text not null unique,
  cedula_last4 text not null,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

create table if not exists voting_private.eligibility (
  election_id uuid not null references public.voting_elections(id) on delete restrict,
  identity_id uuid not null references voting_private.identities(id) on delete restrict,
  enabled boolean not null default true,
  enabled_at timestamptz not null default now(),
  enabled_by uuid references auth.users(id),
  primary key (election_id, identity_id)
);

create table if not exists voting_private.attendance (
  round_id uuid not null references public.voting_rounds(id) on delete restrict,
  identity_id uuid not null references voting_private.identities(id) on delete restrict,
  checked_at timestamptz not null default now(),
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  source text not null default 'gps' check (source in ('gps','exception')),
  primary key (round_id, identity_id)
);

create table if not exists voting_private.location_exceptions (
  id uuid primary key default gen_random_uuid(),
  identity_id uuid not null references voting_private.identities(id) on delete restrict,
  round_id uuid not null references public.voting_rounds(id) on delete restrict,
  valid_from timestamptz not null,
  valid_until timestamptz not null,
  reason text not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id),
  check (valid_until > valid_from)
);

create unique index if not exists voting_one_live_exception
  on voting_private.location_exceptions(identity_id, round_id)
  where revoked_at is null;

create table if not exists voting_private.sessions (
  token_hash text primary key,
  identity_id uuid not null references voting_private.identities(id) on delete restrict,
  election_id uuid not null references public.voting_elections(id) on delete restrict,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  last_seen_at timestamptz not null default now(),
  check (expires_at > created_at)
);

create table if not exists voting_private.participation (
  round_id uuid not null references public.voting_rounds(id) on delete restrict,
  identity_id uuid not null references voting_private.identities(id) on delete restrict,
  voted_at timestamptz not null default now(),
  primary key (round_id, identity_id)
);

create table if not exists voting_private.audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users(id),
  action text not null,
  entity_type text not null,
  entity_id text not null,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.voting_elections enable row level security;
alter table public.voting_candidates enable row level security;
alter table public.voting_rounds enable row level security;
alter table public.voting_round_candidates enable row level security;
alter table public.voting_tallies enable row level security;

revoke all on public.voting_elections, public.voting_candidates, public.voting_rounds,
  public.voting_round_candidates, public.voting_tallies from anon, authenticated;
revoke all on all tables in schema voting_private from public, anon, authenticated;
revoke all on all sequences in schema voting_private from public, anon, authenticated;

create or replace function voting_private.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and exists (
    select 1 from public.profiles p
    where p.user_id = auth.uid() and p.role = 'admin' and p.is_active
  );
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

create or replace function voting_private.cedula_hash(raw text)
returns text language sql immutable set search_path = '' as $$
  select encode(extensions.digest(regexp_replace(coalesce(raw,''),'[^0-9A-Za-z]','','g'),'sha256'),'hex');
$$;

create or replace function voting_private.distance_m(lat1 double precision, lon1 double precision, lat2 double precision, lon2 double precision)
returns double precision language sql immutable set search_path = '' as $$
  select 6371000 * 2 * asin(sqrt(
    power(sin(radians(lat2-lat1)/2),2) + cos(radians(lat1))*cos(radians(lat2))*power(sin(radians(lon2-lon1)/2),2)
  ));
$$;

create or replace function voting_private.location_allowed(target_identity uuid, target_round uuid, lat double precision, lon double precision)
returns text language plpgsql stable security definer set search_path = '' as $$
declare e public.voting_elections%rowtype;
begin
  select ve.* into e from public.voting_rounds r join public.voting_elections ve on ve.id=r.election_id where r.id=target_round;
  if e.id is null then return null; end if;
  if exists (select 1 from voting_private.location_exceptions x where x.identity_id=target_identity and x.round_id=target_round
      and x.revoked_at is null and now() between x.valid_from and x.valid_until) then return 'exception'; end if;
  if e.church_latitude is null or lat is null or lon is null then return null; end if;
  if lat not between -90 and 90 or lon not between -180 and 180 then return null; end if;
  if voting_private.distance_m(e.church_latitude,e.church_longitude,lat,lon) <= e.radius_meters then return 'gps'; end if;
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
  if rnd.id is null then return jsonb_build_object('state','waiting'); end if;
  select * into elect from public.voting_elections where id=rnd.election_id;
  if not exists(select 1 from voting_private.eligibility z where z.election_id=elect.id and z.identity_id=ident.id and z.enabled) then
    return jsonb_build_object('state','not_enabled');
  end if;
  if rnd.round_kind='tie' and not exists(select 1 from voting_private.participation p where p.round_id=rnd.origin_round_id and p.identity_id=ident.id) then
    return jsonb_build_object('state','not_in_tie_electorate');
  end if;
  loc := voting_private.location_allowed(ident.id,rnd.id,p_latitude,p_longitude);
  if loc is null then return jsonb_build_object('state','location_denied'); end if;
  insert into voting_private.attendance(round_id,identity_id,latitude,longitude,source)
    values(rnd.id,ident.id,p_latitude,p_longitude,loc) on conflict do nothing;
  allowed_attendance := case rnd.attendance_policy
    when 'origin' then rnd.origin_round_id is not null and exists(select 1 from voting_private.attendance a where a.round_id=rnd.origin_round_id and a.identity_id=ident.id)
    when 'either' then exists(select 1 from voting_private.attendance a where a.identity_id=ident.id and a.round_id in (rnd.id,rnd.origin_round_id))
    else exists(select 1 from voting_private.attendance a where a.round_id=rnd.id and a.identity_id=ident.id) end;
  if not allowed_attendance then return jsonb_build_object('state','attendance_required'); end if;
  tok := gen_random_uuid();
  insert into voting_private.sessions(token_hash,identity_id,election_id,expires_at)
    values(voting_private.cedula_hash(tok::text),ident.id,elect.id,now()+interval '4 hours');
  if rnd.status='checkin' then
    return jsonb_build_object('state','waiting','token',tok,'round_id',rnd.id,'round_kind',rnd.round_kind,
      'year',elect.election_year,'title',elect.title);
  end if;
  select exists(select 1 from voting_private.participation p where p.round_id=rnd.id and p.identity_id=ident.id) into already;
  return jsonb_build_object('state',case when already then 'already_voted' else 'ready' end,'token',tok,
    'round_id',rnd.id,'round_kind',rnd.round_kind,'year',elect.election_year,'title',elect.title);
end;
$$;

create or replace function public.voting_ballot(p_token uuid, p_latitude double precision, p_longitude double precision)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare ses voting_private.sessions%rowtype; rnd public.voting_rounds%rowtype; loc text;
begin
  select * into ses from voting_private.sessions where token_hash=voting_private.cedula_hash(p_token::text) and expires_at>now();
  if ses.token_hash is null then return jsonb_build_object('state','session_expired'); end if;
  select * into rnd from public.voting_rounds where election_id=ses.election_id and status='open' limit 1;
  if rnd.id is null then return jsonb_build_object('state','waiting'); end if;
  if exists(select 1 from voting_private.participation p where p.round_id=rnd.id and p.identity_id=ses.identity_id) then
    return jsonb_build_object('state','already_voted'); end if;
  loc := voting_private.location_allowed(ses.identity_id,rnd.id,p_latitude,p_longitude);
  if loc is null then return jsonb_build_object('state','location_denied'); end if;
  update voting_private.sessions set last_seen_at=now() where token_hash=ses.token_hash;
  return jsonb_build_object('state','ready','round_id',rnd.id,'male_slots',rnd.male_slots,'female_slots',rnd.female_slots,
    'candidates',(select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'name',c.full_name,'gender',c.gender,'photo_url',c.photo_url) order by c.full_name),'[]'::jsonb)
      from public.voting_round_candidates rc join public.voting_candidates c on c.id=rc.candidate_id where rc.round_id=rnd.id));
end;
$$;

create or replace function public.voting_submit(p_token uuid, p_candidate_ids uuid[], p_latitude double precision, p_longitude double precision)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare ses voting_private.sessions%rowtype; rnd public.voting_rounds%rowtype; loc text; m int; f int; total int; distinct_total int;
begin
  select * into ses from voting_private.sessions where token_hash=voting_private.cedula_hash(p_token::text) and expires_at>now() for update;
  if ses.token_hash is null then return jsonb_build_object('state','session_expired'); end if;
  select * into rnd from public.voting_rounds where election_id=ses.election_id and status='open' limit 1 for update;
  if rnd.id is null then return jsonb_build_object('state','waiting'); end if;
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
  update voting_private.sessions set expires_at=now(),last_seen_at=now() where token_hash=ses.token_hash;
  return jsonb_build_object('state','accepted');
end;
$$;

create or replace function public.voting_enable_person(p_election_id uuid, p_person_id bigint, p_cedula text, p_enabled boolean default true)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare ident uuid; normalized text;
begin
  if not voting_private.identity_in_actor_scope(p_person_id) then raise exception 'Fuera de alcance' using errcode='42501'; end if;
  if not exists(select 1 from public.people where id=p_person_id) then raise exception 'Persona no existe'; end if;
  normalized:=regexp_replace(coalesce(p_cedula,''),'[^0-9A-Za-z]','','g');
  if length(normalized)<5 then raise exception 'Cédula inválida'; end if;
  insert into voting_private.identities(person_id,cedula_hash,cedula_last4,created_by)
    values(p_person_id,voting_private.cedula_hash(normalized),right(normalized,4),auth.uid())
    on conflict(person_id) do update set cedula_hash=excluded.cedula_hash,cedula_last4=excluded.cedula_last4
    returning id into ident;
  insert into voting_private.eligibility(election_id,identity_id,enabled,enabled_by)
    values(p_election_id,ident,p_enabled,auth.uid()) on conflict(election_id,identity_id)
    do update set enabled=excluded.enabled,enabled_at=now(),enabled_by=auth.uid();
  insert into voting_private.audit_log(actor_id,action,entity_type,entity_id,detail)
    values(auth.uid(),case when p_enabled then 'enable' else 'disable' end,'person',p_person_id::text,jsonb_build_object('election_id',p_election_id));
  return jsonb_build_object('ok',true);
end;
$$;

create or replace function public.voting_admin_save_election(
  p_id uuid, p_year integer, p_title text, p_male_slots integer, p_female_slots integer,
  p_latitude double precision, p_longitude double precision, p_radius_meters integer)
returns uuid language plpgsql security definer set search_path = '' as $$
declare eid uuid;
begin
  if not voting_private.is_admin() then raise exception 'Solo Administración' using errcode='42501'; end if;
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

create or replace function public.voting_admin_save_candidate(
  p_id uuid,p_election_id uuid,p_full_name text,p_gender text,p_photo_url text,p_practice boolean,p_active boolean)
returns uuid language plpgsql security definer set search_path = '' as $$
declare cid uuid;
begin
  if not voting_private.is_admin() then raise exception 'Solo Administración' using errcode='42501'; end if;
  if p_id is null then
    insert into public.voting_candidates(election_id,full_name,gender,photo_url,is_practice_reference,active,created_by)
      values(p_election_id,trim(p_full_name),p_gender,p_photo_url,p_practice,p_active,auth.uid()) returning id into cid;
  else
    update public.voting_candidates set full_name=trim(p_full_name),gender=p_gender,photo_url=p_photo_url,
      is_practice_reference=p_practice,active=p_active where id=p_id and election_id=p_election_id returning id into cid;
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
    join public.voting_candidates c on c.id=x and c.election_id=p_election_id and c.active;
  if expected=0 or actual<>expected then raise exception 'Lista de candidatos inválida'; end if;
  if p_id is null then
    insert into public.voting_rounds(election_id,round_kind,round_number,attendance_policy,male_slots,female_slots,created_by)
      values(p_election_id,p_kind,p_number,p_attendance_policy,p_male_slots,p_female_slots,auth.uid()) returning id into rid;
  else
    update public.voting_rounds set round_kind=p_kind,round_number=p_number,attendance_policy=p_attendance_policy,
      male_slots=p_male_slots,female_slots=p_female_slots where id=p_id and election_id=p_election_id and status='draft' returning id into rid;
  end if;
  if rid is null then raise exception 'Ronda no editable'; end if;
  insert into public.voting_round_candidates(round_id,candidate_id) select rid,x from unnest(p_candidate_ids) x
    on conflict do nothing;
  insert into voting_private.audit_log(actor_id,action,entity_type,entity_id) values(auth.uid(),'save','round',rid::text);
  return rid;
end;
$$;

create or replace function public.voting_admin_create_tie_round(p_origin_round_id uuid,p_attendance_policy text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare origin public.voting_rounds%rowtype; rid uuid; next_no int; g text; slots int; cutoff int; above_count int; tied_count int;
  male_pending int:=0; female_pending int:=0; tied_ids uuid[]:='{}'::uuid[];
begin
  if not voting_private.is_admin() then raise exception 'Solo Administración' using errcode='42501'; end if;
  select * into origin from public.voting_rounds where id=p_origin_round_id and status='closed';
  if origin.id is null then raise exception 'La ronda origen debe estar cerrada'; end if;
  foreach g in array array['M','F'] loop
    slots:=case when g='M' then origin.male_slots else origin.female_slots end;
    if slots>0 then
      select x.vote_count into cutoff from (
        select coalesce(t.vote_count,0) vote_count
        from public.voting_round_candidates rc join public.voting_candidates c on c.id=rc.candidate_id
        left join public.voting_tallies t on t.round_id=rc.round_id and t.candidate_id=rc.candidate_id
        where rc.round_id=origin.id and c.gender=g order by coalesce(t.vote_count,0) desc,c.id limit 1 offset slots-1
      ) x;
      if cutoff is not null then
        select count(*) filter(where coalesce(t.vote_count,0)>cutoff),count(*) filter(where coalesce(t.vote_count,0)=cutoff)
          into above_count,tied_count from public.voting_round_candidates rc join public.voting_candidates c on c.id=rc.candidate_id
          left join public.voting_tallies t on t.round_id=rc.round_id and t.candidate_id=rc.candidate_id
          where rc.round_id=origin.id and c.gender=g;
        if tied_count > slots-above_count then
          tied_ids:=tied_ids || array(select c.id from public.voting_round_candidates rc join public.voting_candidates c on c.id=rc.candidate_id
            left join public.voting_tallies t on t.round_id=rc.round_id and t.candidate_id=rc.candidate_id
            where rc.round_id=origin.id and c.gender=g and coalesce(t.vote_count,0)=cutoff);
          if g='M' then male_pending:=slots-above_count; else female_pending:=slots-above_count; end if;
        end if;
      end if;
    end if;
  end loop;
  if cardinality(tied_ids)=0 then raise exception 'No hay empate en el corte de cupos'; end if;
  select coalesce(max(round_number),0)+1 into next_no from public.voting_rounds where election_id=origin.election_id and round_kind='tie';
  insert into public.voting_rounds(election_id,round_kind,round_number,origin_round_id,attendance_policy,male_slots,female_slots,created_by)
    values(origin.election_id,'tie',next_no,origin.id,p_attendance_policy,male_pending,female_pending,auth.uid()) returning id into rid;
  insert into public.voting_round_candidates(round_id,candidate_id) select rid,x from unnest(tied_ids) x;
  insert into voting_private.audit_log(actor_id,action,entity_type,entity_id,detail)
    values(auth.uid(),'create_tie','round',rid::text,jsonb_build_object('origin_round_id',origin.id,'male_slots',male_pending,'female_slots',female_pending));
  return jsonb_build_object('ok',true,'round_id',rid,'candidate_count',cardinality(tied_ids),'male_slots',male_pending,'female_slots',female_pending);
end;
$$;

create or replace function public.voting_admin_open_round(p_round_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if not voting_private.is_admin() then raise exception 'Solo Administración' using errcode='42501'; end if;
  if exists(select 1 from public.voting_rounds where status='open' and id<>p_round_id) then raise exception 'Ya hay una votación abierta'; end if;
  if not exists(select 1 from public.voting_round_candidates where round_id=p_round_id) then raise exception 'Ronda sin candidatos'; end if;
  update public.voting_rounds set status='open',opened_at=now(),closed_at=null where id=p_round_id and status in ('draft','checkin');
  if not found then raise exception 'Ronda no disponible'; end if;
  insert into voting_private.audit_log(actor_id,action,entity_type,entity_id) values(auth.uid(),'open','round',p_round_id::text);
  return jsonb_build_object('ok',true);
end;
$$;

create or replace function public.voting_admin_start_checkin(p_round_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if not voting_private.is_admin() then raise exception 'Solo Administración' using errcode='42501'; end if;
  if exists(select 1 from public.voting_rounds where status in ('checkin','open')) then raise exception 'Ya hay una ronda activa'; end if;
  update public.voting_rounds set status='checkin' where id=p_round_id and status='draft';
  if not found then raise exception 'Ronda no disponible'; end if;
  insert into voting_private.audit_log(actor_id,action,entity_type,entity_id) values(auth.uid(),'start_checkin','round',p_round_id::text);
  return jsonb_build_object('ok',true);
end;
$$;

create or replace function public.voting_admin_close_active()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare rid uuid;
begin
  if not voting_private.is_admin() then raise exception 'Solo Administración' using errcode='42501'; end if;
  update public.voting_rounds set status='closed',closed_at=now() where status='open' returning id into rid;
  if rid is null then raise exception 'No hay votación abierta'; end if;
  insert into voting_private.audit_log(actor_id,action,entity_type,entity_id) values(auth.uid(),'close','round',rid::text);
  return jsonb_build_object('ok',true,'round_id',rid);
end;
$$;

create or replace function public.voting_admin_set_exception(p_round_id uuid,p_person_id bigint,p_valid_from timestamptz,p_valid_until timestamptz,p_reason text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare ident uuid; xid uuid;
begin
  if not voting_private.is_admin() then raise exception 'Solo Administración' using errcode='42501'; end if;
  select id into ident from voting_private.identities where person_id=p_person_id;
  if ident is null then raise exception 'Persona sin identidad electoral'; end if;
  update voting_private.location_exceptions set revoked_at=now() where identity_id=ident and round_id=p_round_id and revoked_at is null;
  insert into voting_private.location_exceptions(identity_id,round_id,valid_from,valid_until,reason,created_by)
    values(ident,p_round_id,p_valid_from,p_valid_until,p_reason,auth.uid()) returning id into xid;
  insert into voting_private.audit_log(actor_id,action,entity_type,entity_id,detail)
    values(auth.uid(),'location_exception','exception',xid::text,jsonb_build_object('person_id',p_person_id,'round_id',p_round_id));
  return jsonb_build_object('ok',true,'exception_id',xid);
end;
$$;

create or replace function public.voting_admin_results(p_round_id uuid)
returns table(candidate_id uuid,full_name text,gender text,vote_count integer) language plpgsql security definer set search_path = '' as $$
begin
  if not voting_private.is_admin() then raise exception 'Solo Administración' using errcode='42501'; end if;
  return query select c.id,c.full_name,c.gender,coalesce(t.vote_count,0)
    from public.voting_round_candidates rc join public.voting_candidates c on c.id=rc.candidate_id
    left join public.voting_tallies t on t.round_id=rc.round_id and t.candidate_id=rc.candidate_id
    where rc.round_id=p_round_id order by c.gender,coalesce(t.vote_count,0) desc,c.full_name;
end;
$$;

create or replace function public.voting_staff_pending(p_round_id uuid)
returns table(person_id bigint,full_name text,cedula_last4 text,attended boolean,voted boolean) language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Autenticación requerida' using errcode='42501'; end if;
  return query select i.person_id,p.full_name,i.cedula_last4,
    exists(select 1 from voting_private.attendance a where a.round_id=p_round_id and a.identity_id=i.id),
    exists(select 1 from voting_private.participation v where v.round_id=p_round_id and v.identity_id=i.id)
    from voting_private.eligibility e join voting_private.identities i on i.id=e.identity_id join public.people p on p.id=i.person_id
    join public.voting_rounds r on r.election_id=e.election_id and r.id=p_round_id
    where e.enabled and voting_private.identity_in_actor_scope(i.person_id)
    order by p.full_name;
end;
$$;

create or replace function public.voting_admin_snapshot()
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if not voting_private.is_admin() then raise exception 'Solo Administración' using errcode='42501'; end if;
  return jsonb_build_object(
    'elections',(select coalesce(jsonb_agg(to_jsonb(e) order by e.election_year desc),'[]'::jsonb) from public.voting_elections e),
    'candidates',(select coalesce(jsonb_agg(to_jsonb(c) order by c.full_name),'[]'::jsonb) from public.voting_candidates c),
    'rounds',(select coalesce(jsonb_agg(to_jsonb(r) || jsonb_build_object(
      'candidate_ids',(select coalesce(jsonb_agg(rc.candidate_id),'[]'::jsonb) from public.voting_round_candidates rc where rc.round_id=r.id),
      'attendance_count',(select count(*) from voting_private.attendance a where a.round_id=r.id),
      'voter_count',(select count(*) from voting_private.participation p where p.round_id=r.id)
    ) order by r.created_at desc),'[]'::jsonb) from public.voting_rounds r)
  );
end;
$$;

create or replace function public.voting_staff_people(p_election_id uuid)
returns table(person_id bigint,full_name text,group_name text,cedula_last4 text,enabled boolean) language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Autenticación requerida' using errcode='42501'; end if;
  return query select p.id,p.full_name,min(g.name),max(i.cedula_last4),coalesce(bool_or(e.enabled),false)
    from public.people p join public.memberships m on m.person_id=p.id and m.is_member is true
    join public.groups g on g.id=m.group_id and g.active is true
    left join voting_private.identities i on i.person_id=p.id
    left join voting_private.eligibility e on e.identity_id=i.id and e.election_id=p_election_id
    where voting_private.identity_in_actor_scope(p.id)
    group by p.id,p.full_name order by p.full_name;
end;
$$;

revoke all on function public.voting_enter(text,double precision,double precision) from public;
revoke all on function public.voting_ballot(uuid,double precision,double precision) from public;
revoke all on function public.voting_submit(uuid,uuid[],double precision,double precision) from public;
revoke all on function public.voting_enable_person(uuid,bigint,text,boolean) from public;
revoke all on function public.voting_admin_save_election(uuid,integer,text,integer,integer,double precision,double precision,integer) from public;
revoke all on function public.voting_admin_save_candidate(uuid,uuid,text,text,text,boolean,boolean) from public;
revoke all on function public.voting_admin_save_round(uuid,uuid,text,integer,text,integer,integer,uuid[]) from public;
revoke all on function public.voting_admin_create_tie_round(uuid,text) from public;
revoke all on function public.voting_admin_open_round(uuid) from public;
revoke all on function public.voting_admin_start_checkin(uuid) from public;
revoke all on function public.voting_admin_close_active() from public;
revoke all on function public.voting_admin_set_exception(uuid,bigint,timestamptz,timestamptz,text) from public;
revoke all on function public.voting_admin_results(uuid) from public;
revoke all on function public.voting_staff_pending(uuid) from public;
revoke all on function public.voting_admin_snapshot() from public;
revoke all on function public.voting_staff_people(uuid) from public;
grant execute on function public.voting_enter(text,double precision,double precision) to anon, authenticated;
grant execute on function public.voting_ballot(uuid,double precision,double precision) to anon, authenticated;
grant execute on function public.voting_submit(uuid,uuid[],double precision,double precision) to anon, authenticated;
grant execute on function public.voting_enable_person(uuid,bigint,text,boolean) to authenticated;
grant execute on function public.voting_admin_save_election(uuid,integer,text,integer,integer,double precision,double precision,integer) to authenticated;
grant execute on function public.voting_admin_save_candidate(uuid,uuid,text,text,text,boolean,boolean) to authenticated;
grant execute on function public.voting_admin_save_round(uuid,uuid,text,integer,text,integer,integer,uuid[]) to authenticated;
grant execute on function public.voting_admin_create_tie_round(uuid,text) to authenticated;
grant execute on function public.voting_admin_open_round(uuid) to authenticated;
grant execute on function public.voting_admin_start_checkin(uuid) to authenticated;
grant execute on function public.voting_admin_close_active() to authenticated;
grant execute on function public.voting_admin_set_exception(uuid,bigint,timestamptz,timestamptz,text) to authenticated;
grant execute on function public.voting_admin_results(uuid) to authenticated;
grant execute on function public.voting_staff_pending(uuid) to authenticated;
grant execute on function public.voting_admin_snapshot() to authenticated;
grant execute on function public.voting_staff_people(uuid) to authenticated;

revoke all on all functions in schema voting_private from public, anon, authenticated;

comment on table voting_private.participation is 'Prueba de voto único y padrón exacto del desempate; no contiene selecciones.';
comment on table public.voting_tallies is 'Conteo agregado; no contiene identidad del votante.';

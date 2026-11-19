-- Electoral registration is an additive, day-limited permission, not a Bethel role change.
alter table public.voting_elections add column registration_date date;
create table voting_private.registration_staff (
 election_id uuid not null references public.voting_elections(id),
 user_id uuid not null references auth.users(id),
 enabled boolean not null default true,
 assigned_by uuid not null references auth.users(id),
 assigned_at timestamptz not null default now(),
 primary key(election_id,user_id)
);
create index registration_staff_user_idx on voting_private.registration_staff(user_id,election_id);
create table voting_private.day_registrations (
 id uuid primary key default gen_random_uuid(),
 election_id uuid not null references public.voting_elections(id),
 round_id uuid not null references public.voting_rounds(id),
 person_id bigint not null references public.people(id),
 identity_id uuid not null references voting_private.identities(id),
 registered_by uuid not null references auth.users(id),
 registered_at timestamptz not null default now(),
 registration_day date not null default (now() at time zone 'America/Panama')::date,
 revoked_at timestamptz,
 revoked_by uuid references auth.users(id),
 revocation_reason text,
 unique(election_id,identity_id)
);
create index day_registrations_day_idx on voting_private.day_registrations(election_id,registration_day);
alter table voting_private.registration_staff enable row level security;
alter table voting_private.day_registrations enable row level security;
revoke all on voting_private.registration_staff,voting_private.day_registrations from public,anon,authenticated;

create function voting_private.can_register(target_election uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(
 select 1 from public.voting_elections e where e.id=target_election
 and e.registration_date=(now() at time zone 'America/Panama')::date
 and (voting_private.is_admin() or exists(select 1 from voting_private.registration_staff s
 where s.election_id=e.id and s.user_id=auth.uid() and s.enabled
 and not exists(select 1 from public.profiles p where p.user_id=s.user_id and not p.is_active))));
$$;
create function public.voting_registration_access()
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Acceso no autorizado' using errcode='42501'; end if;
 return jsonb_build_object('elections',coalesce((select jsonb_agg(jsonb_build_object(
 'id',e.id,'election_year',e.election_year,'title',e.title,'registration_date',e.registration_date))
 from public.voting_elections e where voting_private.can_register(e.id)),'[]'::jsonb));
end;
$$;
create function public.voting_admin_registration_date(p_election_id uuid,p_day date)
returns void language plpgsql security definer set search_path='' as $$
begin
 if not voting_private.is_admin() then raise exception 'Solo Administración' using errcode='42501'; end if;
 perform 1 from public.voting_elections where id=p_election_id for update;
 if not found then raise exception 'Elección no existe'; end if;
 update public.voting_elections set registration_date=p_day where id=p_election_id;
 insert into voting_private.audit_log(actor_id,action,entity_type,entity_id,detail)
 values(auth.uid(),'registration_date','election',p_election_id::text,jsonb_build_object('day',p_day));
end;
$$;
create function public.voting_admin_registration_staff(p_election_id uuid,p_user_id uuid,p_enabled boolean)
returns void language plpgsql security definer set search_path='' as $$
begin
 if not voting_private.is_admin() then raise exception 'Solo Administración' using errcode='42501'; end if;
 if p_enabled is null then raise exception 'Indica el estado del permiso'; end if;
 perform 1 from public.voting_elections where id=p_election_id for update;
 insert into voting_private.registration_staff(election_id,user_id,enabled,assigned_by)
 values(p_election_id,p_user_id,p_enabled,auth.uid()) on conflict(election_id,user_id)
 do update set enabled=excluded.enabled,assigned_by=auth.uid(),assigned_at=now();
 insert into voting_private.audit_log(actor_id,action,entity_type,entity_id,detail)
 values(auth.uid(),'registration_staff','user',p_user_id::text,jsonb_build_object('election_id',p_election_id,'enabled',p_enabled));
end;
$$;
create function public.voting_registration_panel(p_election_id uuid,p_day date default null)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare day date:=coalesce(p_day,(now() at time zone 'America/Panama')::date); admin boolean:=voting_private.is_admin();
begin
 if not admin and (not voting_private.can_register(p_election_id) or day<>(now() at time zone 'America/Panama')::date)
 then raise exception 'Personal de registro inactivo o fuera de alcance' using errcode='42501'; end if;
 return jsonb_build_object('day',day,'can_register',voting_private.can_register(p_election_id),
 'round',(select jsonb_build_object('id',r.id,'kind',r.round_kind,'status',r.status) from public.voting_rounds r
 where r.election_id=p_election_id and r.status in('checkin','open') and r.round_kind<>'tie' limit 1),
 'staff',case when admin then coalesce((select jsonb_agg(jsonb_build_object('user_id',u.id,'label',coalesce(p.full_name,u.email,u.id::text),'enabled',coalesce(s.enabled,false)))
 from auth.users u left join public.profiles p on p.user_id=u.id
 left join voting_private.registration_staff s on s.user_id=u.id and s.election_id=p_election_id
 where coalesce(p.is_active,true)),'[]'::jsonb) else '[]'::jsonb end,
 'rows',coalesce((select jsonb_agg(jsonb_build_object('id',d.id,'person_id',d.person_id,'full_name',p.full_name,'cedula_last4',i.cedula_last4,
 'registered_at',d.registered_at,'registered_by',coalesce(pr.full_name,u.email,d.registered_by::text),
 'enabled',coalesce(el.enabled,false),'revoked_at',d.revoked_at,'revocation_reason',d.revocation_reason,
 'attended',exists(select 1 from voting_private.attendance a where a.round_id=d.round_id and a.identity_id=d.identity_id),
 'voted',exists(select 1 from voting_private.participation v where v.identity_id=d.identity_id and v.round_id in(select r.id from public.voting_rounds r where r.election_id=d.election_id))) order by d.registered_at desc)
 from voting_private.day_registrations d join public.people p on p.id=d.person_id
 join voting_private.identities i on i.id=d.identity_id left join auth.users u on u.id=d.registered_by
 left join public.profiles pr on pr.user_id=d.registered_by left join voting_private.eligibility el on el.identity_id=d.identity_id and el.election_id=d.election_id
 where d.election_id=p_election_id and d.registration_day=day),'[]'::jsonb));
end;
$$;
create function public.voting_register_person(p_election_id uuid,p_full_name text,p_cedula text,p_latitude double precision,p_longitude double precision)
returns jsonb language plpgsql security definer set search_path='' as $$
declare e public.voting_elections%rowtype; r public.voting_rounds%rowtype; normalized text;
 pid bigint; ident uuid; rid uuid;
begin
 -- Lock configuration and staff permission until this atomic registration commits.
 select * into e from public.voting_elections where id=p_election_id for share;
 perform 1 from voting_private.registration_staff where election_id=p_election_id and user_id=auth.uid() for share;
 if not voting_private.can_register(p_election_id) then raise exception 'Personal de registro inactivo: acceso solo el día autorizado' using errcode='42501'; end if;
 select * into r from public.voting_rounds where election_id=p_election_id and status in('checkin','open') and round_kind<>'tie' for share;
 if r.id is null then raise exception 'Administración debe iniciar el ingreso de la votación'; end if;
 if e.church_latitude is null or e.church_longitude is null or e.radius_meters is null then raise exception 'Ubicación pendiente de configuración'; end if;
 if p_latitude is null or p_longitude is null or not(p_latitude between -90 and 90) or not(p_longitude between -180 and 180) then raise exception 'No se pudo verificar la ubicación actual'; end if;
 if not(voting_private.distance_m(e.church_latitude,e.church_longitude,p_latitude,p_longitude)<=e.radius_meters) then raise exception 'Está fuera del límite permitido para votar'; end if;
 if p_full_name is null or length(trim(p_full_name))<3 or length(trim(p_full_name))>200 then raise exception 'Introduce el nombre completo'; end if;
 normalized:=upper(regexp_replace(coalesce(p_cedula,''),'[^0-9A-Za-z]','','g'));
 if length(normalized)<5 or length(normalized)>40 then raise exception 'Cédula inválida'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(normalized,0));
 if exists(select 1 from voting_private.identities where cedula_hash=voting_private.cedula_hash(normalized)) then raise exception 'La persona ya está registrada. Administración debe revisar su habilitación; no se creará un duplicado'; end if;
 insert into public.people(full_name) values(trim(p_full_name)) returning id into pid;
 insert into voting_private.identities(person_id,cedula_hash,cedula_last4,created_by)
 values(pid,voting_private.cedula_hash(normalized),right(normalized,4),auth.uid()) returning id into ident;
 insert into voting_private.identity_people(person_id,identity_id) values(pid,ident);
 insert into voting_private.eligibility(election_id,identity_id,enabled,enabled_by) values(p_election_id,ident,true,auth.uid());
 insert into voting_private.attendance(round_id,identity_id,latitude,longitude,source) values(r.id,ident,p_latitude,p_longitude,'gps');
 insert into voting_private.day_registrations(election_id,round_id,person_id,identity_id,registered_by)
 values(e.id,r.id,pid,ident,auth.uid()) returning id into rid;
 insert into voting_private.audit_log(actor_id,action,entity_type,entity_id,detail)
 values(auth.uid(),'register_enable_attend','person',pid::text,jsonb_build_object('election_id',e.id,'round_id',r.id,'registration_id',rid));
 return jsonb_build_object('ok',true,'registration_id',rid,'person_id',pid,'enabled',true,'attended',true);
end;
$$;
create function public.voting_admin_revoke_registration(p_registration_id uuid,p_reason text)
returns void language plpgsql security definer set search_path='' as $$
declare d voting_private.day_registrations%rowtype;
begin
 if not voting_private.is_admin() then raise exception 'Solo Administración revoca habilitaciones' using errcode='42501'; end if;
 if p_reason is null or length(trim(p_reason))<3 then raise exception 'Indica el motivo de revocación'; end if;
 select * into d from voting_private.day_registrations where id=p_registration_id for update;
 if d.id is null then raise exception 'Registro no existe'; end if;
 update voting_private.eligibility set enabled=false,enabled_by=auth.uid(),enabled_at=now() where election_id=d.election_id and identity_id=d.identity_id;
 update voting_private.day_registrations set revoked_at=now(),revoked_by=auth.uid(),revocation_reason=trim(p_reason) where id=d.id;
 insert into voting_private.audit_log(actor_id,action,entity_type,entity_id,detail)
 values(auth.uid(),'revoke_registration','person',d.person_id::text,jsonb_build_object('election_id',d.election_id,'reason',trim(p_reason)));
end;
$$;
-- Existing roster RPC must not provide an alternate revocation path to leaders/pastors.
create or replace function public.voting_enable_person(p_election_id uuid, p_person_id bigint, p_cedula text, p_enabled boolean default true)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare ident uuid; linked uuid; normalized text;
begin
  if not voting_private.is_admin() and (p_enabled is not true or exists(select 1 from voting_private.day_registrations d where d.election_id=p_election_id and d.person_id=p_person_id)) then raise exception 'Solo Administración modifica o revoca este registro' using errcode='42501'; end if;
  if not voting_private.identity_in_actor_scope(p_person_id) then raise exception 'Fuera de alcance' using errcode='42501'; end if;
  if not exists(select 1 from public.people where id=p_person_id) then raise exception 'Persona no existe'; end if;
  normalized:=upper(regexp_replace(coalesce(p_cedula,''),'[^0-9A-Za-z]','','g'));
  if length(normalized)<5 then raise exception 'Cédula inválida'; end if;
  -- Serialize this normalized document so separate territorial records cannot race.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(normalized,0));
  select id into ident from voting_private.identities where cedula_hash=voting_private.cedula_hash(normalized);
  if not voting_private.is_admin() and exists(select 1 from voting_private.day_registrations d where d.identity_id=ident and d.election_id=p_election_id) then raise exception 'Solo Administración modifica este registro' using errcode='42501'; end if;
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

revoke all on function public.voting_registration_access() from public,anon,authenticated;
grant execute on function public.voting_registration_access() to authenticated;
revoke all on function public.voting_admin_registration_date(uuid,date) from public,anon,authenticated;
grant execute on function public.voting_admin_registration_date(uuid,date) to authenticated;
revoke all on function public.voting_admin_registration_staff(uuid,uuid,boolean) from public,anon,authenticated;
grant execute on function public.voting_admin_registration_staff(uuid,uuid,boolean) to authenticated;
revoke all on function public.voting_registration_panel(uuid,date) from public,anon,authenticated;
grant execute on function public.voting_registration_panel(uuid,date) to authenticated;
revoke all on function public.voting_register_person(uuid,text,text,double precision,double precision) from public,anon,authenticated;
grant execute on function public.voting_register_person(uuid,text,text,double precision,double precision) to authenticated;
revoke all on function public.voting_admin_revoke_registration(uuid,text) from public,anon,authenticated;
grant execute on function public.voting_admin_revoke_registration(uuid,text) to authenticated;
revoke all on function voting_private.can_register(uuid) from public,anon,authenticated;

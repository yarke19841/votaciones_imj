-- Separate attendance from electoral enrollment. Existing assignments remain reception-only.
alter table voting_private.registration_staff add column can_admit boolean not null default false;

create function voting_private.can_admit(election uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(
  select 1 from public.voting_elections e where e.id=election
  and e.registration_date=(now() at time zone 'America/Panama')::date
  and (voting_private.is_admin() or exists(select 1 from voting_private.registration_staff s
   where s.election_id=e.id and s.user_id=auth.uid() and s.can_admit
   and not exists(select 1 from public.profiles p where p.user_id=s.user_id and not p.is_active))));
$$;
revoke all on function voting_private.can_admit(uuid) from public,anon,authenticated;

create function public.voting_admin_admission_staff(p_election_id uuid,p_user_id uuid,p_enabled boolean)
returns void language plpgsql security definer set search_path='' as $$
begin
 if not voting_private.is_admin() then raise exception 'Solo Administración' using errcode='42501'; end if;
 if p_enabled is null then raise exception 'Indica el estado del permiso'; end if;
 perform 1 from public.voting_elections where id=p_election_id for update;
 insert into voting_private.registration_staff(election_id,user_id,enabled,can_admit,assigned_by)
 values(p_election_id,p_user_id,false,p_enabled,auth.uid())
 on conflict(election_id,user_id) do update set can_admit=excluded.can_admit,assigned_by=auth.uid(),assigned_at=now();
 insert into voting_private.audit_log(actor_id,action,entity_type,entity_id,detail)
 values(auth.uid(),'admission_staff','user',p_user_id::text,jsonb_build_object('election_id',p_election_id,'enabled',p_enabled));
end;
$$;

create or replace function public.voting_registration_access()
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Acceso no autorizado' using errcode='42501'; end if;
 return jsonb_build_object('elections',coalesce((select jsonb_agg(jsonb_build_object(
 'id',e.id,'election_year',e.election_year,'title',e.title,'registration_date',e.registration_date,
 'reception',voting_private.can_register(e.id),'admission',voting_private.can_admit(e.id)))
 from public.voting_elections e where voting_private.can_register(e.id) or voting_private.can_admit(e.id)),'[]'::jsonb));
end;
$$;
create or replace function public.voting_registration_panel(p_election_id uuid,p_day date default null)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare day date:=coalesce(p_day,(now() at time zone 'America/Panama')::date); admin boolean:=voting_private.is_admin();
begin
 if not admin and (not (voting_private.can_register(p_election_id) or voting_private.can_admit(p_election_id)) or day<>(now() at time zone 'America/Panama')::date)
 then raise exception 'Personal de registro inactivo o fuera de alcance' using errcode='42501'; end if;
 return jsonb_build_object('day',day,'can_register',voting_private.can_register(p_election_id),'can_admit',voting_private.can_admit(p_election_id),
 'round',(select jsonb_build_object('id',r.id,'kind',r.round_kind,'status',r.status) from public.voting_rounds r
 where r.election_id=p_election_id and r.status in('checkin','open') and r.round_kind<>'tie' limit 1),
 'staff',case when admin then coalesce((select jsonb_agg(jsonb_build_object('user_id',u.id,'label',coalesce(p.full_name,u.email,u.id::text),'enabled',coalesce(s.enabled,false),'can_admit',coalesce(s.can_admit,false)))
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
 where d.election_id=p_election_id and d.registration_day=day and (admin or (voting_private.can_admit(p_election_id) and d.registered_by=auth.uid()))),'[]'::jsonb));
end;
$$;
-- Keep the legacy registration API available to Administration.
create or replace function public.voting_register_person(p_election_id uuid,p_full_name text,p_cedula text,p_latitude double precision,p_longitude double precision)
returns jsonb language plpgsql security definer set search_path='' as $$
declare e public.voting_elections%rowtype; r public.voting_rounds%rowtype; normalized text;
 pid bigint; ident uuid; rid uuid;
begin
 if not voting_private.is_admin() then raise exception 'Solo Administración puede usar el registro anterior; usa Nuevo ingreso' using errcode='42501'; end if;
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
create or replace function public.voting_reception_attend(p_election_id uuid,p_cedula text,p_latitude double precision,p_longitude double precision)
returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.voting_rounds%rowtype; e public.voting_elections%rowtype; i voting_private.identities%rowtype; normalized text; added integer;
begin
 select * into e from public.voting_elections where id=p_election_id for share;
 perform 1 from voting_private.registration_staff where election_id=p_election_id and user_id=auth.uid() for share;
 if not voting_private.can_register(p_election_id) then raise exception 'Recepción sin permiso activo para esta elección y fecha' using errcode='42501'; end if;
 select * into r from public.voting_rounds where election_id=p_election_id and status in('checkin','open') and round_kind<>'tie' for share;
 if r.id is null then raise exception 'Administración debe iniciar el ingreso'; end if;
 normalized:=upper(regexp_replace(coalesce(p_cedula,''),'[^A-Za-z0-9]','','g'));
 if length(normalized) not between 5 and 40 then raise exception 'Cédula inválida'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(normalized,0));
 select * into i from voting_private.identities where cedula_hash=voting_private.cedula_hash(normalized);
 if i.id is null then raise exception 'Cédula no encontrada; remite a Nuevo ingreso'; end if;
 if exists(select 1 from voting_private.eligibility el where el.election_id=e.id and el.identity_id=i.id and not el.enabled)
 or exists(select 1 from voting_private.day_registrations d where d.election_id=e.id and d.identity_id=i.id and d.revoked_at is not null)
 then raise exception 'Habilitación denegada o revocada: requiere revisión de Administración'; end if;
 perform 1 from voting_private.eligibility el where el.election_id=e.id and el.identity_id=i.id and el.enabled for share;
 if not found then raise exception 'No figura en el padrón; remite a Nuevo ingreso'; end if;
 if e.church_latitude is null or e.radius_meters is null then raise exception 'Ubicación o radio pendiente'; end if;
 if p_latitude is null or p_longitude is null or not(p_latitude between -90 and 90 and p_longitude between -180 and 180)
 then raise exception 'No se pudo verificar la ubicación actual'; end if;
 if voting_private.distance_m(e.church_latitude,e.church_longitude,p_latitude,p_longitude)>e.radius_meters then raise exception 'Está fuera del límite permitido para votar'; end if;
 insert into voting_private.attendance(round_id,identity_id,latitude,longitude,source) values(r.id,i.id,p_latitude,p_longitude,'assisted') on conflict do nothing;
 get diagnostics added=row_count;
 if added=1 then
 insert into voting_private.audit_log(actor_id,action,entity_type,entity_id,detail)
 values(auth.uid(),'reception_attend','round',r.id::text,jsonb_build_object('identity_id',i.id));
 end if;
 return jsonb_build_object('ok',true,'already_attended',added=0);
end;
$$;

-- Resolve exact membership server-side. Multiple active legacy matches require review.
create function voting_private.admission_member(document text,person_identity uuid)
returns text language plpgsql stable security definer set search_path='' as $$
declare matches integer; member_name text;
begin
 select count(*),min(trim(m.full_name)) into matches,member_name from public.member m
 where m.is_active is true and upper(regexp_replace(coalesce(m.cedula,''),'[^A-Za-z0-9]','','g'))=document;
 if matches>1 then raise exception 'La cédula tiene registros duplicados; consulta con Administración'; end if;
 if person_identity is not null then
  select p.full_name into member_name from voting_private.identities i join public.people p on p.id=i.person_id
  where i.id=person_identity and (matches=1 or exists(
   select 1 from voting_private.identity_people ip where ip.identity_id=i.id and (
    exists(select 1 from public.memberships m join public.groups g on g.id=m.group_id and g.active is true where m.person_id=ip.person_id and m.is_member is true)
    or exists(select 1 from voting_private.territorial_members tm join public.territories t on t.id=tm.territory_id and t.is_active where tm.person_id=ip.person_id))));
 end if;
 return nullif(trim(member_name),'');
end;
$$;
revoke all on function voting_private.admission_member(text,uuid) from public,anon,authenticated;

create function public.voting_admission_lookup(p_election_id uuid,p_cedula text)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare doc text; ident uuid; name text;
begin
 if not voting_private.can_admit(p_election_id) then raise exception 'Nuevo ingreso sin permiso activo' using errcode='42501'; end if;
 if not exists(select 1 from public.voting_rounds where election_id=p_election_id and status in('checkin','open') and round_kind<>'tie') then raise exception 'Administración debe iniciar el ingreso'; end if;
 doc:=upper(regexp_replace(coalesce(p_cedula,''),'[^A-Za-z0-9]','','g'));
 if length(doc) not between 5 and 40 then raise exception 'Introduce la cédula completa'; end if;
 select id into ident from voting_private.identities where cedula_hash=voting_private.cedula_hash(doc);
 name:=voting_private.admission_member(doc,ident);
 return jsonb_build_object('person',case when name is null then null else jsonb_build_object(
 'full_name',name,'cedula_last4',right(doc,4),
 'enabled',exists(select 1 from voting_private.eligibility where election_id=p_election_id and identity_id=ident and enabled),
 'blocked',exists(select 1 from voting_private.eligibility where election_id=p_election_id and identity_id=ident and not enabled)
  or exists(select 1 from voting_private.day_registrations where election_id=p_election_id and identity_id=ident and revoked_at is not null)) end);
end;
$$;

create function public.voting_admission_enable(p_election_id uuid,p_cedula text,p_latitude double precision,p_longitude double precision)
returns jsonb language plpgsql security definer set search_path='' as $$
declare e public.voting_elections%rowtype; r public.voting_rounds%rowtype;
 i voting_private.identities%rowtype; doc text; name text; pid bigint; ident uuid; rid uuid;
begin
 select * into e from public.voting_elections where id=p_election_id for share;
 perform 1 from voting_private.registration_staff where election_id=e.id and user_id=auth.uid() for share;
 if not voting_private.can_admit(p_election_id) then raise exception 'Nuevo ingreso sin permiso activo' using errcode='42501'; end if;
 select * into r from public.voting_rounds where election_id=e.id and status in('checkin','open') and round_kind<>'tie' for share;
 if r.id is null then raise exception 'Administración debe iniciar el ingreso'; end if;
 if e.church_latitude is null or e.church_longitude is null or e.radius_meters is null then raise exception 'Ubicación pendiente de configuración'; end if;
 if p_latitude is null or p_longitude is null or not(p_latitude between -90 and 90 and p_longitude between -180 and 180) then raise exception 'No se pudo verificar la ubicación actual'; end if;
 if not(voting_private.distance_m(e.church_latitude,e.church_longitude,p_latitude,p_longitude)<=e.radius_meters) then raise exception 'Está fuera del límite permitido para votar'; end if;
 doc:=upper(regexp_replace(coalesce(p_cedula,''),'[^A-Za-z0-9]','','g'));
 if length(doc) not between 5 and 40 then raise exception 'Introduce la cédula completa'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(doc,0));
 select * into i from voting_private.identities where cedula_hash=voting_private.cedula_hash(doc);
 if exists(select 1 from voting_private.eligibility where election_id=e.id and identity_id=i.id and not enabled)
 or exists(select 1 from voting_private.day_registrations where election_id=e.id and identity_id=i.id and revoked_at is not null)
 then raise exception 'Habilitación denegada o revocada: requiere revisión de Administración'; end if;
 name:=voting_private.admission_member(doc,i.id);
 if name is null then raise exception 'No se pudo validar como miembro activo; consulta con Administración'; end if;
 pid:=i.person_id; ident:=i.id;
 if ident is null then
  -- A verified member exists in the legacy directory; only the voting identity is created.
  insert into public.people(full_name) values(name) returning id into pid;
  insert into voting_private.identities(person_id,cedula_hash,cedula_last4,created_by)
  values(pid,voting_private.cedula_hash(doc),right(doc,4),auth.uid()) returning id into ident;
  insert into voting_private.identity_people(person_id,identity_id) values(pid,ident);
 end if;
 insert into voting_private.eligibility(election_id,identity_id,enabled,enabled_by)
 values(e.id,ident,true,auth.uid()) on conflict do nothing;
 if not found then
  if exists(select 1 from voting_private.eligibility where election_id=e.id and identity_id=ident and enabled)
  then return jsonb_build_object('ok',true,'already_enabled',true); end if;
  raise exception 'Requiere revisión de Administración';
 end if;
 insert into voting_private.day_registrations(election_id,round_id,person_id,identity_id,registered_by)
 values(e.id,r.id,pid,ident,auth.uid()) returning id into rid;
 insert into voting_private.audit_log(actor_id,action,entity_type,entity_id,detail)
 values(auth.uid(),'admit_verified_member','person',pid::text,jsonb_build_object('election_id',e.id,'round_id',r.id,'registration_id',rid));
 return jsonb_build_object('ok',true,'already_enabled',false);
end;
$$;

revoke all on function public.voting_admin_admission_staff(uuid,uuid,boolean),public.voting_admission_lookup(uuid,text),
 public.voting_admission_enable(uuid,text,double precision,double precision) from public,anon,authenticated;
grant execute on function public.voting_admin_admission_staff(uuid,uuid,boolean),public.voting_admission_lookup(uuid,text),
 public.voting_admission_enable(uuid,text,double precision,double precision) to authenticated;

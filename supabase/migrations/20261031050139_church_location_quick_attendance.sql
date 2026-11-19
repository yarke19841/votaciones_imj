-- This module belongs to Ministerio Jezreel; no Bethel church/calendar settings change.
create table voting_private.church_location (
 church_key text primary key check(church_key='imj'),
 latitude double precision not null check(latitude between -90 and 90),
 longitude double precision not null check(longitude between -180 and 180)
);
alter table voting_private.church_location enable row level security;
revoke all on voting_private.church_location from public,anon,authenticated;
insert into voting_private.church_location values('imj',9.03782,-79.46696);

create function voting_private.election_church_location()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.radius_meters is null then
  new.church_latitude:=null; new.church_longitude:=null;
 else
  select latitude,longitude into strict new.church_latitude,new.church_longitude
   from voting_private.church_location where church_key='imj';
 end if;
 return new;
end;
$$;
revoke all on function voting_private.election_church_location() from public,anon,authenticated;
create trigger voting_fixed_church_location before insert or update of church_latitude,church_longitude,radius_meters
 on public.voting_elections for each row execute function voting_private.election_church_location();
update public.voting_elections set church_latitude=church_latitude where radius_meters is not null;

create function public.voting_admin_church_location()
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not voting_private.is_admin() then raise exception 'Solo Administración' using errcode='42501'; end if;
 return (select jsonb_build_object('church','Ministerio Jezreel','latitude',latitude,'longitude',longitude)
  from voting_private.church_location where church_key='imj');
end;
$$;
revoke all on function public.voting_admin_church_location() from public,anon,authenticated;
grant execute on function public.voting_admin_church_location() to authenticated;

alter table voting_private.attendance drop constraint attendance_source_check;
alter table voting_private.attendance add constraint attendance_source_check check(source in('gps','exception','assisted'));

create function public.voting_admin_quick_lookup(p_round_id uuid,p_cedula text,p_day date)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare r public.voting_rounds%rowtype; i voting_private.identities%rowtype; coverage jsonb; present bigint;
begin
 if not voting_private.is_admin() then raise exception 'Solo Administración' using errcode='42501'; end if;
 select * into r from public.voting_rounds where id=p_round_id;
 if r.id is null or p_day is null then raise exception 'Selecciona ronda y fecha'; end if;
 coverage:=public.voting_admin_member_coverage();
 select count(*) into present from voting_private.attendance a where a.round_id=r.id
  and (a.checked_at at time zone 'America/Panama')::date=p_day
  and exists(select 1 from voting_private.identity_people ip join public.memberships m on m.person_id=ip.person_id
   where ip.identity_id=a.identity_id and m.is_member is true);
 if length(regexp_replace(coalesce(p_cedula,''),'[^0-9A-Za-z]','','g'))>=5 then
  select * into i from voting_private.identities where cedula_hash=voting_private.cedula_hash(p_cedula);
 end if;
 return jsonb_build_object('coverage',coverage,'member_present',present,'person',
  case when i.id is null then null else (select jsonb_build_object('person_id',p.id,'full_name',p.full_name,
   'cedula_last4',i.cedula_last4,'enabled',exists(select 1 from voting_private.eligibility e where e.election_id=r.election_id and e.identity_id=i.id and e.enabled),
   'attended',exists(select 1 from voting_private.attendance a where a.round_id=r.id and a.identity_id=i.id),
   'attended_on',(select (a.checked_at at time zone 'America/Panama')::date from voting_private.attendance a where a.round_id=r.id and a.identity_id=i.id))
   from public.people p where p.id=i.person_id) end);
end;
$$;
revoke all on function public.voting_admin_quick_lookup(uuid,text,date) from public,anon,authenticated;
grant execute on function public.voting_admin_quick_lookup(uuid,text,date) to authenticated;

create function public.voting_admin_quick_attend(p_round_id uuid,p_cedula text,p_day date,p_latitude double precision,p_longitude double precision)
returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.voting_rounds%rowtype; e public.voting_elections%rowtype; i voting_private.identities%rowtype; added integer;
begin
 if not voting_private.is_admin() then raise exception 'Solo Administración' using errcode='42501'; end if;
 if p_day is distinct from (now() at time zone 'America/Panama')::date then raise exception 'Solo se registra asistencia del día actual de Panamá'; end if;
 select * into r from public.voting_rounds where id=p_round_id for share;
 if r.id is null or r.status not in('checkin','open') then raise exception 'Inicia el ingreso de esta ronda antes de registrar asistencia'; end if;
 select * into e from public.voting_elections where id=r.election_id for share;
 select * into i from voting_private.identities where cedula_hash=voting_private.cedula_hash(p_cedula);
 if i.id is null then raise exception 'Cédula no registrada; esta pantalla no crea miembros'; end if;
 if r.round_kind='tie' and not exists(select 1 from voting_private.participation p where p.round_id=r.origin_round_id and p.identity_id=i.id)
 then raise exception 'La persona no pertenece al padrón de este desempate'; end if;
 if e.church_latitude is null or e.radius_meters is null then raise exception 'Ubicación o radio pendiente'; end if;
 if p_latitude is null or p_longitude is null or not(p_latitude between -90 and 90 and p_longitude between -180 and 180)
 then raise exception 'No se pudo verificar la ubicación actual'; end if;
 if voting_private.distance_m(e.church_latitude,e.church_longitude,p_latitude,p_longitude)>e.radius_meters
 then raise exception 'Está fuera del límite permitido para votar'; end if;
 insert into voting_private.attendance(round_id,identity_id,latitude,longitude,source)
 values(r.id,i.id,p_latitude,p_longitude,'assisted') on conflict do nothing;
 get diagnostics added=row_count;
 if added=1 then
  insert into voting_private.audit_log(actor_id,action,entity_type,entity_id,detail)
  values(auth.uid(),'quick_attend','round',r.id::text,jsonb_build_object('identity_id',i.id,'day',p_day,'source','assisted'));
 end if;
 return jsonb_build_object('ok',true,'already_attended',added=0);
end;
$$;
revoke all on function public.voting_admin_quick_attend(uuid,text,date,double precision,double precision) from public,anon,authenticated;
grant execute on function public.voting_admin_quick_attend(uuid,text,date,double precision,double precision) to authenticated;

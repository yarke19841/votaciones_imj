-- Manual attestation is scoped to the assigned electoral desk and audited.
create function public.voting_admission_create_verified(p_election_id uuid,p_cedula text,p_full_name text,p_verification text,p_latitude double precision,p_longitude double precision)
returns jsonb language plpgsql security definer set search_path='' as $$
declare e public.voting_elections%rowtype; r public.voting_rounds%rowtype;
 i voting_private.identities%rowtype; doc text; name text; evidence text; pid bigint; ident uuid; rid uuid;
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
 if voting_private.admission_member(doc,i.id) is not null then
  raise exception 'La persona ya está en el directorio. Vuelve a buscarla y usa la habilitación habitual';
 end if;
 if exists(select 1 from public.member m where m.is_active is not true
  and upper(regexp_replace(coalesce(m.cedula,''),'[^A-Za-z0-9]','','g'))=doc) then
  raise exception 'Existe un registro de membresía inactivo; requiere revisión de Administración';
 end if;
 name:=nullif(trim(p_full_name),'');
 evidence:=nullif(trim(p_verification),'');
 if name is null or length(name) not between 3 and 200 then raise exception 'Introduce el nombre completo'; end if;
 if evidence is null or length(evidence) not between 5 and 250 then raise exception 'Indica quién o qué registro confirmó la membresía'; end if;
 pid:=i.person_id; ident:=i.id;
 if ident is null then
  -- Create an electoral identity only; do not create a church membership.
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
 values(auth.uid(),'admit_manually_verified_member','person',pid::text,jsonb_build_object('election_id',e.id,'round_id',r.id,'registration_id',rid,'verification',evidence));
 return jsonb_build_object('ok',true,'already_enabled',false);
end;
$$;
revoke all on function public.voting_admission_create_verified(uuid,text,text,text,double precision,double precision) from public,anon,authenticated;
grant execute on function public.voting_admission_create_verified(uuid,text,text,text,double precision,double precision) to authenticated;

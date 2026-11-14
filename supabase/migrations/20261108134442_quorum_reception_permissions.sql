alter table public.voting_elections add column quorum_percent numeric(5,2)
 check(quorum_percent>0 and quorum_percent<=100);

create function public.voting_admin_set_quorum(p_election_id uuid,p_percent numeric)
returns void language plpgsql security definer set search_path='' as $$
begin
 if not voting_private.is_admin() then raise exception 'Solo Administración' using errcode='42501'; end if;
 if p_percent is null or p_percent<=0 or p_percent>100 or p_percent<>round(p_percent,2) then raise exception 'Introduce un porcentaje mayor que 0 y hasta 100, con hasta dos decimales'; end if;
 update public.voting_elections set quorum_percent=p_percent where id=p_election_id;
 if not found then raise exception 'Elección no existe'; end if;
 insert into voting_private.audit_log(actor_id,action,entity_type,entity_id,detail)
 values(auth.uid(),'set_quorum','election',p_election_id::text,jsonb_build_object('percent',p_percent));
end;
$$;
create function public.voting_admin_quorum(p_round_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare r public.voting_rounds%rowtype; pct numeric; total bigint; present bigint; needed bigint;
begin
 if not voting_private.is_admin() then raise exception 'Solo Administración' using errcode='42501'; end if;
 select * into r from public.voting_rounds where id=p_round_id;
 if r.id is null or r.round_kind='tie' then raise exception 'Selecciona un simulacro o votación oficial'; end if;
 select quorum_percent into pct from public.voting_elections where id=r.election_id;
 select count(*),count(*) filter(where exists(select 1 from voting_private.attendance a where a.round_id=r.id and a.identity_id=e.identity_id))
 into total,present from voting_private.eligibility e where e.election_id=r.election_id and e.enabled;
 needed:=case when pct is not null and total>0 then ceil(total*pct/100)::bigint end;
 return jsonb_build_object('quorum_percent',pct,'eligible_total',total,'eligible_present',present,
 'present_percent',case when total>0 then round(present*100.0/total,2) end,'required_present',needed,
 'remaining',case when needed is not null then greatest(0,needed-present) end,
 'reached',case when needed is not null then present>=needed end,'round_status',r.status);
end;
$$;
revoke all on function public.voting_admin_set_quorum(uuid,numeric) from public,anon,authenticated;
revoke all on function public.voting_admin_quorum(uuid) from public,anon,authenticated;
grant execute on function public.voting_admin_set_quorum(uuid,numeric),public.voting_admin_quorum(uuid) to authenticated;

-- Reception is the existing day-limited registration permission, not an admin role.
create function public.voting_reception_lookup(p_election_id uuid,p_cedula text)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare r public.voting_rounds%rowtype; i voting_private.identities%rowtype;
begin
 if not voting_private.can_register(p_election_id) then raise exception 'Recepción sin permiso activo para esta elección y fecha' using errcode='42501'; end if;
 select * into r from public.voting_rounds where election_id=p_election_id and status in('checkin','open') and round_kind<>'tie';
 if r.id is null then raise exception 'Administración debe iniciar el ingreso'; end if;
 if length(regexp_replace(coalesce(p_cedula,''),'[^A-Za-z0-9]','','g')) not between 5 and 40 then raise exception 'Introduce la cédula completa'; end if;
 select * into i from voting_private.identities where cedula_hash=voting_private.cedula_hash(p_cedula);
 return jsonb_build_object('person',case when i.id is null then null else (select jsonb_build_object(
 'full_name',p.full_name,'cedula_last4',i.cedula_last4,
 'enabled',exists(select 1 from voting_private.eligibility e where e.election_id=p_election_id and e.identity_id=i.id and e.enabled),
 'blocked',exists(select 1 from voting_private.eligibility e where e.election_id=p_election_id and e.identity_id=i.id and not e.enabled),
 'attended',exists(select 1 from voting_private.attendance a where a.round_id=r.id and a.identity_id=i.id))
 from public.people p where p.id=i.person_id) end);
end;
$$;
create function public.voting_reception_attend(p_election_id uuid,p_cedula text,p_latitude double precision,p_longitude double precision)
returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.voting_rounds%rowtype; e public.voting_elections%rowtype; i voting_private.identities%rowtype; normalized text; added integer; enabled_new integer;
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
 if i.id is null then raise exception 'Cédula no encontrada; usa Registrar persona'; end if;
 if exists(select 1 from voting_private.eligibility el where el.election_id=e.id and el.identity_id=i.id and not el.enabled)
 or exists(select 1 from voting_private.day_registrations d where d.election_id=e.id and d.identity_id=i.id and d.revoked_at is not null)
 then raise exception 'Habilitación denegada o revocada: requiere revisión de Administración'; end if;
 if e.church_latitude is null or e.radius_meters is null then raise exception 'Ubicación o radio pendiente'; end if;
 if p_latitude is null or p_longitude is null or not(p_latitude between -90 and 90 and p_longitude between -180 and 180)
 then raise exception 'No se pudo verificar la ubicación actual'; end if;
 if voting_private.distance_m(e.church_latitude,e.church_longitude,p_latitude,p_longitude)>e.radius_meters then raise exception 'Está fuera del límite permitido para votar'; end if;
 insert into voting_private.eligibility(election_id,identity_id,enabled,enabled_by) values(e.id,i.id,true,auth.uid()) on conflict do nothing;
 get diagnostics enabled_new=row_count;
 insert into voting_private.attendance(round_id,identity_id,latitude,longitude,source) values(r.id,i.id,p_latitude,p_longitude,'assisted') on conflict do nothing;
 get diagnostics added=row_count;
 if added=1 or enabled_new=1 then
 insert into voting_private.audit_log(actor_id,action,entity_type,entity_id,detail)
 values(auth.uid(),'reception_attend','round',r.id::text,jsonb_build_object('identity_id',i.id,'enabled_new',enabled_new=1));
 end if;
 return jsonb_build_object('ok',true,'already_attended',added=0,'enabled_new',enabled_new=1);
end;
$$;
revoke all on function public.voting_reception_lookup(uuid,text),public.voting_reception_attend(uuid,text,double precision,double precision) from public,anon,authenticated;
grant execute on function public.voting_reception_lookup(uuid,text),public.voting_reception_attend(uuid,text,double precision,double precision) to authenticated;

-- Staff snapshots must not expose the admin-only quorum setting indirectly.
create or replace function public.voting_staff_snapshot()
returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not exists(select 1 from public.profiles p where p.user_id=auth.uid() and p.is_active and p.role in('admin','leader','pastor')) then raise exception 'Personal autorizado requerido' using errcode='42501'; end if;
 return jsonb_build_object(
 'elections',(select coalesce(jsonb_agg(to_jsonb(e)-'quorum_percent' order by e.election_year desc),'[]'::jsonb) from public.voting_elections e),
 'rounds',(select coalesce(jsonb_agg(to_jsonb(r) order by r.created_at desc),'[]'::jsonb) from public.voting_rounds r));
end;
$$;

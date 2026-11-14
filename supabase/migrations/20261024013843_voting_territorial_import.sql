-- Territorial electoral list, without inventing a cell or changing Bethel memberships.
create table voting_private.territorial_members (
 territory_id bigint not null references public.territories(id),
 person_id bigint not null references public.people(id),
 created_by uuid not null references auth.users(id),
 created_at timestamptz not null default now(),
 primary key(territory_id,person_id)
);
create index territorial_members_person_idx on voting_private.territorial_members(person_id);
alter table voting_private.territorial_members enable row level security;
revoke all on voting_private.territorial_members from public,anon,authenticated;

create function voting_private.territory_in_actor_scope(tid bigint)
returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from public.territories t where t.id=tid and t.is_active)
 and (voting_private.is_admin() or exists(select 1 from public.profiles p
 join public.pastor_territories pt on pt.pastor_user_id=p.user_id
 where p.user_id=auth.uid() and p.is_active and p.role='pastor' and pt.territory_id=tid));
$$;
revoke all on function voting_private.territory_in_actor_scope(bigint) from public,anon,authenticated;

-- Preserve existing group scope and add explicitly assigned territorial lists for pastors.
do $$ declare definition text; begin
 definition:=pg_get_functiondef('voting_private.identity_in_actor_scope(bigint)'::regprocedure);
 definition:=replace(definition,'when ''pastor'' then p.is_active and exists (',
 'when ''pastor'' then p.is_active and (exists(select 1 from voting_private.territorial_members tm where tm.person_id=target_person_id and voting_private.territory_in_actor_scope(tm.territory_id)) or exists (');
 definition:=replace(definition,'else false end',') else false end');
 execute definition;
end $$;

create function public.voting_admin_territories()
returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if not voting_private.is_admin() then raise exception 'Solo Administración' using errcode='42501'; end if;
 return (select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name) order by name),'[]'::jsonb) from public.territories where is_active);
end $$;
revoke all on function public.voting_admin_territories() from public,anon,authenticated;
grant execute on function public.voting_admin_territories() to authenticated;

create function public.voting_admin_import_members(p_territory_id bigint,p_rows jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare item jsonb; normalized text; fullname text; ident uuid; pid bigint; matches bigint; created int:=0; reused int:=0; linked int:=0;
begin
 if not voting_private.is_admin() then raise exception 'Solo Administración' using errcode='42501'; end if;
 if not exists(select 1 from public.territories where id=p_territory_id and is_active) then raise exception 'Territorio activo requerido'; end if;
 if p_rows is null or jsonb_typeof(p_rows)<>'array' then raise exception 'Archivo inválido'; end if;
 if jsonb_array_length(p_rows) not between 1 and 500 then raise exception 'Carga de 1 a 500 filas'; end if;
 -- Serialize imports; per-document lock also coordinates with individual identity linking.
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('voting_territorial_import',0));
 for item in select value from jsonb_array_elements(p_rows) order by value->>'cedula' loop
  fullname:=trim(item->>'full_name');
  normalized:=upper(regexp_replace(coalesce(item->>'cedula',''),'[^0-9A-Za-z]','','g'));
  if fullname is null or length(fullname) not between 2 and 200 or length(normalized) not between 5 and 40 then raise exception 'Nombre o cédula inválidos'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(normalized,0));
  select id into ident from voting_private.identities where cedula_hash=voting_private.cedula_hash(normalized);
  select min(p.id),count(*) into pid,matches from public.people p join voting_private.identity_people ip on ip.person_id=p.id
   where ip.identity_id=ident and (exists(select 1 from voting_private.territorial_members tm where tm.person_id=p.id and tm.territory_id=p_territory_id)
    or exists(select 1 from public.memberships m join public.groups g on g.id=m.group_id where m.person_id=p.id and m.is_member is true and g.territory_id=p_territory_id));
  if matches>1 then raise exception 'Identidad con varios registros en el territorio: requiere revisión'; end if;
  if pid is not null then
   if not exists(select 1 from public.people where id=pid and upper(trim(full_name))=upper(fullname)) then raise exception 'Nombre distinto para una cédula existente: requiere revisión'; end if;
   reused:=reused+1;
  else
   if exists(select 1 from public.people p where upper(trim(p.full_name))=upper(fullname) and
    (exists(select 1 from voting_private.territorial_members tm where tm.person_id=p.id and tm.territory_id=p_territory_id)
    or exists(select 1 from public.memberships m join public.groups g on g.id=m.group_id where m.person_id=p.id and m.is_member is true and g.territory_id=p_territory_id))) then
     raise exception 'Nombre ya presente en el territorio: verifica y vincula su cédula antes de importar';
   end if;
   insert into public.people(full_name) values(fullname) returning id into pid;
   if ident is null then
    insert into voting_private.identities(person_id,cedula_hash,cedula_last4,created_by)
     values(pid,voting_private.cedula_hash(normalized),right(normalized,4),auth.uid()) returning id into ident;
   end if;
   insert into voting_private.identity_people(person_id,identity_id) values(pid,ident);
   created:=created+1;
  end if;
  insert into voting_private.territorial_members(territory_id,person_id,created_by) values(p_territory_id,pid,auth.uid()) on conflict do nothing;
  if found then linked:=linked+1; end if;
 end loop;
 insert into voting_private.audit_log(actor_id,action,entity_type,entity_id,detail)
 values(auth.uid(),'import_members','territory',p_territory_id::text,jsonb_build_object('created',created,'reused',reused,'linked',linked));
 return jsonb_build_object('created',created,'reused',reused,'linked',linked);
end $$;
revoke all on function public.voting_admin_import_members(bigint,jsonb) from public,anon,authenticated;
grant execute on function public.voting_admin_import_members(bigint,jsonb) to authenticated;

create or replace function public.voting_staff_roster(p_election_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not exists(select 1 from public.profiles p where p.user_id=auth.uid() and p.is_active and p.role in('admin','leader','pastor')) then raise exception 'Personal autorizado requerido' using errcode='42501'; end if;
 return (select coalesce(jsonb_agg(to_jsonb(x) order by x.full_name),'[]'::jsonb) from (
  select p.id person_id,p.full_name,i.cedula_last4,coalesce(e.enabled,false) enabled,
  (select coalesce(jsonb_agg(z),'[]'::jsonb) from (
   select jsonb_build_object('id',sg.id::text,'name',sg.name) z from public.groups sg where voting_private.group_in_actor_scope(sg.id) and exists(select 1 from public.memberships sm where sm.group_id=sg.id and sm.person_id=p.id and sm.is_member is true)
   union all select jsonb_build_object('id','territory-'||t.id,'name',t.name||' · listado territorial') from voting_private.territorial_members tm join public.territories t on t.id=tm.territory_id where tm.person_id=p.id and voting_private.territory_in_actor_scope(t.id)
  ) lists) groups
  from public.people p
  left join voting_private.identity_people ip on ip.person_id=p.id
  left join voting_private.identities i on i.id=ip.identity_id
  left join voting_private.eligibility e on e.identity_id=i.id and e.election_id=p_election_id
  where voting_private.identity_in_actor_scope(p.id) and
   (exists(select 1 from public.memberships m where m.person_id=p.id and m.is_member is true and voting_private.group_in_actor_scope(m.group_id))
    or exists(select 1 from voting_private.territorial_members tm where tm.person_id=p.id and voting_private.territory_in_actor_scope(tm.territory_id)))
 ) x);
end $$;

create or replace function public.voting_admin_member_coverage()
returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 if not voting_private.is_admin() then raise exception 'Solo Administración' using errcode='42501'; end if;
 with members as (select m.person_id from public.memberships m join public.people p on p.id=m.person_id where m.is_member is true
  union select tm.person_id from voting_private.territorial_members tm),
 covered as (select m.person_id,ip.identity_id from members m left join voting_private.identity_people ip on ip.person_id=m.person_id),
 counts as (select count(*) records,count(distinct identity_id) known,count(*) filter(where identity_id is null) missing from covered)
 select jsonb_build_object('member_records',records,'identified_members',known,'unidentified_records',missing,
  'total_members',case when missing=0 then known else null end,'complete',missing=0) into result from counts;
 return result;
end $$;
-- Add imported territorial members to the numerator without counting an identity twice.
do $$ declare definition text; begin
 definition:=pg_get_functiondef('public.voting_admin_snapshot()'::regprocedure);
 definition:=replace(definition,'and m.is_member is true where ip.identity_id=a.identity_id)',
 'and m.is_member is true where ip.identity_id=a.identity_id) or exists(select 1 from voting_private.identity_people ip join voting_private.territorial_members tm on tm.person_id=ip.person_id where ip.identity_id=a.identity_id)');
 -- Parentheses are needed so the round predicate applies to both membership sources.
 definition:=replace(definition,'a.round_id=r.id and exists(select 1 from voting_private.identity_people',
 'a.round_id=r.id and (exists(select 1 from voting_private.identity_people');
 definition:=replace(definition,'where ip.identity_id=a.identity_id)),','where ip.identity_id=a.identity_id))),');
 execute definition;
end $$;

-- The authoritative list remains public.member. Link on authorization, without
-- copying the whole list, inventing church memberships, or enabling voters.
create table voting_private.existing_roster_links (
  member_id text primary key,
  identity_id uuid not null references voting_private.identities(id) on delete restrict,
  created_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id)
);
alter table voting_private.existing_roster_links enable row level security;
revoke all on voting_private.existing_roster_links from public,anon,authenticated;

create function public.voting_admin_existing_roster(p_election_id uuid default null)
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
  if not voting_private.is_admin() then raise exception 'Solo Administración' using errcode='42501'; end if;
  if p_election_id is not null and not exists(select 1 from public.voting_elections where id=p_election_id) then
    raise exception 'Elección no encontrada';
  end if;
  return (select coalesce(jsonb_agg(jsonb_build_object(
    'member_id',m.id::text,'full_name',coalesce(m.full_name,''),
    'cedula_last4',right(upper(regexp_replace(coalesce(m.cedula,''),'[^0-9A-Za-z]','','g')),4),
    'linked_cedula_last4',li.cedula_last4,
    'active',coalesce(m.is_active,false),'enabled',coalesce(e.enabled,false),
    'needs_review',((l.identity_id is not null and l.identity_id is distinct from i.id)
      or nullif(trim(m.full_name),'') is null or length(regexp_replace(coalesce(m.cedula,''),'[^0-9A-Za-z]','','g')) not between 5 and 40),
    'groups',jsonb_build_array(jsonb_build_object('id','existing-roster','name','Padrón electoral existente'))
  ) order by m.full_name,m.id),'[]'::jsonb)
  from public.member m
  left join voting_private.identities i on i.cedula_hash=voting_private.cedula_hash(upper(regexp_replace(m.cedula,'[^0-9A-Za-z]','','g')))
  left join voting_private.existing_roster_links l on l.member_id=m.id::text
  left join voting_private.identities li on li.id=l.identity_id
  left join voting_private.eligibility e on e.identity_id=coalesce(l.identity_id,i.id) and e.election_id=p_election_id);
end;
$$;

create function public.voting_admin_enable_existing_member(p_election_id uuid,p_member_id text,p_cedula text,p_enabled boolean)
returns jsonb language plpgsql security definer set search_path='' as $$
declare m public.member%rowtype; normalized text; ident uuid; linked uuid; linked_hash text; pid bigint;
begin
  if not voting_private.is_admin() then raise exception 'Solo Administración' using errcode='42501'; end if;
  if p_enabled is null then raise exception 'Indica la habilitación'; end if;
  if not exists(select 1 from public.voting_elections where id=p_election_id) then raise exception 'Elección no encontrada'; end if;
  select * into m from public.member where id::text=p_member_id for share;
  if m.id is null then raise exception 'Persona no encontrada en el padrón existente'; end if;
  if p_enabled and nullif(trim(m.full_name),'') is null then raise exception 'Nombre del padrón pendiente de revisión'; end if;
  if p_enabled and m.is_active is not true then raise exception 'La persona está inactiva en el padrón'; end if;
  normalized:=upper(regexp_replace(coalesce(p_cedula,''),'[^0-9A-Za-z]','','g'));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(normalized,0));
  select id,person_id into ident,pid from voting_private.identities where cedula_hash=voting_private.cedula_hash(upper(regexp_replace(coalesce(m.cedula,''),'[^0-9A-Za-z]','','g')));
  select identity_id into linked from voting_private.existing_roster_links where member_id=m.id::text;
  if linked is not null and linked is distinct from ident then
    if p_enabled then raise exception 'La cédula vinculada cambió: requiere revisión administrativa; se conserva el historial'; end if;
    select cedula_hash into linked_hash from voting_private.identities where id=linked;
    if length(normalized) not between 5 and 40 or (
      voting_private.cedula_hash(normalized) is distinct from linked_hash
      and normalized is distinct from upper(regexp_replace(coalesce(m.cedula,''),'[^0-9A-Za-z]','','g'))
    ) then raise exception 'La cédula no coincide con la persona del padrón'; end if;
    insert into voting_private.eligibility(election_id,identity_id,enabled,enabled_by)
      values(p_election_id,linked,false,auth.uid()) on conflict(election_id,identity_id)
      do update set enabled=false,enabled_at=now(),enabled_by=auth.uid();
    insert into voting_private.audit_log(actor_id,action,entity_type,entity_id,detail)
      values(auth.uid(),'revoke_changed_roster_identity','member',m.id::text,jsonb_build_object('election_id',p_election_id,'identity_id',linked));
    return jsonb_build_object('ok',true,'enabled',false,'needs_review',true);
  end if;
  if length(normalized) not between 5 and 40 or normalized is distinct from upper(regexp_replace(coalesce(m.cedula,''),'[^0-9A-Za-z]','','g')) then
    raise exception 'La cédula no coincide con la persona del padrón';
  end if;
  if ident is null then
    insert into public.people(full_name) values(trim(m.full_name)) returning id into pid;
  end if;
  perform public.voting_enable_person(p_election_id,pid,normalized,p_enabled);
  select id into ident from voting_private.identities where cedula_hash=voting_private.cedula_hash(normalized);
  insert into voting_private.existing_roster_links(member_id,identity_id,created_by)
    values(m.id::text,ident,auth.uid()) on conflict(member_id) do nothing;
  insert into voting_private.audit_log(actor_id,action,entity_type,entity_id,detail)
    values(auth.uid(),'existing_roster_eligibility','member',m.id::text,
      jsonb_build_object('election_id',p_election_id,'enabled',p_enabled));
  return jsonb_build_object('ok',true,'enabled',p_enabled);
end;
$$;
revoke all on function public.voting_admin_existing_roster(uuid),public.voting_admin_enable_existing_member(uuid,text,text,boolean) from public,anon,authenticated;
grant execute on function public.voting_admin_existing_roster(uuid),public.voting_admin_enable_existing_member(uuid,text,text,boolean) to authenticated;

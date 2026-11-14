-- All fictitious test data is rolled back; no live election is opened.
begin;
do $$
declare admin_id uuid; leader_id uuid; result jsonb; n bigint; eid uuid; pid bigint;
begin
 select user_id into admin_id from public.profiles where role='admin' and is_active limit 1;
 if admin_id is null then raise exception 'Active admin required for verification'; end if;
 perform set_config('request.jwt.claim.sub',admin_id::text,true);
 insert into public.territories(id,name,is_active) values(-918800001,'DEMO rollback import',true);
 result:=public.voting_admin_import_members(-918800001,'[{"full_name":"DEMO rollback imported person","cedula":"ROLLBACKIMPORT918800001"}]');
 assert (result->>'created')::int=1,'initial import';
 result:=public.voting_admin_import_members(-918800001,'[{"full_name":"DEMO rollback imported person","cedula":"ROLLBACKIMPORT918800001"}]');
 assert (result->>'created')::int=0,'idempotent retry';
 select person_id into pid from voting_private.territorial_members where territory_id=-918800001;
 assert not exists(select 1 from public.memberships where person_id=pid),'no cell invented';
 assert not exists(select 1 from voting_private.eligibility e join voting_private.identity_people ip on ip.identity_id=e.identity_id where ip.person_id=pid),'not enabled';
 select id into eid from public.voting_elections order by election_year desc limit 1;
 assert exists(select 1 from jsonb_array_elements(public.voting_staff_roster(eid)) p where (p->>'person_id')::bigint=pid),'visible roster';
 n:=(public.voting_admin_member_coverage()->>'identified_members')::bigint;
 assert n>0,'member coverage';
 begin
  perform public.voting_admin_import_members(-918800001,'[{"full_name":"DEMO valid first row","cedula":"AAA918800001"},{"full_name":"X","cedula":"ZZZ918800001"}]');
  raise exception 'Invalid batch was accepted';
 exception when others then
  if sqlerrm='Invalid batch was accepted' then raise; end if;
 end;
 assert not exists(select 1 from public.people where full_name='DEMO valid first row'),'atomic batch';
 select user_id into leader_id from public.profiles where role='leader' and is_active limit 1;
 if leader_id is not null then
  perform set_config('request.jwt.claim.sub',leader_id::text,true);
  begin
   perform public.voting_admin_import_members(-918800001,'[{"full_name":"DEMO unauthorized","cedula":"UNAUTHORIZED918800001"}]');
   raise exception 'Leader import accepted';
  exception when insufficient_privilege then null;
  end;
 end if;
 assert not has_function_privilege('anon','public.voting_admin_import_members(bigint,jsonb)','EXECUTE'),'anonymous API denied';
 assert not has_table_privilege('authenticated','voting_private.territorial_members','SELECT'),'mapping inaccessible';
end $$;
select 'PASS import production checks; transaction rolled back' as verification;
rollback;

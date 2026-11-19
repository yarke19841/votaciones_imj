-- Production post-install smoke test. ALL synthetic application rows roll back.
-- No users/roles/profiles/memberships are changed. Does not verify HTTP or GPS.
-- Audit sequence numbers may advance, as PostgreSQL sequences are not transactional.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '45s';
create temp table prod_checks(name text, passed boolean);
do $$
declare adm uuid; eid uuid; c1 uuid; c2 uuid; r uuid; pr uuid; pc uuid;
 p1 constant bigint := -917100001; p2 constant bigint := -917100002;
 p3 constant bigint := -917100003; pd constant bigint := -917100004;
 v jsonb; v2 jsonb; tok uuid; tie uuid; denied boolean; lat double precision; lon double precision;
begin
 -- Refuse to overlap any operational round or collide with existing records.
 if exists(select 1 from public.voting_rounds where status in ('checkin','open')) then
  raise exception 'Production smoke test requires zero active rounds';
 end if;
 if exists(select 1 from public.voting_elections where election_year=2099)
 or exists(select 1 from public.people where id in(p1,p2,p3,pd))
 or exists(select 1 from voting_private.identities where cedula_hash in(
   voting_private.cedula_hash('PROD-ROLLBACK-001'),voting_private.cedula_hash('PROD-ROLLBACK-002'),
   voting_private.cedula_hash('PROD-ROLLBACK-003')))
 or exists(select 1 from public.voting_candidates where full_name='PROD rollback practice fixture') then
  raise exception 'Synthetic fixture collision; no existing records will be changed';
 end if;
 select latitude,longitude into lat,lon from voting_private.church_location where church_key='imj';
 select user_id into adm from public.profiles where role='admin' and is_active order by user_id limit 1;
 if adm is null then raise exception 'An existing active admin profile is required'; end if;
 insert into public.people(id,full_name) values
  (p1,'PROD rollback voter A'),(p2,'PROD rollback voter B'),
  (p3,'PROD rollback disabled'),(pd,'PROD rollback duplicate');
 perform set_config('request.jwt.claim.sub',adm::text,true);
 eid:=public.voting_admin_save_election(null,2099,'PROD rollback contract - discarded',1,0,lat,lon,150);
 c1:=public.voting_admin_save_candidate(null,eid,'PROD rollback A','M',null,false,true);
 c2:=public.voting_admin_save_candidate(null,eid,'PROD rollback B','M',null,false,true);
 pc:=public.voting_admin_save_candidate(null,null,'PROD rollback practice fixture','M',null,true,true);
 r:=public.voting_admin_save_round(null,eid,'official',1,'new',1,0,array[c1,c2]);
 pr:=public.voting_admin_save_round(null,eid,'practice',1,'new',1,0,array[pc]);
 perform public.voting_enable_person(eid,p1,'PROD-ROLLBACK-001',true);
 perform public.voting_enable_person(eid,pd,'prod rollback 001',true);
 perform public.voting_enable_person(eid,p2,'PROD-ROLLBACK-002',true);
 perform public.voting_enable_person(eid,p3,'PROD-ROLLBACK-003',false);
 insert into prod_checks values('territorial aliases share one identity',
  (select count(distinct identity_id)=1 from voting_private.identity_people where person_id in(p1,pd)));
 perform public.voting_admin_start_checkin(r);
 v:=public.voting_admin_quick_lookup(r,'PROD-ROLLBACK-001',(now() at time zone 'America/Panama')::date);
 insert into prod_checks values('quick exact lookup existing person',v->'person'->>'full_name'='PROD rollback voter A');
 v:=public.voting_admin_quick_attend(r,'PROD-ROLLBACK-001',(now() at time zone 'America/Panama')::date,lat,lon);
 insert into prod_checks values('quick assistance saved',(v->>'already_attended')::boolean=false);
 v:=public.voting_admin_quick_attend(r,'PROD-ROLLBACK-001',(now() at time zone 'America/Panama')::date,lat,lon);
 insert into prod_checks values('quick repeated assistance is idempotent',(v->>'already_attended')::boolean=true);
 insert into prod_checks values('new election inherited fixed church point',exists(select 1 from public.voting_elections where id=eid and church_latitude=lat and church_longitude=lon));
 perform set_config('request.jwt.claim.sub','',true);
 v:=public.voting_enter('PROD-ROLLBACK-001',lat,lon); tok:=(v->>'token')::uuid;
 insert into prod_checks values('automatic attendance waits without candidates',
  v->>'state'='waiting' and (v->>'attended')::boolean and not(v?'candidates'));
 perform public.voting_enter('PROD-ROLLBACK-001',lat,lon);
 insert into prod_checks values('attendance idempotent',(select count(*)=1 from voting_private.attendance where round_id=r));
 v:=public.voting_enter('PROD-ROLLBACK-003',lat,lon);
 insert into prod_checks values('disabled arrival stays disabled',v->>'reason'='not_enabled' and (v->>'attended')::boolean);
 insert into prod_checks values('preopening ballot hidden',public.voting_ballot(tok,lat,lon)->>'state'='waiting');
 denied:=false;
 begin perform public.voting_admin_open_round(r); exception when insufficient_privilege then denied:=true; end;
 insert into prod_checks values('missing admin identity cannot open',denied);
 perform set_config('request.jwt.claim.sub',adm::text,true);
 perform public.voting_admin_open_round(r);
 denied:=false;
 begin perform public.voting_admin_open_round(pr); exception when others then denied:=true; end;
 insert into prod_checks values('second opening rejected',denied);
 perform set_config('request.jwt.claim.sub','',true);
 insert into prod_checks values('ballot rechecks location',public.voting_ballot(tok,10,-79)->>'state'='location_denied');
 insert into prod_checks values('submit rechecks location',public.voting_submit(tok,array[c1],10,-79)->>'state'='location_denied');
 insert into prod_checks values('quota revalidated',public.voting_submit(tok,array[c1,c2],lat,lon)->>'state'='invalid_quota');
 insert into prod_checks values('valid ballot accepted',public.voting_submit(tok,array[c1],lat,lon)->>'state'='accepted');
 insert into prod_checks values('repeat vote rejected',public.voting_submit(tok,array[c1],lat,lon)->>'state'<>'accepted');
 v2:=public.voting_enter('PROD-ROLLBACK-002',lat,lon);
 insert into prod_checks values('second voter accepted',public.voting_submit((v2->>'token')::uuid,array[c2],lat,lon)->>'state'='accepted');
 perform set_config('request.jwt.claim.sub',adm::text,true);
 insert into prod_checks values('pending removes participants',(select count(*)=0 from public.voting_staff_pending(r)));
 v:=public.voting_admin_close_active();
 insert into prod_checks values('close selects active round',v->>'round_id'=r::text);
 insert into prod_checks values('results calculated',(select count(*)=2 and min(vote_count)=1 and max(vote_count)=1 from public.voting_admin_results(r)));
 v:=public.voting_admin_create_tie_round(r,'origin'); tie:=(v->>'round_id')::uuid;
 insert into prod_checks values('tie only tied candidates',v->>'candidate_count'='2' and v->>'male_slots'='1');
 insert into prod_checks values('tie exact unique electorate',(select count(*)=2 from public.voting_staff_pending(tie)));
 perform public.voting_admin_open_round(tie);
 perform set_config('request.jwt.claim.sub','',true);
 insert into prod_checks values('nonparticipant excluded',public.voting_enter('PROD-ROLLBACK-003',lat,lon)->>'reason'='not_in_tie_electorate');
 v:=public.voting_enter('PROD-ROLLBACK-001',lat,lon);
 insert into prod_checks values('origin voter can cast tie vote',public.voting_submit((v->>'token')::uuid,array[c1],lat,lon)->>'state'='accepted');
 perform set_config('request.jwt.claim.sub',adm::text,true);
 perform public.voting_admin_close_active();
 insert into prod_checks values('origin history unchanged',(select sum(vote_count)=2 from public.voting_tallies where round_id=r));
 perform public.voting_admin_open_round(pr);
 perform set_config('request.jwt.claim.sub','',true);
 v:=public.voting_enter('PROD-ROLLBACK-001',lat,lon);
 insert into prod_checks values('practice independent of official',public.voting_submit((v->>'token')::uuid,array[pc],lat,lon)->>'state'='accepted');
 insert into prod_checks values('anonymous administrative RPC privilege absent',
  not has_function_privilege('anon','public.voting_admin_snapshot()','EXECUTE'));
 insert into prod_checks values('anonymous voter RPC privilege present',
  has_function_privilege('anon','public.voting_enter(text,double precision,double precision)','EXECUTE'));
 insert into prod_checks values('private participation inaccessible to authenticated',
  not has_table_privilege('authenticated','voting_private.participation','SELECT'));
 if exists(select 1 from prod_checks where passed is distinct from true) then
  raise exception 'Production smoke assertion failed: %',
   (select string_agg(name,', ') from prod_checks where passed is distinct from true);
 end if;
end $$;
select count(*) checks,bool_and(passed) all_passed,jsonb_agg(name) verified from prod_checks;
rollback;

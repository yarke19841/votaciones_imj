-- QA only. Synthetic application rows and temporary assignment roll back.
-- Refuses non-QA active rounds. Existing QA check-in is closed only inside
-- this rollback transaction and restored when it ends. No profiles/credentials change.
begin;
set local lock_timeout='5s';
set local statement_timeout='45s';
create temp table quorum_checks(name text,passed boolean);
do $$
declare adm uuid; staff uuid; e uuid; r uuid; c uuid; v jsonb; denied boolean;
begin
 if exists(select 1 from public.voting_rounds r join public.voting_elections e on e.id=r.election_id where r.status in('checkin','open') and (e.title not like 'QA DEMO%' or r.status<>'checkin')) then raise exception 'Unexpected active round: stop'; end if;
 update public.voting_rounds r set status='closed' from public.voting_elections e where e.id=r.election_id and e.title like 'QA DEMO%' and r.status='checkin';
 if exists(select 1 from public.voting_elections where election_year=2099) or exists(select 1 from public.people where id=-918110001) then raise exception 'Fixture collision'; end if;
 select user_id into adm from public.profiles where role='admin' and is_active limit 1;
 select u.id into staff from auth.users u where not exists(select 1 from public.profiles p where p.user_id=u.id and (p.role='admin' or not p.is_active)) limit 1;
 if adm is null or staff is null then raise exception 'Existing QA actors required'; end if;
 perform set_config('request.jwt.claim.sub',adm::text,true);
 e:=public.voting_admin_save_election(null,2099,'QA quorum discarded',1,0,null,null,400);
 c:=public.voting_admin_save_candidate(null,e,'QA quorum ficticio','M',null,false,true);
 r:=public.voting_admin_save_round(null,e,'official',1,'new',1,0,array[c]);
 v:=public.voting_admin_quorum(r);
 insert into quorum_checks values('no invented quorum',v->>'quorum_percent' is null and v->>'reached' is null);
 perform public.voting_admin_set_quorum(e,75);
 insert into public.people(id,full_name) values(-918110001,'QA quorum arrival');
 perform public.voting_enable_person(e,-918110001,'QA-QUORUM-0001',true);
 perform public.voting_admin_registration_date(e,(now() at time zone 'America/Panama')::date);
 perform public.voting_admin_registration_staff(e,staff,true);
 perform public.voting_admin_start_checkin(r);
 perform set_config('request.jwt.claim.sub',staff::text,true);
 denied:=false; begin perform public.voting_admin_quorum(r); exception when insufficient_privilege then denied:=true; end;
 insert into quorum_checks values('reception cannot read quorum',denied);
 denied:=false; begin perform public.voting_admin_set_quorum(e,50); exception when insufficient_privilege then denied:=true; end;
 insert into quorum_checks values('reception cannot configure quorum',denied);
 v:=public.voting_reception_lookup(e,'QA-QUORUM-0001');
 insert into quorum_checks values('reception exact lookup',v->'person'->>'full_name'='QA quorum arrival');
 v:=public.voting_reception_attend(e,'QA-QUORUM-0001',9.03782,-79.46696);
 insert into quorum_checks values('arrival saved',not(v->>'already_attended')::boolean);
 v:=public.voting_reception_attend(e,'QA-QUORUM-0001',9.03782,-79.46696);
 insert into quorum_checks values('duplicate arrival ignored',(v->>'already_attended')::boolean);
 perform public.voting_register_person(e,'QA new discarded','QA-QUORUM-0002',9.03782,-79.46696);
 perform set_config('request.jwt.claim.sub',adm::text,true);
 v:=public.voting_admin_quorum(r);
 insert into quorum_checks values('new person updates quorum',(v->>'eligible_total')::int=2 and (v->>'eligible_present')::int=2 and (v->>'reached')::boolean);
 insert into quorum_checks values('no automatic opening',exists(select 1 from public.voting_rounds where id=r and status='checkin'));
 insert into quorum_checks values('no votes',(select count(*)=0 from voting_private.participation where round_id=r));
 if exists(select 1 from quorum_checks where passed is distinct from true) then raise exception 'QA quorum contract failed'; end if;
end;
$$;
select * from quorum_checks;
rollback;

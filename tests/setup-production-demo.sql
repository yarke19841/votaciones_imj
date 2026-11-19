-- Explicitly authorized production DEMO. Only synthetic people, candidates
-- and election 2098 are created; existing people/memberships are not updated.
-- Location/radius remain unset for Administration to choose on screen.
begin;
set local lock_timeout='5s';
create temp table demo_created(election_id uuid, practice_round uuid, official_round uuid);
do $$
declare adm uuid; eid uuid; practice uuid; official uuid; ids_off uuid[]:='{}'; ids_pr uuid[]:='{}'; cid uuid; i integer;
begin
 if exists(select 1 from public.voting_elections where election_year=2098)
   or exists(select 1 from public.people where id between -917200006 and -917200001)
   or exists(select 1 from voting_private.identities x join generate_series(1,6) n
     on x.cedula_hash=voting_private.cedula_hash('DEMO-PROD-'||lpad(n::text,3,'0'))) then
   raise exception 'DEMO collision; existing records will not be changed';
 end if;
 select user_id into adm from public.profiles where role='admin' and is_active order by user_id limit 1;
 if adm is null then raise exception 'Active administrator required'; end if;
 perform set_config('request.jwt.claim.sub',adm::text,true);
 eid:=public.voting_admin_save_election(null,2098,'DEMO — Prueba técnica con datos ficticios',3,2,null,null,null);
 for i in 1..8 loop
   cid:=public.voting_admin_save_candidate(null,eid,'DEMO Candidato oficial '||i,case when i<=4 then 'F' else 'M' end,null,false,true);
   ids_off:=array_append(ids_off,cid);
   cid:=public.voting_admin_save_candidate(null,null,'DEMO Catálogo práctica 2026 — '||i,case when i<=4 then 'F' else 'M' end,null,true,true);
   ids_pr:=array_append(ids_pr,cid);
 end loop;
 official:=public.voting_admin_save_round(null,eid,'official',1,'new',3,2,ids_off);
 practice:=public.voting_admin_save_round(null,eid,'practice',1,'new',3,2,ids_pr);
 for i in 1..6 loop
   insert into public.people(id,full_name) values(-917200000-i,'DEMO — Persona ficticia '||i);
   perform public.voting_enable_person(eid,-917200000-i,'DEMO-PROD-'||lpad(i::text,3,'0'),i<>3);
 end loop;
 insert into demo_created values(eid,practice,official);
end $$;
select election_id,practice_round,official_round from demo_created;
commit;

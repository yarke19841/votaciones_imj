-- QA only. All synthetic changes, claims and audit entries roll back.
begin;
create temp table qa_catalog_checks(name text,passed boolean);
do $$
declare adm uuid; eid uuid; future uuid; c uuid; v2 uuid; rnd uuid; draft uuid;
 p1 bigint; alias bigint; p2 bigint; missing bigint; before_cov jsonb; after_cov jsonb;
 entry jsonb; ballot jsonb; old_results jsonb; snap jsonb; denied boolean;
begin
 if exists(select 1 from public.voting_rounds where status in ('checkin','open')) then raise exception 'QA has an active round'; end if;
 select user_id into adm from public.profiles where role='admin' and is_active limit 1;
 if adm is null then raise exception 'QA admin missing'; end if;
 perform set_config('request.jwt.claim.sub',adm::text,true);
 before_cov:=public.voting_admin_member_coverage();
 insert into public.people(full_name) values('QA catalog member') returning id into p1;
 insert into public.people(full_name) values('QA catalog territorial alias') returning id into alias;
 insert into public.people(full_name) values('QA catalog not enabled') returning id into p2;
 insert into public.people(full_name) values('QA catalog missing document') returning id into missing;
 insert into public.memberships(person_id,is_member) values(p1,true),(p1,true),(alias,true),(p2,true),(missing,true);
 eid:=public.voting_admin_save_election(null,2097,'QA catalog rollback',1,0,9,-79,150);
 future:=public.voting_admin_save_election(null,2096,'QA catalog future rollback',1,0,9,-79,150);
 perform public.voting_enable_person(eid,p1,'QA-CATALOG-001',true);
 perform public.voting_enable_person(eid,alias,'qa catalog 001',false);
 perform public.voting_enable_person(eid,p1,'QA-CATALOG-001',true);
 perform public.voting_enable_person(eid,p2,'QA-CATALOG-002',false);
 after_cov:=public.voting_admin_member_coverage();
 insert into qa_catalog_checks values('membership rows deduplicate person records',
  (after_cov->>'member_records')::int=(before_cov->>'member_records')::int+4);
 insert into qa_catalog_checks values('territorial aliases deduplicate verified identities independently of enabled',
  (after_cov->>'identified_members')::int=(before_cov->>'identified_members')::int+2);
 insert into qa_catalog_checks values('missing document prevents a complete denominator',
  (after_cov->>'unidentified_records')::int=(before_cov->>'unidentified_records')::int+1 and after_cov->>'total_members' is null);
 c:=public.voting_admin_save_candidate(null,null,'QA catalog original','M','qa-catalog/old.png',true,true);
 rnd:=public.voting_admin_save_round(null,eid,'practice',1,'new',1,0,array[c]);
 draft:=public.voting_admin_save_round(null,future,'practice',1,'new',1,0,array[c]);
 perform public.voting_admin_open_round(rnd);
 perform set_config('request.jwt.claim.sub','',true);
 entry:=public.voting_enter('QA-CATALOG-001',9,-79);
 perform set_config('request.jwt.claim.sub',adm::text,true);
 v2:=public.voting_admin_save_candidate(c,null,'QA catalog original','M','qa-catalog/new.png',true,true);
 insert into qa_catalog_checks values('used practice edit creates version',v2<>c);
 insert into qa_catalog_checks values('old photo immutable while its round is open',not public.voting_storage_photo_mutable('qa-catalog/old.png'));
 insert into qa_catalog_checks values('new unused photo is mutable',public.voting_storage_photo_mutable('qa-catalog/new.png'));
 insert into qa_catalog_checks values('draft reference follows current version',exists(select 1 from public.voting_round_candidates where round_id=draft and candidate_id=v2));
 denied:=false;
 begin perform public.voting_admin_save_candidate(c,null,'QA catalog original','M','qa-catalog/bad.png',true,true); exception when others then denied:=true; end;
 insert into qa_catalog_checks values('stale edit rejected',denied);
 perform set_config('request.jwt.claim.sub','',true);
 ballot:=public.voting_ballot((entry->>'token')::uuid,9,-79);
 insert into qa_catalog_checks values('ongoing ballot keeps original photo and candidate',
  ballot->'candidates'->0->>'photo_url'='qa-catalog/old.png' and ballot->'candidates'->0->>'id'=c::text);
 insert into qa_catalog_checks values('ongoing round hides new photo',public.voting_photo_visible('qa-catalog/old.png') and not public.voting_photo_visible('qa-catalog/new.png'));
 insert into qa_catalog_checks values('ballot prepared before version edit still submits once',
  public.voting_submit((entry->>'token')::uuid,array[c],9,-79)->>'state'='accepted');
 perform set_config('request.jwt.claim.sub',adm::text,true);
 snap:=public.voting_admin_snapshot();
 insert into qa_catalog_checks values('member attendance uses one verified identity',
  exists(select 1 from jsonb_array_elements(snap->'rounds') r where r->>'id'=rnd::text and r->>'member_attendance_count'='1'));
 insert into qa_catalog_checks values('catalog exposes current version only',
  exists(select 1 from jsonb_array_elements(snap->'candidates') c2 where c2->>'id'=v2::text)
  and not exists(select 1 from jsonb_array_elements(snap->'candidates') c2 where c2->>'id'=c::text));
 perform public.voting_admin_close_active();
 select jsonb_agg(to_jsonb(r)) into old_results from public.voting_admin_results(rnd) r;
 perform public.voting_enable_person(future,p1,'QA-CATALOG-001',true);
 perform public.voting_admin_open_round(draft);
 perform set_config('request.jwt.claim.sub','',true);
 entry:=public.voting_enter('QA-CATALOG-001',9,-79);
 ballot:=public.voting_ballot((entry->>'token')::uuid,9,-79);
 insert into qa_catalog_checks values('future ballot uses new reference photo',ballot->'candidates'->0->>'photo_url'='qa-catalog/new.png');
 perform set_config('request.jwt.claim.sub',adm::text,true);
 insert into qa_catalog_checks values('historical results unchanged by new version',old_results=(select jsonb_agg(to_jsonb(r)) from public.voting_admin_results(rnd) r));
 insert into qa_catalog_checks values('anonymous cannot execute coverage endpoint',not has_function_privilege('anon','public.voting_admin_member_coverage()','execute'));
 if exists(select 1 from qa_catalog_checks where passed is distinct from true) then
  raise exception 'QA catalog failure: %',(select string_agg(name,', ') from qa_catalog_checks where passed is distinct from true);
 end if;
end $$;
select count(*) checks,bool_and(passed) all_passed,jsonb_agg(name) verified from qa_catalog_checks;
rollback;

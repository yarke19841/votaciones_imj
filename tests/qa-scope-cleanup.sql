-- QA ONLY. Exact reserved synthetic fixture; retain audit and disabled Auth accounts.
begin;
do $$ begin
 if exists(select 1 from public.voting_rounds where status in ('open','checkin')) then raise exception 'Active round: stop'; end if;
 if exists(select 1 from public.voting_elections where id='662a785b-51cf-4357-80da-b0b366792504' and title<>'QA staff HTTP 20261014') then raise exception 'Election identity mismatch'; end if;
 if exists(select 1 from public.people where id between -14101404 and -14101401 and full_name not like 'QA scope %') then raise exception 'Person identity mismatch'; end if;
 if exists(select 1 from voting_private.participation p join public.voting_rounds r on r.id=p.round_id where r.election_id='662a785b-51cf-4357-80da-b0b366792504') then raise exception 'Unexpected participation'; end if;
end $$;
update public.profiles set is_active=false where user_id in
 ('a141e010-2026-4014-8000-000000000001','a141e010-2026-4014-8000-000000000002','a141e010-2026-4014-8000-000000000003');
update auth.users set banned_until='2099-01-01' where id in
 ('a141e010-2026-4014-8000-000000000001','a141e010-2026-4014-8000-000000000002','a141e010-2026-4014-8000-000000000003')
 and email like 'qa-voting-20261014-%@example.invalid';
delete from voting_private.eligibility where election_id='662a785b-51cf-4357-80da-b0b366792504';
delete from voting_private.identity_people where person_id between -14101404 and -14101401;
delete from voting_private.identities where person_id between -14101404 and -14101401;
delete from public.voting_round_candidates where round_id in
 (select id from public.voting_rounds where election_id='662a785b-51cf-4357-80da-b0b366792504');
delete from public.voting_rounds where election_id='662a785b-51cf-4357-80da-b0b366792504';
delete from public.voting_candidates where id in
 ('77816056-f06f-4d2f-8274-80d15ee51a03','634c4ff9-b16f-435e-b97c-3dba623b4cbf') and full_name like 'QA staff HTTP 20261014%';
delete from public.voting_elections where id='662a785b-51cf-4357-80da-b0b366792504' and title='QA staff HTTP 20261014';
delete from public.memberships where person_id between -14101404 and -14101401 and group_id between -14101404 and -14101401;
delete from public.pastor_territories where pastor_user_id='a141e010-2026-4014-8000-000000000003' and territory_id between -14101403 and -14101401;
delete from public.groups where id between -14101404 and -14101401 and name like 'QA scope %';
delete from public.people where id between -14101404 and -14101401 and full_name like 'QA scope %';
delete from public.territories where id between -14101403 and -14101401 and code like 'QA-SCOPE-20261014-%';
commit;
select 'scope cleanup complete; audit retained' as result;

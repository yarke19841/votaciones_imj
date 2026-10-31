-- QA only. Substitute __QA_PASSWORD__ in memory. Never commit a real password.
-- Reuses the two disposable staff accounts and the prior election fixture.
begin;
do $$ begin
 if exists(select 1 from public.voting_rounds where status in ('open','checkin')) then raise exception 'Active round: stop'; end if;
 if exists(select 1 from public.territories where id between -14101403 and -14101401)
 or exists(select 1 from public.people where id between -14101404 and -14101401)
 or exists(select 1 from public.groups where id between -14101404 and -14101401)
 then raise exception 'Fixture IDs occupied: reconcile before retry'; end if;
 if not exists(select 1 from public.voting_elections where id='662a785b-51cf-4357-80da-b0b366792504' and title='QA staff HTTP 20261014') then raise exception 'Expected QA election missing'; end if;
end $$;
insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,
 raw_app_meta_data,raw_user_meta_data,created_at,updated_at,confirmation_token,
 recovery_token,email_change_token_new,email_change,email_change_token_current,
 reauthentication_token,is_sso_user,is_anonymous)
values('00000000-0000-0000-0000-000000000000','a141e010-2026-4014-8000-000000000003',
 'authenticated','authenticated','qa-voting-20261014-pastor@example.invalid',
 extensions.crypt('__QA_PASSWORD__',extensions.gen_salt('bf')),now(),
 '{"provider":"email","providers":["email"]}','{"full_name":"QA disposable voting pastor"}',
 now(),now(),'','','','','','',false,false);
insert into auth.identities(id,user_id,provider_id,identity_data,provider,created_at,updated_at)
select gen_random_uuid(),id,id::text,jsonb_build_object('sub',id::text,'email',email,'email_verified',true),
 'email',now(),now() from auth.users where id='a141e010-2026-4014-8000-000000000003';
update auth.users set encrypted_password=extensions.crypt('__QA_PASSWORD__',extensions.gen_salt('bf')), banned_until=null
 where id in ('a141e010-2026-4014-8000-000000000001','a141e010-2026-4014-8000-000000000002');
update public.profiles set role=case user_id
 when 'a141e010-2026-4014-8000-000000000001'::uuid then 'admin'
 when 'a141e010-2026-4014-8000-000000000002'::uuid then 'leader' else 'pastor' end,is_active=true
 where user_id in ('a141e010-2026-4014-8000-000000000001','a141e010-2026-4014-8000-000000000002','a141e010-2026-4014-8000-000000000003');
insert into public.territories(id,name,code,active,is_active) values
 (-14101401,'QA scope A','QA-SCOPE-20261014-A',true,true),
 (-14101402,'QA scope B','QA-SCOPE-20261014-B',true,true),
 (-14101403,'QA scope inactive','QA-SCOPE-20261014-C',true,false);
insert into public.groups(id,name,leader_user_id,territory_id,active) values
 (-14101401,'QA scope own list','a141e010-2026-4014-8000-000000000002',-14101401,true),
 (-14101402,'QA scope other list same territory',null,-14101401,true),
 (-14101403,'QA scope other territory',null,-14101402,true),
 (-14101404,'QA scope inactive territory',null,-14101403,true);
insert into public.people(id,full_name) values
 (-14101401,'QA scope own'),(-14101402,'QA scope same territory'),
 (-14101403,'QA scope outside'),(-14101404,'QA scope inactive');
insert into public.memberships(group_id,person_id,is_member) values
 (-14101401,-14101401,true),(-14101402,-14101402,true),
 (-14101403,-14101403,true),(-14101404,-14101404,true);
insert into public.pastor_territories(pastor_user_id,territory_id) values
 ('a141e010-2026-4014-8000-000000000003',-14101401),
 ('a141e010-2026-4014-8000-000000000003',-14101403);
commit;
select 'scope fixture ready' as result;

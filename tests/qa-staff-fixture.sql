-- QA ONLY. Render __QA_PASSWORD__ in memory; never persist credentials.
-- These two IDs and emails are reserved for this disposable HTTP test.
begin;
do $$ begin
 if exists(select 1 from auth.users where id in
 ('a141e010-2026-4014-8000-000000000001','a141e010-2026-4014-8000-000000000002')
 or email like 'qa-voting-20261014-%@example.invalid') then
   raise exception 'QA fixture already exists; reconcile before retry';
 end if;
 if exists(select 1 from public.voting_rounds where status='open') then
   raise exception 'QA has an active round; do not interfere';
 end if;
end $$;
insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,
 raw_app_meta_data,raw_user_meta_data,created_at,updated_at,confirmation_token,
 recovery_token,email_change_token_new,email_change,email_change_token_current,
 reauthentication_token,is_sso_user,is_anonymous)
select '00000000-0000-0000-0000-000000000000',id::uuid,'authenticated','authenticated',email,
 extensions.crypt('__QA_PASSWORD__',extensions.gen_salt('bf')),now(),
 '{"provider":"email","providers":["email"]}'::jsonb,
 jsonb_build_object('full_name','QA disposable voting HTTP'),now(),now(),'','','','','','',false,false
from (values
 ('a141e010-2026-4014-8000-000000000001','qa-voting-20261014-admin@example.invalid'),
 ('a141e010-2026-4014-8000-000000000002','qa-voting-20261014-leader@example.invalid')) x(id,email);
insert into auth.identities(id,user_id,provider_id,identity_data,provider,created_at,updated_at)
select gen_random_uuid(),id,id::text,jsonb_build_object('sub',id::text,'email',email,'email_verified',true),
 'email',now(),now() from auth.users
where id in ('a141e010-2026-4014-8000-000000000001','a141e010-2026-4014-8000-000000000002');
update public.profiles set role=case user_id
 when 'a141e010-2026-4014-8000-000000000001'::uuid then 'admin' else 'leader' end,
 is_active=true where user_id in
 ('a141e010-2026-4014-8000-000000000001','a141e010-2026-4014-8000-000000000002');
commit;
select count(*) fixture_profiles from public.profiles where user_id in
 ('a141e010-2026-4014-8000-000000000001','a141e010-2026-4014-8000-000000000002');

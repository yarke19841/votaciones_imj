import { PGlite } from '@electric-sql/pglite'
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto'
import { readFile, readdir } from 'node:fs/promises'
import assert from 'node:assert/strict'
const db = new PGlite({ extensions: { pgcrypto } })
const q = async (sql, args = []) => (await db.query(sql, args)).rows
const scalar = async (sql, args = []) => Object.values((await q(sql, args))[0])[0]
const uid = n => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`
const actor = async (n = 1, role = 'authenticated') => {
  await db.exec('reset role'); await q("select set_config('request.jwt.claim.sub',$1,false)", [n ? uid(n) : ''])
  if (role) await db.exec(`set role ${role}`)
}
let count = 0
const check = (name, value) => { assert.ok(value, name); console.log(`ok ${++count} - ${name}`) }
const denied = async (name, fn) => { await assert.rejects(fn); check(name, true) }
try {
  await db.exec(await readFile(new URL('./bethel-fixture.sql', import.meta.url), 'utf8'))
  // Reproduce the dangerous hosted permissions, never real church records.
  for (const table of ['candidate', 'cast_vote', 'election', 'election_member', 'attendance_voter']) {
    await db.exec(`create table public.${table}(id uuid primary key default gen_random_uuid(), payload text); insert into public.${table}(payload) values('private fixture')`)
  }
  await db.exec("insert into public.member(full_name,cedula,is_active) values('Private fixture','LEGACY-001',true)")
  for (const table of ['member', 'candidate', 'cast_vote', 'election', 'election_member', 'attendance_voter']) {
    await db.exec(`alter table public.${table} enable row level security; grant all on public.${table} to anon,authenticated; create policy legacy_allow_all on public.${table} for all to public using(true) with check(true)`)
  }
  await db.exec(`create function public.admin_set_active_pool(p_election_id uuid,p_target_pool text)
    returns text language plpgsql security definer set search_path=public as $fn$
begin
 update election set payload=p_target_pool where id=p_election_id;
 return 'updated';
end;
$fn$;
create function public.admin_setup_tie_round_with_attendance(p_source_election_id uuid,p_gender text,p_remaining_slots integer,p_tied_candidate_ids uuid[],p_pool text default 'oficial',p_status text default 'borrador',p_copy_checked_in boolean default false)
returns text language plpgsql security definer as $fn$
begin
 insert into candidate(payload) values(p_pool);
 return 'created';
end;
$fn$;
grant execute on function public.admin_set_active_pool(uuid,text),public.admin_setup_tie_round_with_attendance(uuid,text,integer,uuid[],text,text,boolean) to anon,authenticated;
insert into storage.buckets(id,name,public) values('candidate-photo','candidate-photo',true);
insert into storage.objects(bucket_id,name) values('candidate-photo','fixture.png');
create policy legacy_photo_all on storage.objects for all to public using(bucket_id='candidate-photo') with check(bucket_id='candidate-photo');
grant insert,update,delete on storage.objects to anon;
create schema app_security;
create function app_security.is_active_bethel_user() returns boolean language sql stable security definer set search_path='' as 'select exists(select 1 from public.profiles where user_id=auth.uid() and is_active)';
create function app_security.is_active_calendar_user() returns boolean language sql stable security definer set search_path='' as 'select app_security.is_active_bethel_user()';
grant usage on schema app_security to authenticated;
grant execute on all functions in schema app_security to authenticated;`)
  for (const table of ['absence_reasons', 'church_attendance_settings', 'ministries', 'calendar_rules', 'event_rules']) {
    await db.exec(`create table public.${table}(id int); insert into public.${table} values(1); alter table public.${table} enable row level security; grant select on public.${table} to authenticated; create policy signed_in on public.${table} for select to authenticated using(true)`)
  }
  const dir = new URL('../supabase/migrations/', import.meta.url)
  for (const f of (await readdir(dir)).filter(f => f.endsWith('.sql')).sort()) await db.exec(await readFile(new URL(f, dir), 'utf8'))
  await q('insert into auth.users(id,email) values($1,$2)', [uid(9), 'results@example.test'])
  await q("insert into public.profiles(user_id,role,is_active) values($1,'leader',false)", [uid(9)])
  await q('insert into voting_private.results_readers(user_id) values($1)', [uid(9)])
  for (const [n, role] of [[null, 'anon'], [9, 'authenticated'], [2, 'authenticated']]) {
    await actor(n, role)
    for (const table of ['member', 'candidate', 'cast_vote', 'election', 'election_member', 'attendance_voter']) {
      if (role === 'anon') await denied(`anon cannot read ${table}`, () => q(`select * from public.${table}`))
      else check(`${n === 9 ? 'reader' : 'leader'} cannot read ${table}`, (await q(`select * from public.${table}`)).length === 0)
    }
    await denied(`${role}/${n} cannot call legacy state changer`, () => q('select public.admin_set_active_pool($1,$2)', [uid(99), 'changed']))
    await denied(`${role}/${n} cannot create legacy tie`, () => q('select public.admin_setup_tie_round_with_attendance($1,$2,$3,$4)', [uid(99), 'M', 1, []]))
    check(`${role}/${n} cannot read legacy photos`, (await q("select * from storage.objects where bucket_id='candidate-photo'")).length === 0)
    await denied(`${role}/${n} cannot insert legacy photos`, () => q("insert into storage.objects(bucket_id,name) values('candidate-photo','attack.png')"))
  }
  await actor(9)
  for (const table of ['absence_reasons', 'church_attendance_settings', 'ministries', 'calendar_rules', 'event_rules']) check(`results-only cannot read ${table}`, (await q(`select * from public.${table}`)).length === 0)
  check('results-only permission remains available', await scalar('select public.voting_results_access()'))
  await actor()
  check('administrator still reads legacy members', (await q('select * from public.member')).length === 1)
  check('administrator still reads legacy photos', (await q("select * from storage.objects where bucket_id='candidate-photo'")).length === 1)
  check('administrator can call guarded legacy state changer', await scalar('select public.admin_set_active_pool($1,$2)', [uid(99), 'changed']) === 'updated')
  check('administrator can call guarded legacy tie creator', await scalar('select public.admin_setup_tie_round_with_attendance($1,$2,$3,$4)', [uid(99), 'M', 1, []]) === 'created')
  await actor(null, null)
  check('legacy photo bucket is private', await scalar("select not public from storage.buckets where id='candidate-photo'"))
  check('new voting bucket stays private', await scalar("select not public from storage.buckets where id='voting-photos'"))
  check('legacy functions have a fixed empty search path', (await q("select proconfig from pg_proc where proname in('admin_set_active_pool','admin_setup_tie_round_with_attendance')")).every(x => x.proconfig.includes('search_path=""')))
  check('legacy member data is preserved', await scalar('select count(*)::int from public.member') === 1)
  console.log(`PASS ${count} legacy security checks`)
} catch (error) { console.error(error.message); process.exitCode = 1 }
finally { await db.close() }

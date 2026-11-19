import { PGlite } from '@electric-sql/pglite'
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto'
import { readFile, readdir } from 'node:fs/promises'
import assert from 'node:assert/strict'
const db = new PGlite({ extensions: { pgcrypto } })
const q = async (sql, args = []) => (await db.query(sql, args)).rows
const scalar = async (sql, args = []) => Object.values((await q(sql, args))[0])[0]
const rpc = (name, args = []) => scalar(`select public.${name}(${args.map((_, i) => `$${i + 1}`).join(',')})`, args)
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
  const dir = new URL('../supabase/migrations/', import.meta.url)
  for (const f of (await readdir(dir)).filter(f => f.endsWith('.sql')).sort()) await db.exec(await readFile(new URL(f, dir), 'utf8'))
  await q('insert into auth.users(id,email) values($1,$2)', [uid(9), 'results@example.test'])
  // Bethel profile is disabled; this separate permission grants only voting results.
  await q("insert into public.profiles(user_id,role,is_active) values($1,'leader',false)", [uid(9)])
  await q('insert into voting_private.results_readers(user_id) values($1)', [uid(9)])
  await actor()
  const e = await rpc('voting_admin_save_election', [null, 2091, 'DEMO results', 1, 0, null, null, 400])
  const c = await rpc('voting_admin_save_candidate', [null, e, 'Ficticio', 'M', null, false, true])
  const r = await rpc('voting_admin_save_round', [null, e, 'official', 1, 'new', 1, 0, [c]])
  await rpc('voting_enable_person', [e, 1, 'RESULTS-001', true])
  await actor(9)
  check('dedicated reader has access', await rpc('voting_results_access'))
  check('draft elections and rounds stay hidden', (await rpc('voting_results_snapshot')).rounds.length === 0)
  await denied('reader cannot inspect draft results by id', () => rpc('voting_results_read', [r]))
  await denied('reader cannot read admin snapshot', () => rpc('voting_admin_snapshot'))
  await denied('reader cannot read staff snapshot', () => rpc('voting_staff_snapshot'))
  await denied('reader cannot open a round', () => rpc('voting_admin_open_round', [r]))
  await denied('reader cannot start checkin', () => rpc('voting_admin_start_checkin', [r]))
  await denied('reader cannot close a round', () => rpc('voting_admin_close_active'))
  await denied('reader cannot configure elections', () => rpc('voting_admin_save_election', [null, 2090, 'Unauthorized', 1, 0, null, null, 400]))
  await denied('reader cannot edit candidates', () => rpc('voting_admin_save_candidate', [c, e, 'Altered', 'M', null, false, true]))
  await denied('reader cannot enable a voter', () => rpc('voting_enable_person', [e, 1, 'RESULTS-001', true]))
  await denied('reader cannot change quorum', () => rpc('voting_admin_set_quorum', [e, 50]))
  await denied('reader cannot assign staff', () => rpc('voting_admin_registration_staff', [e, uid(9), true]))
  check('reader sees no registration election', (await rpc('voting_registration_access')).elections.length === 0)
  await denied('reader cannot read voter identities', () => q('select * from public.voting_staff_roster($1)', [e]))
  await denied('reader cannot read direct tallies', () => q('select * from public.voting_tallies'))
  await denied('reader cannot grant own permission', () => q('update voting_private.results_readers set enabled=true'))
  await denied('reader cannot read private participation', () => q('select * from voting_private.participation'))
  await actor(); await rpc('voting_admin_start_checkin', [r]); await rpc('voting_admin_open_round', [r])
  await actor(9); await denied('reader cannot view live totals', () => rpc('voting_results_read', [r]))
  check('open round remains absent from selector', (await rpc('voting_results_snapshot')).rounds.length === 0)
  await actor(null, 'anon')
  const enter = await rpc('voting_enter', ['RESULTS-001', 9.03782, -79.46696])
  check('fixture ballot accepted', (await rpc('voting_submit', [enter.token, [c], 9.03782, -79.46696])).state === 'accepted')
  await actor(); await rpc('voting_admin_close_active')
  await actor(9)
  const snapshot = await rpc('voting_results_snapshot'), detail = await rpc('voting_results_read', [r])
  check('closed round appears with its election', snapshot.rounds.length === 1 && snapshot.elections[0].id === e)
  check('snapshot contains no location, roster or candidates', Object.keys(snapshot.elections[0]).sort().join(',') === 'election_year,id,title' && !('candidates' in snapshot))
  check('reader sees accurate aggregate vote count', detail.rows[0].candidate_id === c && detail.rows[0].vote_count === 1)
  check('round voter total is accurate', detail.round.voter_count === 1)
  check('results contain no identities or individual choices', Object.keys(detail.rows[0]).sort().join(',') === 'candidate_id,full_name,gender,vote_count' && !JSON.stringify(detail).includes('RESULTS-001'))
  await denied('unknown round denied', () => rpc('voting_results_read', [uid(99)]))
  await actor(2); check('leader gets no results access', !(await rpc('voting_results_access')))
  await denied('leader cannot read results', () => rpc('voting_results_read', [r]))
  await actor(3); await denied('pastor cannot read results', () => rpc('voting_results_snapshot'))
  await actor(null, 'anon'); await denied('anon cannot discover access', () => rpc('voting_results_access'))
  await denied('anon cannot read snapshot', () => rpc('voting_results_snapshot'))
  await denied('anon cannot read results', () => rpc('voting_results_read', [r]))
  await actor(null, null); await q('update voting_private.results_readers set enabled=false where user_id=$1', [uid(9)])
  await actor(9); check('revocation applies to existing identity', !(await rpc('voting_results_access')))
  await denied('revocation immediately blocks snapshot', () => rpc('voting_results_snapshot'))
  await denied('revocation immediately blocks results', () => rpc('voting_results_read', [r]))
  await actor(); check('existing administrator still has results access', await rpc('voting_results_access'))
  check('administrator sees same aggregate results', (await rpc('voting_results_read', [r])).rows[0].vote_count === 1)
  await actor(null, null)
  check('read APIs leave vote and participation unchanged', await scalar('select count(*)::int from voting_private.participation where round_id=$1', [r]) === 1)
  console.log(`PASS ${count} results-reader contract checks`)
} catch (error) { console.error(error.message); process.exitCode = 1 }
finally { await db.close() }

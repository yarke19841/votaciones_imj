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
  await q("insert into public.member(full_name,cedula,is_active) values('Persona del padrón','ROSTER-001',true),('Segunda persona','ROSTER-002',true),('Inactiva','ROSTER-003',false)")
  const source = await q('select id::text,cedula from public.member order by cedula')
  await actor()
  const before = await rpc('voting_admin_existing_roster', [null])
  check('existing list is available without a new election', before.length === 3)
  check('source activity preserved', before.filter(x => x.active).length === 2)
  check('reading the list never enables a voter', before.every(x => !x.enabled))
  check('only masked document returned', before.every(x => !('cedula' in x) && x.cedula_last4.length === 4))
  const e = await rpc('voting_admin_save_election', [null, 2092, 'DEMO common roster', 1, 0, null, null, 400])
  const enable = (index = 0, enabled = true, doc = source[index].cedula) => rpc('voting_admin_enable_existing_member', [e, source[index].id, doc, enabled])
  await denied('wrong verified document rejected', () => enable(0, true, 'ROSTER-WRONG'))
  await denied('inactive member cannot be enabled', () => enable(2))
  await denied('unknown source ID rejected', () => rpc('voting_admin_enable_existing_member', [e, 'unknown', 'ROSTER-001', true]))
  await actor(null, null)
  check('reads and failed attempts leave people unchanged', await scalar('select count(*)::int from public.people') === 6)
  check('reads and failed attempts leave eligibility empty', await scalar('select count(*)::int from voting_private.eligibility') === 0)
  await actor(); await enable(); await enable(0, true, 'roster 001')
  check('one shared source entry enabled', (await rpc('voting_admin_existing_roster', [e])).filter(x => x.enabled).length === 1)
  await actor(null, null)
  check('repeating normalized document creates one identity', await scalar('select count(*)::int from voting_private.identities') === 1)
  check('repeated enable creates one canonical person', await scalar('select count(*)::int from public.people') === 7)
  check('linking invents no church memberships', await scalar('select count(*)::int from public.memberships') === 9)
  await actor(); await rpc('voting_enable_person', [e, 2, 'ROSTER-002', true]); await enable(1)
  await actor(null, null)
  check('existing electoral identity reused by document', await scalar('select count(*)::int from public.people') === 7)
  check('master list is neither duplicated nor overwritten', await scalar('select count(*)::int from public.member') === 3)
  const practiceCandidate = await (async () => { await actor(); return rpc('voting_admin_save_candidate', [null, null, 'Candidato ficticio', 'M', null, true, true]) })()
  const officialCandidate = await rpc('voting_admin_save_candidate', [null, e, 'Candidato ficticio', 'M', null, false, true])
  const practice = await rpc('voting_admin_save_round', [null, e, 'practice', 1, 'new', 1, 0, [practiceCandidate]])
  const official = await rpc('voting_admin_save_round', [null, e, 'official', 1, 'new', 1, 0, [officialCandidate]])
  for (const [round, candidate, kind] of [[practice, practiceCandidate, 'practice'], [official, officialCandidate, 'official']]) {
    await actor(); await rpc('voting_admin_start_checkin', [round]); await rpc('voting_admin_open_round', [round])
    await actor(null, 'anon')
    const entry = await rpc('voting_enter', ['ROSTER-001', 9.03782, -79.46696])
    check(`same enabled member enters ${kind}`, entry.state === 'ready')
    check(`member emits one ${kind} vote`, (await rpc('voting_submit', [entry.token, [candidate], 9.03782, -79.46696])).state === 'accepted')
    check(`second ${kind} vote blocked`, (await rpc('voting_enter', ['ROSTER-001', 9.03782, -79.46696])).state === 'already_voted')
    await actor(); await rpc('voting_admin_close_active')
  }
  await actor(null, null)
  check('attendance is separate by round', await scalar('select count(*)::int from voting_private.attendance') === 2)
  check('participation is separate by round', await scalar('select count(*)::int from voting_private.participation') === 2)
  await actor(); await enable(0, false)
  check('one revocation updates common election eligibility', !(await rpc('voting_admin_existing_roster', [e])).find(x => x.member_id === source[0].id).enabled)
  const e2 = await rpc('voting_admin_save_election', [null, 2090, 'Another election', 1, 0, null, null, 400])
  check('another election requires its own authorization', (await rpc('voting_admin_existing_roster', [e2])).every(x => !x.enabled))
  await enable(0, true)
  await actor(null, null); await q("update public.member set cedula='CHANGED-001' where id::text=$1", [source[0].id])
  await actor(); const changed = (await rpc('voting_admin_existing_roster', [e])).find(x => x.member_id === source[0].id)
  check('changed source document flagged for review', changed.needs_review)
  check('historical enabled identity is still shown after document change', changed.enabled)
  await denied('source document change cannot silently reassign identity', () => enable(0, true, 'CHANGED-001'))
  await enable(0, false, 'CHANGED-001')
  check('administrator can revoke historical identity pending review', !(await rpc('voting_admin_existing_roster', [e])).find(x => x.member_id === source[0].id).enabled)
  await actor(null, null)
  check('revocation changes original identity instead of creating a replacement', await scalar('select count(*)::int from voting_private.identities') === 2)
  check('revocation preserves both rounds participation', await scalar('select count(*)::int from voting_private.participation') === 2)
  await q('update public.member set cedula=null where id::text=$1', [source[0].id])
  await actor(); await denied('null source document cannot authorize a supplied document', () => enable(0, true, 'ROSTER-001'))
  for (const [n, role] of [[2, 'authenticated'], [3, 'authenticated'], [null, 'anon']]) {
    await actor(n, role)
    await denied(`${role}/${n} cannot read master roster`, () => rpc('voting_admin_existing_roster', [e]))
    await denied(`${role}/${n} cannot enable source member`, () => enable(1))
  }
  await actor(null, null); await q('insert into auth.users(id) values($1)', [uid(9)])
  await q('insert into voting_private.results_readers(user_id) values($1)', [uid(9)])
  await actor(9)
  await denied('results-only cannot read source roster', () => rpc('voting_admin_existing_roster', [e]))
  await denied('results-only cannot alter eligibility', () => enable(1))
  await denied('results-only cannot read source identity links', () => q('select * from voting_private.existing_roster_links'))
  console.log(`PASS ${count} existing-roster checks`)
} catch (error) { console.error(error.message); process.exitCode = 1 }
finally { await db.close() }

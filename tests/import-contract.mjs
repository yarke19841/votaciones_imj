import { PGlite } from '@electric-sql/pglite'
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto'
import { readFile, readdir } from 'node:fs/promises'
import assert from 'node:assert/strict'
const db = new PGlite({ extensions: { pgcrypto } })
let count = 0
const check = (name, condition) => { assert.ok(condition, name); console.log(`ok ${++count} - ${name}`) }
const scalar = async (sql, params = []) => Object.values((await db.query(sql, params)).rows[0])[0]
const inspect = async sql => { await db.exec('reset role'); const value = await scalar(sql); await db.exec('set role authenticated'); return value }
const actor = async id => { await db.exec('reset role'); await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id ? `00000000-0000-0000-0000-${String(id).padStart(12, '0')}` : '']); await db.exec(`set role ${id ? 'authenticated' : 'anon'}`) }
const rejected = async (name, fn) => { let error; try { await fn() } catch(e) { error = e } check(name, !!error) }
const csv = [{ full_name: 'Importada Ficticia', cedula: 'IMPORT-12345' }]
const load = (territory = 1, rows = csv) => scalar('select public.voting_admin_import_members($1,$2)', [territory, JSON.stringify(rows)])
try {
 await db.exec(await readFile(new URL('./bethel-fixture.sql',import.meta.url),'utf8'))
 await db.exec("alter table public.territories add column name text; update public.territories set name='Territorio '||id; insert into public.territories(id,is_active,active,name) values(3,true,true,'Territorio C')")
 const dir = new URL('../supabase/migrations/',import.meta.url)
 for (const f of (await readdir(dir)).filter(f => f.endsWith('.sql')).sort()) await db.exec(await readFile(new URL(f,dir),'utf8'))
 await db.exec("update voting_private.church_location set latitude=9,longitude=-79 where church_key='imj'")
 await actor(null); await rejected('anonymous cannot import', () => load())
 await actor(2); await rejected('leader cannot import', () => load())
 await actor(3); await rejected('pastor cannot import', () => load())
 await actor(1); await rejected('inactive territory rejected', () => load(2))
 check('first import creates one territorial record', (await load()).created === 1)
 check('repeat is idempotent', (await load()).created === 0)
 const e = await scalar("select public.voting_admin_save_election(null,2097,'DEMO import',1,0,9,-79,100)")
 let roster = await scalar('select public.voting_staff_roster($1)', [e])
 const imported = roster.find(p => p.full_name === 'Importada Ficticia')
 check('imported person is visible but not enabled', imported && !imported.enabled && imported.groups.some(g => g.id === 'territory-1'))
 check('no eligibility silently created', await inspect('select count(*)::int from voting_private.eligibility') === 0)
 check('same cedula in another territory creates separate person', (await load(3)).created === 1)
 check('one electoral identity across territories', await inspect('select count(*)::int from voting_private.identities') === 1)
 check('coverage deduplicates imported identities', (await scalar('select public.voting_admin_member_coverage()')).identified_members === 1)
 await rejected('different name with existing territorial identity rejected', () => load(1,[{full_name:'Otro Nombre',cedula:'IMPORT12345'}]))
 const before = await inspect('select count(*)::int from public.people')
 await rejected('invalid batch rolls back all rows', () => load(1,[{full_name:'Nueva Valida',cedula:'AAA12345'},{full_name:'X',cedula:'ZZZ12345'}]))
 check('invalid batch left no people', await inspect('select count(*)::int from public.people') === before)
 await actor(2); roster = await scalar('select public.voting_staff_roster($1)',[e]); check('leader cannot see imported territorial-only member',!roster.some(p => p.full_name==='Importada Ficticia'))
 await actor(3); roster = await scalar('select public.voting_staff_roster($1)',[e]); check('assigned pastor sees own territory only',roster.filter(p => p.full_name==='Importada Ficticia').length===1)
 await rejected('private mapping inaccessible directly',()=>db.query('select * from voting_private.territorial_members'))
 await actor(1); await scalar('select public.voting_enable_person($1,$2,$3,true)',[e,imported.person_id,'IMPORT12345'])
 const c = await scalar("select public.voting_admin_save_candidate(null,$1,'Candidato','M',null,false,true)",[e])
 const r = await scalar("select public.voting_admin_save_round(null,$1,'official',1,'new',1,0,$2)",[e,[c]])
 await scalar('select public.voting_admin_start_checkin($1)',[r])
 await actor(null); await scalar("select public.voting_enter('IMPORT12345',9,-79)")
 check('missing GPS without exception is denied',(await scalar("select public.voting_enter('IMPORT12345',null,null)")).state==='location_denied')
 await actor(1)
 await scalar("select public.voting_admin_set_exception($1,$2,now()-interval '1 minute',now()+interval '1 hour','DEMO approved exception')",[r,imported.person_id])
 await actor(null)
 check('approved exception permits null GPS after valid attendance',(await scalar("select public.voting_enter('IMPORT12345',null,null)")).state==='waiting')
 await actor(1); const snap=await scalar('select public.voting_admin_snapshot()')
 check('snapshot counts imported member attendance',snap.rounds.find(x=>x.id===r).member_attendance_count===1)
 console.log(`PASS ${count} import contract checks`)
} finally { await db.close() }

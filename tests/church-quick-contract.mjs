import { PGlite } from '@electric-sql/pglite'
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto'
import { readFile, readdir } from 'node:fs/promises'
import assert from 'node:assert/strict'
const db = new PGlite({ extensions: { pgcrypto } })
const q = async (sql, args=[]) => (await db.query(sql,args)).rows
const scalar = async (sql,args=[]) => Object.values((await q(sql,args))[0])[0]
const rpc = (name,args=[]) => scalar(`select public.${name}(${args.map((_,i)=>`$${i+1}`).join(',')})`,args)
const actor = async (id=1,role='authenticated') => { await db.exec('reset role'); await q("select set_config('request.jwt.claim.sub',$1,false)",[id ? `00000000-0000-0000-0000-${String(id).padStart(12,'0')}` : '']); if(role) await db.exec(`set role ${role}`) }
let count=0
const check = (name,value) => { assert.ok(value,name); console.log(`ok ${++count} - ${name}`) }
const denied = async (name,fn,pattern) => { await assert.rejects(fn,pattern); check(name,true) }
try {
 await db.exec(await readFile(new URL('./bethel-fixture.sql',import.meta.url),'utf8'))
 const dir=new URL('../supabase/migrations/',import.meta.url)
 for(const f of (await readdir(dir)).filter(f=>f.endsWith('.sql')).sort()) await db.exec(await readFile(new URL(f,dir),'utf8'))
 await actor()
 const location=await rpc('voting_admin_church_location')
 check('approved IMJ church coordinates persisted once',location.latitude===9.03782 && location.longitude===-79.46696)
 const e=await rpc('voting_admin_save_election',[null,2096,'DEMO isolated attendance',1,0,null,null,400])
 await actor(null,null)
 let row=(await q('select * from public.voting_elections where id=$1',[e]))[0]
 check('new election inherits church point with no coordinate entry',row.church_latitude===location.latitude && row.church_longitude===location.longitude)
 await actor()
 await rpc('voting_admin_save_election',[e,2096,'DEMO isolated attendance',1,0,1,1,450])
 await actor(null,null); row=(await q('select * from public.voting_elections where id=$1',[e]))[0]
 check('alternate coordinates cannot move church; radius remains configurable',row.church_latitude===location.latitude && row.radius_meters===450)
 await actor()
 const c=await rpc('voting_admin_save_candidate',[null,e,'Candidato prueba','M',null,false,true])
 const r=await rpc('voting_admin_save_round',[null,e,'official',1,'new',1,0,[c]])
 await rpc('voting_enable_person',[e,1,'QA-QUICK-001',false])
 const day=await scalar("select (now() at time zone 'America/Panama')::date::text")
 const mark=(doc='QA-QUICK-001',date=day,lat=location.latitude,lon=location.longitude) => rpc('voting_admin_quick_attend',[r,doc,date,lat,lon])
 const lookup=(doc='QA-QUICK-001') => rpc('voting_admin_quick_lookup',[r,doc,day])
 await denied('draft round cannot register arrivals',()=>mark(),/Inicia el ingreso/)
 await rpc('voting_admin_start_checkin',[r])
 await actor(2); await denied('leader cannot lookup church-wide identity',()=>lookup(),/Solo Administración/)
 await denied('leader cannot mark assisted attendance',()=>mark(),/Solo Administración/)
 await actor(null,'anon'); await denied('anonymous cannot lookup identity',()=>lookup(),/permission/)
 await actor()
 await denied('unknown cedula never creates member',()=>mark('NOT-EXISTS-12345'),/no registrada/)
 await denied('historical attendance cannot be fabricated',()=>mark('QA-QUICK-001','2000-01-01'),/día actual/)
 await denied('GPS missing does not mark attendance',()=>mark('QA-QUICK-001',day,null,null),/ubicación actual/)
 await denied('GPS outside church does not mark attendance',()=>mark('QA-QUICK-001',day,0,0),/fuera del límite/)
 check('partial document is not a lookup wildcard',(await lookup('QUICK')).person===null)
 check('first assisted arrival saved',!(await mark()).already_attended)
 check('repeat is idempotent',(await mark()).already_attended)
 const result=await lookup('qa quick 001')
 check('normalized exact cedula locates existing identity',result.person.full_name==='Uno')
 check('attendance does not automatically enable vote',result.person.attended && !result.person.enabled)
 check('incomplete member coverage does not invent a denominator',!result.coverage.complete && result.coverage.total_members===null)
 check('present count uses members independent of eligibility',result.member_present===1)
 await actor(null,null)
 check('member count unchanged',await scalar('select count(*)::int from public.people')===6)
 check('one audited assisted record',await scalar("select count(*)::int from voting_private.audit_log where action='quick_attend'")===1)
 check('assisted origin distinguished from voter GPS',await scalar('select source from voting_private.attendance where round_id=$1',[r])==='assisted')
 check('no participation before voter sends a ballot',await scalar('select count(*)::int from voting_private.participation')===0)
 await actor(); await rpc('voting_admin_open_round',[r]); await rpc('voting_admin_close_active')
 await denied('closed round cannot receive new assisted attendance',()=>mark(),/Inicia el ingreso/)
 await actor(null,'anon')
 await denied('private settings cannot be read anonymously',()=>q('select * from voting_private.church_location'),/permission/)
 console.log(`PASS ${count} church/quick attendance checks`)
} finally { await db.close() }

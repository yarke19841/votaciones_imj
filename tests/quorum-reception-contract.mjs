import {PGlite} from '@electric-sql/pglite'
import {pgcrypto} from '@electric-sql/pglite/contrib/pgcrypto'
import {readFile,readdir} from 'node:fs/promises'
import assert from 'node:assert/strict'
const db=new PGlite({extensions:{pgcrypto}})
const q=async(sql,args=[]) => (await db.query(sql,args)).rows
const scalar=async(sql,args=[]) => Object.values((await q(sql,args))[0])[0]
const rpc=(name,args=[])=>scalar(`select public.${name}(${args.map((_,i)=>`$${i+1}`).join(',')})`,args)
const uid=n=>`00000000-0000-0000-0000-${String(n).padStart(12,'0')}`
const actor=async(n=1,role='authenticated')=>{await db.exec('reset role');await q("select set_config('request.jwt.claim.sub',$1,false)",[n?uid(n):'']);if(role)await db.exec(`set role ${role}`)}
let count=0;const check=(name,value)=>{assert.ok(value,name);console.log(`ok ${++count} - ${name}`)}
const denied=async(name,fn)=>{await assert.rejects(fn);check(name,true)}
try{
 await db.exec(await readFile(new URL('./bethel-fixture.sql',import.meta.url),'utf8'))
 const dir=new URL('../supabase/migrations/',import.meta.url)
 for(const file of (await readdir(dir)).filter(f=>f.endsWith('.sql')).sort())await db.exec(await readFile(new URL(file,dir),'utf8'))
 await actor(null,null);await q('insert into auth.users(id,email) values($1,$2)',[uid(4),'reception@example.test'])
 await actor();const e=await rpc('voting_admin_save_election',[null,2094,'DEMO quorum',1,0,null,null,400])
 const c=await rpc('voting_admin_save_candidate',[null,e,'Ficticio M','M',null,false,true])
 const r=await rpc('voting_admin_save_round',[null,e,'official',1,'new',1,0,[c]])
 const today=await scalar("select (now() at time zone 'America/Panama')::date::text")
 let s=await rpc('voting_admin_quorum',[r]);check('no quorum percentage is invented',s.quorum_percent===null&&s.reached===null)
 await rpc('voting_admin_set_quorum',[e,75]);s=await rpc('voting_admin_quorum',[r]);check('empty eligible roster is not quorum',s.eligible_total===0&&s.reached===null)
 for(const v of [0,-1,101,null,50.555])await denied(`invalid percentage ${v} rejected`,()=>rpc('voting_admin_set_quorum',[e,v]))
 await rpc('voting_enable_person',[e,1,'QR-00001',true]);await rpc('voting_enable_person',[e,4,'qr 00001',true]);await rpc('voting_enable_person',[e,2,'QR-00002',true]);await rpc('voting_enable_person',[e,3,'QR-00003',false])
 s=await rpc('voting_admin_quorum',[r]);check('territorial aliases count once and disabled people are excluded',s.eligible_total===2&&s.eligible_present===0)
 check('quorum threshold rounds up required people',s.required_present===2&&s.remaining===2&&!s.reached)
 await rpc('voting_admin_registration_date',[e,today]);await rpc('voting_admin_registration_staff',[e,uid(4),true]);await rpc('voting_admin_start_checkin',[r])
 await actor(4);check('reception has assigned day access',(await rpc('voting_registration_access')).elections.some(x=>x.id===e))
 await denied('reception cannot read quorum',()=>rpc('voting_admin_quorum',[r]));await denied('reception cannot configure quorum',()=>rpc('voting_admin_set_quorum',[e,50]))
 await denied('reception cannot open voting',()=>rpc('voting_admin_open_round',[r]));await denied('reception cannot read results',()=>rpc('voting_admin_results',[r]))
 const lookup=await rpc('voting_reception_lookup',[e,'QR-00001']);check('reception lookup gives person without quorum aggregates',lookup.person.full_name==='Uno'&&!('coverage'in lookup)&&!('eligible_total'in lookup))
 await rpc('voting_reception_attend',[e,'QR-00001',9.03782,-79.46696]);check('repeat arrival does not duplicate',(await rpc('voting_reception_attend',[e,'qr 00001',9.03782,-79.46696])).already_attended)
 await denied('reception respects existing denial or revocation',()=>rpc('voting_reception_attend',[e,'QR-00003',9.03782,-79.46696]))
 await denied('reception cannot mark from outside church',()=>rpc('voting_reception_attend',[e,'QR-00002',0,0]))
 await actor();s=await rpc('voting_admin_quorum',[r]);check('arrival before opening updates eligible-present ratio',s.eligible_present===1&&s.eligible_total===2&&s.present_percent===50&&!s.reached)
 await rpc('voting_admin_set_quorum',[e,50]);s=await rpc('voting_admin_quorum',[r]);check('administrator can change percentage and recalculate',s.reached&&s.required_present===1)
 await actor(null,null);check('quorum never opens voting automatically',await scalar('select status from public.voting_rounds where id=$1',[r])==='checkin')
 check('attendance does not cast votes',await scalar('select count(*)::int from voting_private.participation')===0)
 await actor(4);await rpc('voting_register_person',[e,'Persona nueva ficticia','QR-NEW-004',9.03782,-79.46696])
 await denied('duplicate document cannot create another person',()=>rpc('voting_register_person',[e,'Duplicada','qr new 004',9.03782,-79.46696]))
 await actor();s=await rpc('voting_admin_quorum',[r]);check('new reception registration updates numerator and denominator',s.eligible_total===3&&s.eligible_present===2)
 const pr=await rpc('voting_admin_save_candidate',[null,null,'Práctica','M',null,true,true]);const other=await rpc('voting_admin_save_round',[null,e,'practice',1,'new',1,0,[pr]])
 s=await rpc('voting_admin_quorum',[other]);check('practice does not reuse official attendance',s.eligible_present===0&&s.eligible_total===3)
 const e2=await rpc('voting_admin_save_election',[null,2093,'Otro año',1,0,null,null,400]);await rpc('voting_admin_registration_date',[e2,today])
 await rpc('voting_enable_person',[e2,5,'QR-UNLISTED-005',true]);await actor(4);await denied('reception cannot act in an unassigned election',()=>rpc('voting_reception_lookup',[e2,'QR-UNLISTED-005']))
 // An identified person missing from this election's roster may be added by Reception.
 await rpc('voting_reception_attend',[e,'QR-UNLISTED-005',9.03782,-79.46696]);await actor();s=await rpc('voting_admin_quorum',[r]);check('unlisted existing identity can be enabled and checked in',s.eligible_total===4&&s.eligible_present===3)
 await rpc('voting_admin_registration_staff',[e,uid(4),false]);await actor(4);await denied('revoked reception permission takes effect immediately',()=>rpc('voting_reception_lookup',[e,'QR-00001']))
 await actor();await rpc('voting_admin_registration_staff',[e,uid(4),true]);await rpc('voting_admin_registration_date',[e,'2000-01-01']);await actor(4);await denied('reception permission expires outside authorized day',()=>rpc('voting_reception_attend',[e,'QR-00001',9.03782,-79.46696]))
 await actor(2);await denied('leader has no reception permission by role name',()=>rpc('voting_reception_lookup',[e,'QR-00001']))
 check('staff snapshot does not leak the quorum setting',(await rpc('voting_staff_snapshot')).elections.every(x=>!('quorum_percent' in x)))
 await actor(null,'anon');await denied('anonymous cannot query quorum',()=>rpc('voting_admin_quorum',[r]));await denied('anonymous cannot use reception lookup',()=>rpc('voting_reception_lookup',[e,'QR-00001']))
 console.log(`PASS ${count} quorum/reception checks`)
}finally{await db.close()}

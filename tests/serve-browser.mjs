// Disposable browser fixture. No production services, credentials or data are used.
import { PGlite } from '@electric-sql/pglite'
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto'
import { readFile, readdir } from 'node:fs/promises'
import { createServer } from 'vite'
import react from '@vitejs/plugin-react'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..')
const db=new PGlite({extensions:{pgcrypto}})
const q=async(sql,args=[]) => (await db.query(sql,args)).rows
const scalar=async(sql,args=[]) => Object.values((await q(sql,args))[0])[0]
await db.exec(await readFile(resolve(root,'tests/bethel-fixture.sql'),'utf8'))
await db.exec("alter table public.territories add column name text; update public.territories set name='Territorio ficticio '||id")
for(const f of (await readdir(resolve(root,'supabase/migrations'))).filter(f=>f.endsWith('.sql')).sort()) await db.exec(await readFile(resolve(root,'supabase/migrations',f),'utf8'))
const admin='00000000-0000-0000-0000-000000000001'
await q("select set_config('request.jwt.claim.sub',$1,false)",[admin])
const rpc=async(name,args=[])=>scalar(`select public.${name}(${args.map((_,i)=>`$${i+1}`).join(',')})`,args)
const e=await rpc('voting_admin_save_election',[null,2095,'DEMO navegador · Datos ficticios',1,1,null,null,400])
for(const [id,doc] of [[1,'BROWSER-001'],[2,'BROWSER-002'],[3,'BROWSER-003']]) await rpc('voting_enable_person',[e,id,doc,id!==3])
let practiceRound
for(const kind of ['practice','official']) {
 const ids=[]
 for(const [name,gender] of [['Mujer A','F'],['Mujer B','F'],['Hombre A','M'],['Hombre B','M']]) ids.push(await rpc('voting_admin_save_candidate',[null,kind==='practice'?null:e,`${kind==='practice'?'Sim':'Oficial'} ${name}`,gender,null,kind==='practice',true]))
 const round = await rpc('voting_admin_save_round',[null,e,kind,1,'new',1,1,ids])
 if(kind==='practice') practiceRound=round
}
const receptionist='00000000-0000-0000-0000-000000000004'
await q('insert into auth.users(id,email) values($1,$2)',[receptionist,'reception@example.test'])
await rpc('voting_admin_registration_date',[e,await scalar("select (now() at time zone 'America/Panama')::date::text")])
await rpc('voting_admin_registration_staff',[e,receptionist,true])
const admission='00000000-0000-0000-0000-000000000005'
await q('insert into auth.users(id,email) values($1,$2)',[admission,'admission@example.test'])
await rpc('voting_admin_admission_staff',[e,admission,true])
if(process.env.IMJ_FIXTURE_ADMISSION==='1') await rpc('voting_admin_start_checkin',[practiceRound])
await db.exec('reset role')
const signatures=new Map((await q("select p.proname,p.proargnames,p.proretset from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'voting_%'")).map(p=>[p.proname,p]))
let queue=Promise.resolve()
const server=await createServer({root,configFile:false,plugins:[react(),{
 name:'isolated-fixture',enforce:'pre',
 resolveId(source,importer) {
  if(!importer || !source.startsWith('.')) return
  const target=resolve(dirname(importer.split('?')[0]),source).replace(/\.js$/,'')
  if(target===resolve(root,'src/lib/supabase')) return resolve(root,'tests/browser-supabase.js')
  if(target===resolve(root,'src/lib/voterFlow') && !importer.endsWith('browser-position.js')) return resolve(root,'tests/browser-position.js')
 },
 configureServer(s) { s.middlewares.use('/__qa',async(req,res,next)=>{
  if(!req.url.startsWith('/rpc/')) return next()
  const chunks=[]; for await(const c of req) chunks.push(c)
  const name=req.url.slice(5).split('?')[0], signature=signatures.get(name)
  if(!signature) {res.statusCode=404;res.end('{}');return}
  const args=JSON.parse(Buffer.concat(chunks).toString()||'{}')
  const run=async()=>{try{
   const actor=[admin,receptionist,admission].includes(req.headers['x-fixture-user'])?req.headers['x-fixture-user']:''
   await db.exec('reset role');await q("select set_config('request.jwt.claim.sub',$1,false)",[actor])
   await db.exec(actor?'set role authenticated':'set role anon')
   const names=(signature.proargnames||[]).filter(n=>Object.hasOwn(args,n))
   const rows=await q(`select * from public.${name}(${names.map((n,i)=>`${n} => $${i+1}`).join(',')})`,names.map(n=>args[n]))
   const data=signature.proretset?rows:rows[0]?.[name]
   res.setHeader('Content-Type','application/json');res.end(JSON.stringify({data:data??null,error:null}))
  }catch(error){res.setHeader('Content-Type','application/json');res.end(JSON.stringify({data:null,error:{message:error.message,code:error.code}}))}}
  queue=queue.then(run,run);await queue
 }) }
}],server:{host:'127.0.0.1',port:Number(process.env.PORT||4173),strictPort:true,allowedHosts:['terminal.local'],fs:{allow:[root]}}})
await server.listen()
console.log('Isolated browser fixture ready: in-memory database, fictional accounts and simulated GPS only.')

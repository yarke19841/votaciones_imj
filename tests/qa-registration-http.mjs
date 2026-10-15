// QA only; credentials come from the caller's environment, never from source.
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
const url=process.env.QA_URL, key=process.env.QA_KEY;
assert.equal(url,'https://mldaqivoqhneqldjuryj.supabase.co','Only isolated QA is allowed');
const options={auth:{persistSession:false,autoRefreshToken:false}};
const admin=createClient(url,key,options), registrar=createClient(url,key,options), voter=createClient(url,key,options);
let n=0;const check=(name,value)=>{assert.ok(value,name);console.log(`ok ${++n} - ${name}`)};
const call=async(client,name,args={})=>{
 for(let attempt=0;attempt<3;attempt++){
  const r=await client.rpc(name,args);
  if(!r.error)return r.data;
  const readOnly=['voting_admin_snapshot','voting_registration_access','voting_registration_panel','voting_ballot'].includes(name);
  if(!readOnly || !/502|503|Bad Gateway|fetch failed/i.test(r.error.message) || attempt===2)throw r.error;
 }
};
const denied=async(name,fn)=>{let e;try{await fn()}catch(error){e=error}check(name,!!e)};
try{
 for(const [client,email] of [[admin,'qa-voting-20261014-admin@example.invalid'],[registrar,'qa-voting-registration@example.invalid']]){
  const {error}=await client.auth.signInWithPassword({email,password:process.env.QA_PASSWORD});if(error)throw error;
 }
 check('real admin and registration Auth logins',true);
 const access=await call(registrar,'voting_registration_access');check('registrar sees assigned election for today',access.elections.length===1);
 const e=access.elections[0].id;
 const snapshot=await call(admin,'voting_admin_snapshot');const election=snapshot.elections.find(x=>x.id===e);
 const panel=await call(registrar,'voting_registration_panel',{p_election_id:e});check('registration has active round',!!panel.round);
 await denied('registrar cannot inspect admin snapshot',()=>call(registrar,'voting_admin_snapshot'));
 await denied('registrar cannot close active vote',()=>call(registrar,'voting_admin_close_active'));
 await denied('anonymous cannot read day list',()=>call(voter,'voting_registration_panel',{p_election_id:e}));
 const cedula='QA-REG-HTTP-20261015';
 const args={p_election_id:e,p_full_name:'QA REG HTTP 20261015 TEMP',p_cedula:cedula,p_latitude:election.church_latitude,p_longitude:election.church_longitude};
 await denied('outside registration rejected',()=>call(registrar,'voting_register_person',{...args,p_latitude:0,p_longitude:0}));
 const concurrent=await Promise.allSettled([call(registrar,'voting_register_person',args),call(registrar,'voting_register_person',args)]);
 check('two concurrent creates produce exactly one person',concurrent.filter(r=>r.status==='fulfilled').length===1);
 const made=concurrent.find(r=>r.status==='fulfilled').value;
 check('created person immediately enabled and present',made.enabled&&made.attended);
 const rows=(await call(admin,'voting_registration_panel',{p_election_id:e})).rows;
 check('admin sees creator and timestamp',rows.some(r=>r.id===made.registration_id&&r.registered_by&&r.registered_at&&r.enabled&&r.attended));
 const entry=await call(voter,'voting_enter',{p_cedula:cedula,p_latitude:args.p_latitude,p_longitude:args.p_longitude});
 check('new voter enters without second activation',entry.attended&&entry.enabled&&['waiting','ready'].includes(entry.state));
 await denied('registration staff cannot revoke',()=>call(registrar,'voting_admin_revoke_registration',{p_registration_id:made.registration_id,p_reason:'QA denial'}));
 await call(admin,'voting_admin_revoke_registration',{p_registration_id:made.registration_id,p_reason:'QA cleanup review'});
 const after=await call(voter,'voting_ballot',{p_token:entry.token,p_latitude:args.p_latitude,p_longitude:args.p_longitude});
 check('revoked session cannot see a ballot',after.state!=='ready'&&!after.candidates);
 const reentry=await call(voter,'voting_enter',{p_cedula:cedula,p_latitude:args.p_latitude,p_longitude:args.p_longitude});
 check('revoked person cannot become enabled by reentering',reentry.enabled===false&&reentry.reason==='not_enabled');
 const row=(await call(admin,'voting_registration_panel',{p_election_id:e})).rows.find(r=>r.id===made.registration_id);
 check('revoked entry retains arrival and reason',!row.enabled&&row.attended&&row.revocation_reason==='QA cleanup review');
 console.log(`PASS ${n} real Auth/HTTP registration checks; temporary fixture requires scoped SQL cleanup.`);
}finally{await Promise.all([admin.auth.signOut(),registrar.auth.signOut()]);}

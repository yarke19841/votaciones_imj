// Loaded ONLY by tests/serve-browser.mjs. Never imported by production code.
export const isQaEnvironment=false
const key='isolated-fixture-admin'
const user={id:'00000000-0000-0000-0000-000000000001',email:'qa@example.test'}
// The fixture declares the admin surface explicitly; this does not test real Auth.
const session=()=>location.hash.startsWith('#/admin')?{user}:null
export const supabase={
 auth:{
  async getSession(){return {data:{session:session()}}},
  async signInWithPassword({email,password}){if(email!=='qa@example.test'||password!=='fixture-only')return {data:{},error:{message:'Invalid fixture login'}};sessionStorage.setItem(key,'yes');return {data:{session:session()},error:null}},
  async signOut(){sessionStorage.removeItem(key);return {error:null}},
 },
 from(table){if(table!=='profiles')throw Error('Unsupported fixture table');return {select(){return this},eq(){return this},async maybeSingle(){return {data:session()?{role:'admin',is_active:true}:null,error:null}}}},
 async rpc(name,args={}){return (await fetch(`/__qa/rpc/${name}`,{method:'POST',headers:{'Content-Type':'application/json','X-Fixture-Admin':session()?'yes':'no'},body:JSON.stringify(args)})).json()},
 storage:{from(){return {async createSignedUrl(){return {data:null,error:null}}}}},
}

import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { loginAdmin } from '../../lib/authAdmin'
import { staffDestination } from '../../lib/staffRoutes'
import { isQaEnvironment } from '../../lib/supabase'
import OfficialLogo from '../../components/OfficialLogo'

export default function AdminLogin() {
  const nav = useNavigate(), loc = useLocation()
  const [email,setEmail]=useState(''), [password,setPassword]=useState(''), [msg,setMsg]=useState(''), [pending,setPending]=useState(false)
  async function submit(event) {
    event.preventDefault(); setPending(true); setMsg('')
    try {
      const result=await loginAdmin(email.trim(),password)
      if(!result.ok) return setMsg(result.msg)
      nav(staffDestination(result.session, loc.state?.from?.pathname),{replace:true})
    } catch { setMsg('No se pudo completar el acceso. Revisa tu conexión y vuelve a intentar.') }
    finally { setPending(false) }
  }
  return <main className="center-page"><form className="card auth-card" onSubmit={submit}>
    <OfficialLogo className="auth-logo"/>
    <p className="eyebrow">Ministerio Jezreel</p><h1>Panel de votaciones</h1><p>Inicia sesión para acceder a las opciones autorizadas de tu cuenta.</p>
    <label>{isQaEnvironment ? 'Usuario o correo' : 'Correo'}<input type={isQaEnvironment ? 'text' : 'email'} autoComplete="username" value={email} onChange={e=>setEmail(e.target.value)} required /></label>
    <label>Contraseña<input type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} required /></label>
    {msg && <p className="error" role="alert">{msg}</p>}
    <button disabled={pending}>{pending?'Validando…':'Entrar'}</button>
  </form></main>
}

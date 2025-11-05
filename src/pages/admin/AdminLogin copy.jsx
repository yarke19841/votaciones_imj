import { useState } from "react"
import { useNavigate, useLocation } from "react-router-dom"
import { loginAdmin, isAdmin } from "../../lib/authAdmin"

export default function AdminLogin(){
  const nav = useNavigate()
  const loc = useLocation()
  const [pass,setPass] = useState("")
  const [msg,setMsg] = useState("")

  function submit(e){
    e.preventDefault()
    const { ok, msg } = loginAdmin(pass)
    if (!ok) { setMsg(msg||'Error'); return }
    const to = (loc.state && loc.state.from) || '/admin'
    nav(to, { replace:true })
  }

  if (isAdmin()) { nav('/admin', { replace:true }); return null }

  const s = {
    page:{ minHeight:"100vh", background:"#f3f4f6", fontFamily:"system-ui,-apple-system,Segoe UI,Roboto", display:"grid", placeItems:"center", padding:"24px 16px" },
    card:{ maxWidth:420, width:"100%", background:"#fff", border:"1px solid #e5e7eb", borderRadius:16, padding:24, boxShadow:"0 8px 24px rgba(0,0,0,.06)" },
    title:{ fontSize:20, fontWeight:700, marginBottom:12, textAlign:"center" },
    label:{ display:"block", fontSize:14, fontWeight:600, marginBottom:6 },
    input:{ width:"100%", padding:"10px 12px", border:"1px solid #d1d5db", borderRadius:10, outline:"none", marginBottom:10 },
    btn:{ width:"100%", padding:"12px 16px", borderRadius:12, border:"1px solid #2563eb", background:"#2563eb", color:"#fff", fontWeight:700, cursor:"pointer" },
    err:{ color:"#e11d48", fontSize:13, marginBottom:10, textAlign:"center" },
  }

  return (
    <div style={s.page}>
      <form style={s.card} onSubmit={submit}>
        <div style={{textAlign:"center", fontSize:36}}>🔐</div>
        <div style={s.title}>Acceso Administrador</div>
        <label style={s.label}>Clave de administrador</label>
        <input type="password" style={s.input} value={pass} onChange={e=>setPass(e.target.value)} placeholder="••••••••" />
        {msg && <div style={s.err}>{msg}</div>}
        <button style={s.btn} type="submit">Entrar</button>
      </form>
    </div>
  )
}

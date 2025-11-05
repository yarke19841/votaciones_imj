import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { supabase } from "../lib/supabase"

export default function VoteLoginStandalone() {
  useEffect(() => { console.log("✅ Renderizando VoteLoginStandalone") }, [])

  const [cedula, setCedula] = useState("")
  const [errorMsg, setErrorMsg] = useState("")
  const navigate = useNavigate()

  async function handleContinue() {
    try {
      setErrorMsg("")
      const c = cedula.trim()
      if (!c) { setErrorMsg("Ingresa tu cédula."); return }

      // 1) Hay una elección abierta
      const { data: election, error: eErr } = await supabase
        .from("election")
        .select("id,title,required_male,required_female,status")
        .eq("status","abierta")
        .order("created_at",{ ascending:false })
        .limit(1)
        .single()
      if (eErr) { setErrorMsg("No hay una elección abierta."); return }
      if (!election) { setErrorMsg("No hay una elección abierta."); return }

      // 2) Buscar miembro por cédula y verificar que esté ACTIVO
      const { data: member, error: mErr } = await supabase
        .from("member")
        .select("id, full_name, cedula, active")  // ← asumimos boolean 'active'
        .eq("cedula", c)
        .maybeSingle()
      if (mErr) { setErrorMsg("Error al validar tu cédula."); return }
      if (!member) { setErrorMsg("No estás registrado. Ve a mesa de registro."); return }
      if (member.active !== true) {               // ← solo pasa si active === true
        setErrorMsg("No estás activo para votar. Acércate a mesa de registro."); 
        return
      }

      // 3) Guardar en sesión y continuar a la papeleta
      sessionStorage.setItem("election", JSON.stringify(election))
      sessionStorage.setItem("voter", JSON.stringify({
        member_id: member.id, full_name: member.full_name, cedula: member.cedula
      }))
      navigate("/vote") // ← tu ruta de papeleta
    } catch {
      setErrorMsg("Error inesperado. Intenta de nuevo.")
    }
  }

  // --- Estilos inline centralizados ---
  const s = {
    page: { minHeight:"100vh", background:"#f3f4f6", fontFamily:"system-ui,-apple-system,Segoe UI,Roboto" },
    headerWrap:{ background:"#fff", borderBottom:"1px solid #e5e7eb" },
    header:{ maxWidth:960, margin:"0 auto", padding:"12px 16px", display:"flex", alignItems:"center", justifyContent:"space-between" },
    brandLeft:{ display:"flex", alignItems:"center", gap:10 },
    brandSquare:{ width:32, height:32, borderRadius:10, background:"#2563eb" },
    brandTitle:{ fontSize:18, fontWeight:700 },
    main:{ maxWidth:960, margin:"0 auto", padding:"24px 16px" },
    card:{ maxWidth:420, margin:"40px auto", background:"#fff", border:"1px solid #e5e7eb", borderRadius:16, padding:20, boxShadow:"0 8px 24px rgba(0,0,0,.06)" },
    title:{ textAlign:"center", fontSize:20, fontWeight:700, margin:"6px 0 2px" },
    caption:{ textAlign:"center", fontSize:14, color:"#6b7280", margin:"0 0 12px" },
    label:{ display:"block", fontSize:14, fontWeight:600, marginBottom:6 },
    input:{ width:"100%", padding:"10px 12px", border:"1px solid #d1d5db", borderRadius:10, outline:"none", marginBottom:10 },
    error:{ color:"#e11d48", fontSize:13, marginBottom:10 },
    btn:{ width:"100%", padding:"12px 16px", borderRadius:12, border:"1px solid #2563eb", background:"#2563eb", color:"#fff", fontWeight:700, cursor:"pointer" },
    footer:{ padding:24, textAlign:"center", color:"#6b7280", fontSize:12 }
  }

  return (
    <div style={s.page}>
      <header style={s.headerWrap}>
        <div style={s.header}>
          <div style={s.brandLeft}>
            <div style={s.brandSquare} />
            <div style={s.brandTitle}>Elección de Diáconos</div>
          </div>
          <div />
        </div>
      </header>

      <a href="/admin/login" style={{display:'inline-block',marginTop:12,fontSize:12,color:'#2563eb',textDecoration:'underline'}}>
        Soy administrador
      </a>

      <main style={s.main}>
        <div style={s.card}>
          <div style={{textAlign:"center", marginBottom:8}}>
            <div style={{fontSize:24}}>🗳️</div>
            <h2 style={s.title}>BIENVENIDO</h2>
            <p style={s.caption}>Ingresa tu cédula para continuar con la votación.</p>
          </div>

          <label style={s.label}>Cédula</label>
          <input
            style={s.input}
            value={cedula}
            onChange={e => setCedula(e.target.value)}
            placeholder="8-123-456"
          />

          {errorMsg && <div style={s.error}>{errorMsg}</div>}

          <button style={s.btn} onClick={handleContinue}>Continuar</button>
        </div>
      </main>

      <footer style={s.footer}>IGLESIA MINISTERIO JEZREEL · MÓDULO DE VOTACIONES</footer>
    </div>
  )
}

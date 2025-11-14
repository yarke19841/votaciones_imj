// src/pages/admin/AdminElectionList.jsx
import { useEffect, useState } from "react"
import { useNavigate, Link } from "react-router-dom"
import { supabase } from "../../lib/supabase"

export default function AdminElectionList(){
  const nav = useNavigate()

  const [rows, setRows]     = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]   = useState("")
  const [msg, setMsg]       = useState("")

  const s = {
    page:{ fontFamily:"system-ui,-apple-system,Segoe UI,Roboto", background:"#f3f4f6", minHeight:"100vh" },
    wrap:{ maxWidth: 1100, margin:"0 auto", padding:"24px 16px" },
    card:{ background:"#fff", border:"1px solid #e5e7eb", borderRadius:16, boxShadow:"0 8px 24px rgba(15,23,42,.06)" },
    headerRow:{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"14px 16px", borderBottom:"1px solid #e5e7eb" },
    headerTitle:{ fontWeight:800, fontSize:18 },
    subHeader:{ fontSize:12, color:"#6b7280", marginTop:2 },
    cardBody:{ padding:16 },
    btnPrimary:{
      display:"inline-flex", alignItems:"center", justifyContent:"center",
      padding:"8px 12px", borderRadius:10, border:"1px solid #2563eb",
      background:"#2563eb", color:"#fff", fontSize:13, fontWeight:700,
      textDecoration:"none", cursor:"pointer"
    },
    // ... (lo demás que ya tengas)
  }

  useEffect(() => {
    load()
  }, [])

  async function load(){
    try {
      setLoading(true); setError(""); setMsg("")
      const { data, error } = await supabase
        .from("election")
        .select("id,title,required_male,required_female,created_at,opened_at,closed_at,status")
        .order("created_at", { ascending:false })
      if (error) throw error
      setRows(data || [])
    } catch (e) {
      console.error(e)
      setError("No se pudo cargar el listado.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={s.page}>
      <div style={s.wrap}>
        <div style={s.card}>
          {/* HEADER CON BOTÓN NUEVA ELECCIÓN */}
          <div style={s.headerRow}>
            <div>
              <div style={s.headerTitle}>Elecciones</div>
              <div style={s.subHeader}>Administra los procesos de votación de la iglesia.</div>
            </div>
            <div style={{display:"flex", gap:8}}>
              <Link to="/admin/elections/new" style={s.btnPrimary}>
                ➕ Nueva elección
              </Link>
            </div>
          </div>

          <div style={s.cardBody}>
            {loading && "Cargando…"}
            {error && <div style={{color:"#b91c1c", fontSize:13}}>{error}</div>}

            {/* aquí tu tabla/lista de elecciones actual */}
            {/* cada fila seguramente tiene un botón que hace:
                nav(`/admin/elections/${row.id}`)
            */}
          </div>
        </div>
      </div>
    </div>
  )
}

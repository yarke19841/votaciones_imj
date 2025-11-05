import { useEffect, useMemo, useState } from "react"
import { supabase } from "../../lib/supabase.js"

export default function AdminCandidatesList(){
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]   = useState("")
  const [msg, setMsg]       = useState("")
  const [q, setQ]           = useState("")
  const [saving, setSaving] = useState(false)

  // Crear rápido (opcional, si tu tabla candidate no exige FK estricto)
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    sex: "F",
    notes: ""
  })

  const s = {
    page:{ fontFamily:"system-ui,-apple-system,Segoe UI,Roboto", background:"#f3f4f6", minHeight:"100vh" },
    wrap:{ maxWidth:1100, margin:"0 auto", padding:"24px 16px" },
    card:{ background:"#fff", border:"1px solid #e5e7eb", borderRadius:16, boxShadow:"0 8px 24px rgba(0,0,0,.06)" },
    headerRow:{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"14px 16px", borderBottom:"1px solid #e5e7eb" },
    headerTitle:{ fontWeight:800 },
    cardBody:{ padding:16 },
    grid:{ display:"grid", gap:12, gridTemplateColumns:"repeat(auto-fill,minmax(320px,1fr))" },
    item:{ border:"1px solid #e5e7eb", borderRadius:14, padding:14, background:"#fff" },
    meta:{ fontSize:12, color:"#6b7280" },
    badge:(variant)=>({
      display:"inline-flex", padding:"2px 8px", borderRadius:999, fontSize:12, fontWeight:700,
      border:"1px solid #d1d5db",
      background: "#eef2ff",
      color: "#4338ca"
    }),
    label:{ fontSize:13, fontWeight:700, marginBottom:6 },
    input:{ width:"100%", padding:"10px 12px", border:"1px solid #d1d5db", borderRadius:10, outline:"none" },
    ta:{ width:"100%", minHeight:68, padding:"10px 12px", border:"1px solid #d1d5db", borderRadius:10, outline:"none", resize:"vertical" },
    row2:{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 },
    bar:{ display:"flex", gap:8, marginTop:12, flexWrap:"wrap" },
    btn:(kind="primary")=>{
      const map={
        primary: { background:"#2563eb", border:"#2563eb", color:"#fff" },
        ghost:   { background:"#fff",   border:"#d1d5db", color:"#111827" },
        danger:  { background:"#e11d48",border:"#e11d48", color:"#fff" },
      }
      const x = map[kind] || map.primary
      return {
        display:"inline-flex", alignItems:"center", justifyContent:"center",
        padding:"10px 12px", borderRadius:12, border:`1px solid ${x.border}`,
        background:x.background, color:x.color, fontWeight:700, cursor:"pointer"
      }
    },
    err:{ color:"#e11d48", fontSize:13, marginTop:8 },
    ok:{ color:"#065f46", fontSize:13, marginTop:8 },
  }

  useEffect(()=>{ load() },[])

  async function load(){
    try {
      setLoading(true); setError(""); setMsg("")
      // Intento A: columnas esperadas
      let { data, error } = await supabase
        .from("candidate")
        .select("id, full_name, first_name, last_name, sex, notes, created_at, is_active")

      if (error) {
        // Intento B: comodín
        const resp2 = await supabase.from("candidate").select("*")
        if (resp2.error) throw resp2.error
        data = resp2.data
      }

      const normalized = (data || []).map(r => ({
        ...r,
        full_name: r.full_name || `${r.first_name ?? ""} ${r.last_name ?? ""}`.trim()
      }))

      const sorted = normalized.sort((a,b)=>{
        if (a.created_at && b.created_at) return (a.created_at < b.created_at) ? 1 : -1
        return (a.id < b.id) ? 1 : -1
      })
      setRows(sorted)
    } catch (e) {
      console.error("[candidate.load]", e)
      setError(e.message || "No se pudo cargar el listado.")
      setRows([])
    } finally {
      setLoading(false)
    }
  }

  // Crear rápido (si tu tabla permite crear sin FK)
  async function createCandidate(e){
    e.preventDefault()
    setSaving(true); setError(""); setMsg("")
    const first_name = form.first_name.trim()
    const last_name = form.last_name.trim()
    const sex = (form.sex || "").toUpperCase() === "M" ? "M" : "F"
    const full_name = `${first_name} ${last_name}`.trim()
    if (!first_name || !last_name) { setError("Nombre y apellido son requeridos."); setSaving(false); return }

    try {
      const { error } = await supabase.from("candidate").insert({
        first_name, last_name, full_name, sex, notes: form.notes?.trim() || null, is_active: true
      })
      if (error) throw error
      setMsg("Candidato creado.")
      setForm({ first_name:"", last_name:"", sex:"F", notes:"" })
      await load()
    } catch (e) {
      setError(e.message || "No se pudo crear el candidato.")
    } finally {
      setSaving(false)
    }
  }

  // Activar / desactivar (si existe is_active)
  async function toggleActive(row){
    try {
      const next = !row.is_active
      const { error } = await supabase.from("candidate").update({ is_active: next }).eq("id", row.id)
      if (error) throw error
      setMsg("Estado actualizado.")
      await load()
    } catch (e) {
      setError(e.message || "No se pudo actualizar el estado.")
    }
  }

  const filtered = useMemo(()=>{
    const t = q.trim().toLowerCase()
    if (!t) return rows
    return rows.filter(r =>
      (r.full_name || "").toLowerCase().includes(t) ||
      (r.first_name || "").toLowerCase().includes(t) ||
      (r.last_name || "").toLowerCase().includes(t)
    )
  }, [rows, q])

  return (
    <div style={s.page}>
      <div style={s.wrap}>

        {/* Listado */}
        <div style={s.card}>
          <div style={s.headerRow}>
            <div style={s.headerTitle}>Candidatos ({rows.length})</div>
            <div style={{display:"flex", gap:8}}>
              <input
                style={s.input}
                placeholder="Buscar por nombre…"
                value={q}
                onChange={e=>setQ(e.target.value)}
              />
              <button onClick={load} style={s.btn("ghost")}>Actualizar</button>
            </div>
          </div>
          <div style={s.cardBody}>
            {loading ? "Cargando…" :
             error ? <div style={s.err}>{error}</div> :
             filtered.length === 0 ? "Sin coincidencias." :
             <div style={s.grid}>
               {filtered.map(r=>(
                 <div key={r.id} style={s.item}>
                   <div style={{display:"flex", justifyContent:"space-between", alignItems:"center"}}>
                     <div style={{fontWeight:800}}>{r.full_name || "—"}</div>
                     <span style={s.badge()}>{r.is_active === false ? "Inactivo" : "Activo"}</span>
                   </div>
                   <div style={s.meta}>Sexo: {r.sex ?? "—"}</div>
                   {r.notes && <div style={{fontSize:12, color:"#4b5563", marginTop:6}}>{r.notes}</div>}
                   <div style={{display:"flex", gap:8, marginTop:10, flexWrap:"wrap"}}>
                     <button style={s.btn("ghost")} onClick={()=>toggleActive(r)}>
                       {r.is_active === false ? "Activar" : "Desactivar"}
                     </button>
                   </div>
                 </div>
               ))}
             </div>
            }
          </div>
        </div>

        {/* Crear candidato rápido (opcional) */}
        <div style={{...s.card, marginTop:16}}>
          <div style={s.headerRow}>
            <div style={s.headerTitle}>Crear candidato</div>
          </div>
          <form style={s.cardBody} onSubmit={createCandidate}>
            <div style={s.row2}>
              <div>
                <div style={s.label}>Nombre *</div>
                <input style={s.input} value={form.first_name} onChange={e=>setForm(v=>({...v, first_name:e.target.value}))}/>
              </div>
              <div>
                <div style={s.label}>Apellido *</div>
                <input style={s.input} value={form.last_name} onChange={e=>setForm(v=>({...v, last_name:e.target.value}))}/>
              </div>
            </div>
            <div style={s.row2}>
              <div>
                <div style={s.label}>Sexo *</div>
                <select style={s.input} value={form.sex} onChange={e=>setForm(v=>({...v, sex:e.target.value}))}>
                  <option value="F">F</option>
                  <option value="M">M</option>
                </select>
              </div>
              <div>
                <div style={s.label}>Notas (opcional)</div>
                <input style={s.input} value={form.notes} onChange={e=>setForm(v=>({...v, notes:e.target.value}))} placeholder="Observaciones"/>
              </div>
            </div>

            <div style={s.bar}>
              <button type="submit" style={s.btn("primary")} disabled={saving}>
                {saving ? "Creando…" : "Crear"}
              </button>
              <button type="button" style={s.btn("ghost")} onClick={()=>{ setForm({first_name:"", last_name:"", sex:"F", notes:""}); setError(""); setMsg("") }}>
                Limpiar
              </button>
            </div>

            {error && <div style={s.err}>{error}</div>}
            {msg && <div style={s.ok}>{msg}</div>}
          </form>
        </div>

      </div>
    </div>
  )
}

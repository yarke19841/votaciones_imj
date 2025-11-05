import { useEffect, useMemo, useState } from "react"
import { supabase } from "../../lib/supabase"
import AdminBar from "../../components/AdminBar.jsx"

export default function AdminVoterEligibility(){
  const [elections, setElections] = useState([])
  const [selElection, setSelElection] = useState("")
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [msg, setMsg] = useState("")

  // Búsqueda de miembros activos
  const [q, setQ] = useState("")
  const [members, setMembers] = useState([]) // miembros activos (lado izquierdo)
  const [searching, setSearching] = useState(false)

  // Habilitados para votar (lado derecho)
  const [enabled, setEnabled] = useState([])

  const s = {
    page:{ fontFamily:"system-ui,-apple-system,Segoe UI,Roboto", background:"#f3f4f6", minHeight:"100vh" },
    wrap:{ maxWidth:1100, margin:"0 auto", padding:"24px 16px" },
    row:{ display:"flex", gap:12, alignItems:"center", flexWrap:"wrap" },
    card:{ background:"#fff", border:"1px solid #e5e7eb", borderRadius:16, boxShadow:"0 8px 24px rgba(0,0,0,.06)" },
    headerRow:{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"14px 16px", borderBottom:"1px solid #e5e7eb" },
    headerTitle:{ fontWeight:800 },
    cardBody:{ padding:16 },
    input:{ width:"100%", padding:"10px 12px", border:"1px solid #d1d5db", borderRadius:10, outline:"none" },
    btn:(kind="primary")=>{
      const map={
        primary: { background:"#2563eb", border:"#2563eb", color:"#fff" },
        ghost:   { background:"#fff",   border:"#d1d5db", color:"#111827" },
        danger:  { background:"#e11d48",border:"#e11d48", color:"#fff" },
        success: { background:"#16a34a",border:"#16a34a", color:"#fff" },
      }
      const x = map[kind] || map.primary
      return {
        display:"inline-flex", alignItems:"center", justifyContent:"center",
        padding:"10px 12px", borderRadius:12, border:`1px solid ${x.border}`,
        background:x.background, color:x.color, fontWeight:700, cursor:"pointer"
      }
    },
    grid2:{ display:"grid", gap:16, gridTemplateColumns:"1fr 1fr" },
    list:{ display:"grid", gap:10 },
    item:{ border:"1px solid #e5e7eb", borderRadius:12, padding:12, background:"#fff" },
    meta:{ fontSize:12, color:"#6b7280" },
    tag:()=>({ display:"inline-flex", padding:"2px 8px", borderRadius:999, fontSize:12, border:"1px solid #d1d5db",
               background:"#f3f4f6", color:"#111827", fontWeight:700 }),
    err:{ color:"#e11d48", fontSize:13, marginTop:8 },
    ok:{ color:"#065f46", fontSize:13, marginTop:8 },
    overlay:{ position:"fixed", inset:0, background:"rgba(255,255,255,.6)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:50, fontWeight:800 }
  }

  useEffect(()=>{ init() },[])
  async function init(){
    setLoading(true); setError(""); setMsg("")
    const { data, error } = await supabase
      .from("election")
      .select("id, title, status, required_male, required_female, created_at")
      .order("created_at", { ascending:false })
    if (error){ setError("No se pudieron cargar las elecciones."); setLoading(false); return }
    setElections(data || [])
    const firstOpen = (data || []).find(e => (e.status||"").toLowerCase()==="abierta")?.id ?? (data?.[0]?.id ?? "")
    setSelElection(firstOpen)
    setLoading(false)
  }

  useEffect(()=>{ if(selElection){ loadMembers(); loadEnabled(); } }, [selElection])

  async function loadMembers(){
    setSearching(true); setError("")
    // miembros activos (puedes ajustar los campos según tu esquema)
    let query = supabase
      .from("member")
      .select("id, cedula, first_name, last_name, full_name, sex, is_active")
      .eq("is_active", true)
      .order("created_at", { ascending:false })
      .limit(50)

    if (q.trim()){
      const term = q.trim()
      query = supabase
        .from("member")
        .select("id, cedula, first_name, last_name, full_name, sex, is_active")
        .eq("is_active", true)
        .or(`cedula.ilike.%${term}%,first_name.ilike.%${term}%,last_name.ilike.%${term}%,full_name.ilike.%${term}%`)
        .order("created_at", { ascending:false })
        .limit(50)
    }

    const { data, error } = await query
    setSearching(false)
    if (error){ console.error(error); setError(`Miembros error: ${error.message}`); setMembers([]); return }
    setMembers(data || [])
  }

  async function loadEnabled(){
    setBusy(true); setError("")
    // election_member + member (solo habilitados can_vote=true)
    const { data, error } = await supabase
      .from("election_member")
      .select("id, can_vote, already_voted, member:member_id(id, cedula, first_name, last_name, full_name, sex)")
      .eq("election_id", selElection)
      .eq("can_vote", true)
      .order("created_at", { ascending:false })
    setBusy(false)
    if (error){ console.error(error); setError(`Habilitados error: ${error.message}`); setEnabled([]); return }
    setEnabled(data || [])
  }

  function displayName(m){
    return (m.full_name?.trim() || `${m.first_name ?? ""} ${m.last_name ?? ""}`.trim() || "Sin nombre").trim()
  }

  // Agregar 1 miembro a habilitados (upsert)
  async function addOne(m){
    if (!selElection){ setError("Selecciona una elección."); return }
    setBusy(true); setError(""); setMsg("")
    const payload = {
      election_id: selElection,
      member_id: m.id,
      can_vote: true,
      already_voted: false
    }
    const { error } = await supabase
      .from("election_member")
      .upsert(payload, { onConflict: "election_id,member_id" })
    setBusy(false)

    if (error){ console.error(error); setError(`Agregar error: ${error.message}`); return }
    setMsg(`Habilitado: ${displayName(m)}`)
    await loadEnabled()
  }

  // Quitar 1 miembro de habilitados (no borrar, solo can_vote=false para mantener auditoría)
  async function removeOne(row){
    setBusy(true); setError(""); setMsg("")
    const { error } = await supabase
      .from("election_member")
      .update({ can_vote: false })
      .eq("id", row.id)
    setBusy(false)

    if (error){ console.error(error); setError(`Quitar error: ${error.message}`); return }
    setMsg(`Deshabilitado: ${displayName(row.member)}`)
    await loadEnabled()
  }

  // Agregar en lote: todos los miembros listados (izquierda)
  async function addAllListed(){
    if (!selElection){ setError("Selecciona una elección."); return }
    if (members.length===0){ setMsg("No hay miembros en la lista izquierda."); return }
    setBusy(true); setError(""); setMsg("Procesando…")

    const rows = members.map(m=>({
      election_id: selElection,
      member_id: m.id,
      can_vote: true,
      already_voted: false
    }))

    const { error } = await supabase
      .from("election_member")
      .upsert(rows, { onConflict: "election_id,member_id" })

    setBusy(false)
    if (error){ console.error(error); setError(`Agregar lote error: ${error.message}`); return }
    setMsg(`Habilitados ${rows.length} miembros.`)
    await loadEnabled()
  }

  const counts = useMemo(()=>({
    activeMembers: members.length,
    enabled: enabled.length
  }), [members, enabled])

  return (
    <div style={s.page}>
      <AdminBar />
      <div style={s.wrap}>

        {/* Selección de elección */}
        <div style={s.card}>
          <div style={s.headerRow}>
            <div style={s.headerTitle}>Habilitar votantes</div>
            <button style={s.btn("ghost")} onClick={()=>{ loadMembers(); loadEnabled(); }}>Actualizar</button>
          </div>
          <div style={s.cardBody}>
            <div style={s.row}>
              <div style={{minWidth:260, flex:1}}>
                <div style={{fontSize:13, fontWeight:700, marginBottom:6}}>Elección</div>
                <select style={s.input} value={selElection} onChange={e=>setSelElection(e.target.value)}>
                  {elections.map(e => (
                    <option key={e.id} value={e.id}>{e.title} ({e.status})</option>
                  ))}
                </select>
              </div>
              <span style={s.tag()}>Activos listados: {counts.activeMembers}</span>
              <span style={s.tag()}>Habilitados: {counts.enabled}</span>
            </div>
            {error && <div style={s.err}>{error}</div>}
            {msg && <div style={s.ok}>{msg}</div>}
          </div>
        </div>

        {/* Doble listado: activos vs habilitados */}
        <div style={{...s.card, marginTop:16}}>
          <div style={s.headerRow}>
            <div style={s.headerTitle}>Miembros activos → Disponibles para votar</div>
            <div style={{display:"flex", gap:8}}>
              <button style={s.btn("ghost")} onClick={addAllListed} disabled={busy || members.length===0}>Agregar todos los listados</button>
            </div>
          </div>
          <div style={{...s.cardBody}}>
            <div style={s.grid2}>
              {/* Columna izquierda: miembros activos (buscables) */}
              <div>
                <div style={{display:"flex", gap:8, marginBottom:10}}>
                  <input
                    style={{...s.input, flex:1}}
                    placeholder="Buscar por cédula, nombre, apellido…"
                    value={q}
                    onChange={e=>setQ(e.target.value)}
                  />
                  <button style={s.btn("primary")} onClick={loadMembers} disabled={searching}>
                    {searching ? "Buscando…" : "Buscar"}
                  </button>
                </div>
                <div style={{fontWeight:700, marginBottom:8}}>Miembros activos</div>
                <div style={s.list}>
                  {members.length===0 ? <div className="empty" style={{color:"#6b7280"}}>Sin resultados.</div> :
                    members.map(m=>(
                      <div key={m.id} style={s.item}>
                        <div style={{display:"flex", justifyContent:"space-between", alignItems:"center"}}>
                          <div>
                            <div style={{fontWeight:800}}>{displayName(m)}</div>
                            <div style={s.meta}>Cédula: {m.cedula} · {m.sex || "?"}</div>
                          </div>
                          <button style={s.btn("success")} onClick={()=>addOne(m)} disabled={busy}>Habilitar</button>
                        </div>
                      </div>
                    ))
                  }
                </div>
              </div>

              {/* Columna derecha: habilitados para votar */}
              <div>
                <div style={{fontWeight:700, marginBottom:8}}>Disponibles para votar</div>
                <div style={s.list}>
                  {enabled.length===0 ? <div style={{color:"#6b7280"}}>Aún no hay habilitados.</div> :
                    enabled.map(row=>(
                      <div key={row.id} style={s.item}>
                        <div style={{display:"flex", justifyContent:"space-between", alignItems:"center"}}>
                          <div>
                            <div style={{fontWeight:800}}>{displayName(row.member)}</div>
                            <div style={s.meta}>Cédula: {row.member?.cedula} · {row.member?.sex || "?"} · {row.already_voted ? "Ya votó" : "No ha votado"}</div>
                          </div>
                          <button style={s.btn("danger")} onClick={()=>removeOne(row)} disabled={busy || row.already_voted}>
                            {row.already_voted ? "Bloqueado" : "Quitar"}
                          </button>
                        </div>
                      </div>
                    ))
                  }
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
      {(busy || loading) && (<div style={s.overlay}>{loading ? "Cargando…" : "Procesando…"}</div>)}
    </div>
  )
}

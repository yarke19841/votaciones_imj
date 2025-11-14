import { useEffect, useMemo, useState } from "react"
import { supabase } from "../../lib/supabase"

// Normaliza cédula para búsquedas (coincide con tu otro módulo)
function normalizeCedulaLocal(c){
  return (c ?? "").toUpperCase().replace(/[^A-Z0-9]+/g,"")
}

export default function AdminCheckIn(){
  // UI base
  const s = useMemo(()=>({
    page:{ fontFamily:"system-ui,-apple-system,Segoe UI,Roboto", background:"#f3f4f6", minHeight:"100vh" },
    wrap:{ maxWidth:1100, margin:"0 auto", padding:"24px 16px" },
    grid:{ display:"grid", gap:16, gridTemplateColumns:"1.2fr .8fr" },
    card:{ background:"#fff", border:"1px solid #e5e7eb", borderRadius:16, padding:16, boxShadow:"0 8px 24px rgba(0,0,0,.06)" },
    head:{ display:"flex", alignItems:"baseline", justifyContent:"space-between", marginBottom:10 },
    title:{ fontSize:20, fontWeight:800, color:"#0f172a" },
    subtitle:{ fontSize:13, color:"#64748b" },
    row:{ display:"flex", gap:10, alignItems:"center", flexWrap:"wrap" },
    input:{ width:"100%", padding:"10px 12px", border:"1px solid #d1d5db", borderRadius:10, outline:"none" },
    select:{ width:"100%", padding:"10px 12px", border:"1px solid #d1d5db", borderRadius:10, outline:"none" },
    btn:(kind="primary")=>{
      const map = {
        primary:{ background:"#2563eb", border:"#2563eb", color:"#fff" },
        ghost:{ background:"#fff", border:"#d1d5db", color:"#111827" },
        success:{ background:"#16a34a", border:"#16a34a", color:"#fff" },
        muted:{ background:"#e5e7eb", border:"#d1d5db", color:"#6b7280" }
      }
      const x = map[kind] || map.primary
      return { padding:"10px 12px", borderRadius:12, border:`1px solid ${x.border}`, background:x.background, color:x.color, fontWeight:800, cursor:"pointer" }
    },
    list:{ display:"grid", gap:8, marginTop:10 },
    item:{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"10px", border:"1px solid #e5e7eb", borderRadius:12, background:"#fff" },
    meta:{ fontSize:12, color:"#64748b" },
    tag:(ok=true)=>({
      display:"inline-flex", padding:"2px 8px", borderRadius:999, fontSize:12, fontWeight:700,
      border:"1px solid #d1d5db",
      background: ok ? "#dcfce7" : "#fee2e2",
      color: ok ? "#065f46" : "#7f1d1d"
    }),
    ok:{ color:"#065f46", fontSize:13 }, err:{ color:"#b91c1c", fontSize:13 },
    small:{ fontSize:12, color:"#64748b" },
    kpiBox:{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))", gap:10, marginTop:10 },
    kpi:{ padding:12, border:"1px solid #e5e7eb", borderRadius:12, background:"#f8fafc" },
    kpiVal:{ fontSize:22, fontWeight:900, color:"#0f172a" }, kpiLbl:{ fontSize:12, color:"#64748b" }
  }),[])

  // Estado
  const [elections, setElections] = useState([])
  const [selElection, setSelElection] = useState("")
  const [query, setQuery] = useState("")
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState("")
  const [error, setError] = useState("")
  const [padron, setPadron] = useState({ total:0, asistieron:0, pct:0 })

  // Mapa de asistencia para los resultados visibles: { [member_id]: { id, present } }
  const [attMap, setAttMap] = useState({})

  // Form crear miembro rápido
  const [newMember, setNewMember] = useState({ full_name:"", cedula:"", sex:"" })

  // Fecha y tipo de jornada
  const [attDate, setAttDate] = useState(() => {
    const d = new Date()
    const y = d.getFullYear(), m = String(d.getMonth()+1).padStart(2,'0'), day = String(d.getDate()).padStart(2,'0')
    return `${y}-${m}-${day}`
  })
  const [sessionKind, setSessionKind] = useState("practica") // 'practica' | 'final'

  // Init: cargar elecciones y seleccionar la abierta si existe
  useEffect(()=>{ (async ()=>{
    setLoading(true); setError(""); setMsg("")
    const { data, error } = await supabase
      .from("election")
      .select("id,title,status,opened_at,closed_at,created_at")
      .order("created_at",{ ascending:false })
    if (error){ setError("No se pudieron cargar las elecciones."); setLoading(false); return }
    setElections(data || [])
    const open = (data || []).find(e => e.status === "abierta")
    setSelElection(open?.id || data?.[0]?.id || "")
    setLoading(false)
  })() },[])

  useEffect(()=>{ if (selElection) refreshKPIs() },[selElection])

  // KPIs participación (globales)
  async function refreshKPIs(){
    try {
      const tot = await supabase
        .from("member")
        .select("id", { count:"exact", head:true })
        .eq("is_active", true)

      const asist = await supabase
        .from("attendance_voter")
        .select("id", { count:"exact", head:true })
        .eq("election_id", selElection)

      const total = tot.count ?? 0
      const asistieron = asist.count ?? 0
      const pct = total ? Math.round((asistieron/total)*100) : 0
      setPadron({ total, asistieron, pct })
    } catch (e) {
      console.error(e)
    }
  }

  // Cargar asistencia para los resultados mostrados
  async function refreshAttendanceForResults(list){
    try{
      if (!selElection || !attDate || !list?.length){ setAttMap({}); return }
      const ids = list.map(x => x.id)
      const { data, error } = await supabase
        .from("attendance_voter")
        .select("id, member_id, present")
        .eq("election_id", selElection)
        .eq("session_kind", sessionKind)
        .eq("attended_on", attDate)
        .in("member_id", ids)
      if (error) throw error
      const map = {}
      for (const r of (data||[])) {
        map[r.member_id] = { id: r.id, present: r.present }
      }
      setAttMap(map)
    } catch(e){
      console.error("[attendance.refresh]", e)
      setAttMap({})
    }
  }

  // Buscar miembro (por cédula o nombre)
  async function search(){
    if (!query.trim()){ setResults([]); setAttMap({}); return }
    setBusy(true); setError(""); setMsg("")
    const q = query.trim()
    let req = supabase.from("member").select("id,full_name,cedula,sex,is_active").limit(20)

    // Busca por cédula y cedula_norm si parece num/cédula; si no, por nombre
    if (/^[a-z0-9\-\s]+$/i.test(q)){
      const norm = normalizeCedulaLocal(q)
      req = req.or(`cedula.ilike.%${q}%,cedula_norm.ilike.%${norm}%`)
    } else {
      req = req.ilike("full_name", `%${q}%`)
    }

    const { data, error } = await req
    setBusy(false)
    if (error){ setError("Error buscando miembros."); console.error(error); setResults([]); setAttMap({}); return }

    setResults(data || [])
    await refreshAttendanceForResults(data || [])
  }

  // Cuando cambien filtros (elección/fecha/jornada) y haya resultados, refresca la asistencia
  useEffect(()=>{
    if (results.length>0) { refreshAttendanceForResults(results) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selElection, attDate, sessionKind])

  // Activar miembro
  async function activateMember(memberId){
    setBusy(true); setError(""); setMsg("")
    const { error } = await supabase.from("member").update({ is_active: true }).eq("id", memberId)
    setBusy(false)
    if (error){ setError("No se pudo activar al miembro."); console.error(error); return }
    setMsg("✅ Miembro activado")
    setResults(prev => prev.map(r => r.id === memberId ? { ...r, is_active: true } : r))
    refreshKPIs()
  }

  // Marcar asistencia (idempotente y con feedback “ya tenía asistencia”)
  async function checkIn(memberId){
    if (!selElection){ setError("Selecciona una elección."); return }
    if (!attDate){ setError("Selecciona la fecha de asistencia."); return }

    setBusy(true); setError(""); setMsg("")
    try {
      // ¿Ya existe para esta combinación?
      const { data: existing, error: selErr } = await supabase
        .from("attendance_voter")
        .select("id,present")
        .eq("election_id", selElection)
        .eq("member_id", memberId)
        .eq("session_kind", sessionKind)
        .eq("attended_on", attDate)
        .maybeSingle()
      if (selErr) throw selErr

      if (existing?.id){
        if (existing.present === true){
          setMsg("ℹ️ Ya tenía asistencia registrada.")
        } else {
          const { error: upErr } = await supabase
            .from("attendance_voter")
            .update({ present: true })
            .eq("id", existing.id)
          if (upErr) throw upErr
          setMsg("📝 Asistencia actualizada.")
        }
        // Refresca mapa local
        setAttMap(prev => ({ ...prev, [memberId]: { id: existing.id, present: true } }))
      } else {
        const { data: ins, error: insErr } = await supabase
          .from("attendance_voter")
          .insert({
            election_id: selElection,
            member_id: memberId,
            attended_on: attDate,
            session_kind: sessionKind,
            present: true
          })
          .select("id")
          .single()
        if (insErr) throw insErr
        setMsg("📝 Asistencia marcada.")
        setAttMap(prev => ({ ...prev, [memberId]: { id: ins.id, present: true } }))
      }

      refreshKPIs()
    } catch (e){
      console.error(e)
      setError("No se pudo marcar asistencia.")
    } finally {
      setBusy(false)
    }
  }

  // Crear miembro rápido (activo) y marcar asistencia
  async function createMemberAndCheckIn(){
    const { full_name, cedula, sex } = newMember
    if (!full_name.trim() || !cedula.trim()){
      setError("Nombre y cédula son obligatorios."); return
    }
    if (!selElection){ setError("Selecciona una elección."); return }
    if (!attDate){ setError("Selecciona la fecha de asistencia."); return }

    setBusy(true); setError(""); setMsg("")
    const cedula_norm = normalizeCedulaLocal(cedula)

    try {
      // Duplicado por cédula
      const dup = await supabase.from("member").select("id").eq("cedula_norm", cedula_norm).maybeSingle()
      if (dup.error && dup.error.code !== "PGRST116") { throw dup.error }
      if (dup.data) { setError("Ya existe un miembro con esa cédula."); setBusy(false); return }

      const { data, error } = await supabase
        .from("member")
        .insert({
          full_name: full_name.trim(),
          cedula: cedula.trim(),
          cedula_norm,
          sex: sex || null,
          is_active: true
        })
        .select("id,full_name,cedula,sex")
        .single()
      if (error) throw error

      // Asistencia
      const ins = await supabase
        .from("attendance_voter")
        .insert({
          election_id: selElection,
          member_id: data.id,
          attended_on: attDate,
          session_kind: sessionKind,
          present: true
        })
        .select("id,member_id")
        .single()
      if (ins.error) throw ins.error

      setMsg("✅ Miembro creado (activo) y asistencia marcada.")
      setNewMember({ full_name:"", cedula:"", sex:"" })
      setQuery(data.full_name)
      setResults([data])
      setAttMap({ [data.id]: { id: ins.data.id, present: true } })
      refreshKPIs()
    } catch (e){
      console.error(e)
      setError("No se pudo crear el miembro o marcar asistencia.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={s.page}>
      <div style={s.wrap}>
        <div style={s.head}>
          <div>
            <div style={s.title}>📝 Check-In / Asistencia</div>
            <div style={s.subtitle}>Activa miembros y marca asistencia para la elección seleccionada.</div>
          </div>
        </div>

        <div style={s.grid}>
          {/* IZQ: Búsqueda y acciones */}
          <div style={s.card}>
            <div style={s.row}>
              <div style={{flex:1, minWidth:220}}>
                <div style={{fontSize:13, fontWeight:700, marginBottom:6}}>Elección</div>
                <select style={s.select} value={selElection} onChange={(e)=> setSelElection(e.target.value)}>
                  {elections.map(e => (
                    <option key={e.id} value={e.id}>
                      {e.title} {e.status === "abierta" ? "(Abierta)" : e.status === "cerrada" ? "(Cerrada)" : "(Borrador)"}
                    </option>
                  ))}
                </select>
              </div>

              {/* Fecha de asistencia */}
              <div style={{minWidth:160}}>
                <div style={{fontSize:13, fontWeight:700, marginBottom:6}}>Fecha de asistencia</div>
                <input
                  type="date"
                  style={s.input}
                  value={attDate}
                  onChange={e=> setAttDate(e.target.value)}
                />
              </div>

              {/* Tipo de jornada */}
              <div style={{minWidth:160}}>
                <div style={{fontSize:13, fontWeight:700, marginBottom:6}}>Tipo de jornada</div>
                <select
                  style={s.select}
                  value={sessionKind}
                  onChange={e=> setSessionKind(e.target.value)}
                >
                  <option value="practica">Práctica</option>
                  <option value="final">Final</option>
                </select>
              </div>
            </div>

            <div style={{height:12}} />

            <div>
              <div style={{fontSize:13, fontWeight:700, marginBottom:6}}>Buscar (cédula o nombre)</div>
              <div style={s.row}>
                <input
                  style={s.input}
                  placeholder="Ej: 8-765-1234 o 'María'"
                  value={query}
                  onChange={(e)=> setQuery(e.target.value)}
                  onKeyDown={(e)=>{ if (e.key==="Enter") search() }}
                />
                <button style={s.btn("ghost")} onClick={search} disabled={!query || busy}>
                  {busy ? "Buscando…" : "Buscar"}
                </button>
              </div>

              {error && <div style={{marginTop:8, ...s.err}}>{error}</div>}
              {msg && <div style={{marginTop:8, ...s.ok}}>{msg}</div>}

              <div style={s.list}>
                {results.map(r => {
                  const att = attMap[r.id]
                  const hasAttendance = att?.present === true
                  return (
                    <div key={r.id} style={s.item}>
                      <div>
                        <div style={{fontWeight:800}}>{r.full_name}</div>
                        <div style={s.meta}>{r.cedula} · {r.sex || "—"}</div>
                        <div style={s.meta}>
                          Estado: <span style={{fontWeight:700}}>{r.is_active ? "Activo" : "Inactivo"}</span>
                          {" · "}
                          {hasAttendance
                            ? <span style={s.tag(true)}>Asistencia OK</span>
                            : <span style={s.tag(false)}>Sin asistencia</span>}
                        </div>
                      </div>
                      <div className="actions" style={s.row}>
                        {!r.is_active && (
                          <button style={s.btn("ghost")} onClick={()=> activateMember(r.id)}>Activar</button>
                        )}
                        <button
                          style={s.btn(hasAttendance ? "muted" : "success")}
                          onClick={()=> checkIn(r.id)}
                          disabled={!selElection || hasAttendance || busy}
                          title={hasAttendance ? "Ya tiene asistencia" : "Marcar asistencia"}
                        >
                          {hasAttendance ? "Ya tiene asistencia" : "Asistencia"}
                        </button>
                      </div>
                    </div>
                  )
                })}
                {query && results.length===0 && !busy && (
                  <div style={s.small}>No hay resultados con “{query}”. Puedes crear el miembro abajo.</div>
                )}
              </div>
            </div>

            <div style={{height:16}} />

            {/* Crear miembro rápido */}
            <div style={{borderTop:"1px solid #e5e7eb", paddingTop:12}}>
              <div style={{fontWeight:800, marginBottom:8}}>Crear miembro rápido</div>
              <div style={{display:"grid", gap:10, gridTemplateColumns:"1fr 1fr"}}>
                <input style={s.input} placeholder="Nombre completo"
                       value={newMember.full_name} onChange={(e)=> setNewMember(n=>({...n, full_name:e.target.value}))}/>
                <input style={s.input} placeholder="Cédula"
                       value={newMember.cedula} onChange={(e)=> setNewMember(n=>({...n, cedula:e.target.value}))}/>
              </div>
              <div style={{marginTop:8, display:"flex", gap:10}}>
                <select style={s.select} value={newMember.sex} onChange={(e)=> setNewMember(n=>({...n, sex:e.target.value}))}>
                  <option value="">Sexo (opcional)</option>
                  <option value="M">M</option>
                  <option value="F">F</option>
                </select>
                <button style={s.btn("primary")} onClick={createMemberAndCheckIn} disabled={busy || !selElection}>
                  {busy ? "Creando…" : "Crear + Asistencia"}
                </button>
              </div>
              <div style={s.small}>
                Se normaliza la cédula y el miembro queda <b>activo</b>. También se registra su asistencia
                (fecha y jornada seleccionadas).
              </div>
            </div>
          </div>

          {/* DER: KPIs de participación */}
          <div style={s.card}>
            <div style={s.head}>
              <div style={s.title}>Participación</div>
            </div>
            <div style={s.kpiBox}>
              <div style={s.kpi}><div style={s.kpiVal}>{padron.total}</div><div style={s.kpiLbl}>Miembros activos</div></div>
              <div style={s.kpi}><div style={s.kpiVal}>{padron.asistieron}</div><div style={s.kpiLbl}>Asistieron</div></div>
              <div style={s.kpi}><div style={s.kpiVal}>{padron.pct}%</div><div style={s.kpiLbl}>Participación</div></div>
            </div>
            <div style={{marginTop:12}}>
              <button style={s.btn("ghost")} onClick={refreshKPIs} disabled={!selElection}>Refrescar</button>
            </div>
            <div style={{marginTop:12, ...s.small}}>
              * Mide participación vs. miembros activos; si quieres filtrarlo por fecha/jornada lo hacemos enseguida.
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

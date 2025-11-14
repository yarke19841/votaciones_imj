import { useEffect, useMemo, useState } from "react"
import { supabase } from "../../lib/supabase.js"

function normalizeCedulaLocal(c){
  return (c ?? "").toUpperCase().replace(/[^A-Z0-9]+/g,"")
}

export default function AdminMemberList(){
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [msg, setMsg] = useState("")
  const [saving, setSaving] = useState(false)
  const [q, setQ] = useState("")

  const [form, setForm] = useState({
    cedula: "",
    first_name: "",
    last_name: "",
    sex: "F",
    notes: ""
  })

  // 👇 NUEVO: estado para editar solo la cédula
  const [editingId, setEditingId] = useState(null)      // id del miembro que se está editando
  const [editingCedula, setEditingCedula] = useState("")// cédula temporal
  const [editingSaving, setEditingSaving] = useState(false)

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
    badge:(active)=>({
      display:"inline-flex", padding:"2px 8px", borderRadius:999, fontSize:12, fontWeight:700,
      border:"1px solid #d1d5db",
      background: active ? "#dcfce7" : "#fee2e2",
      color: active ? "#065f46" : "#7f1d1d"
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
        background:x.background, color:x.color, fontWeight:700, cursor:"pointer", fontSize:13
      }
    },
    err:{ color:"#e11d48", fontSize:13, marginTop:8 },
    ok:{ color:"#065f46", fontSize:13, marginTop:8 },
  }

  useEffect(()=>{ load() },[])

  // Carga miembros
  async function load(){
    try {
      setLoading(true); setError(""); setMsg("")
      let { data, error } = await supabase
        .from("member")
        .select("id, cedula, cedula_norm, first_name, last_name, full_name, sex, is_active, notes, created_at")

      if (error) {
        // fallback si no hay full_name
        const resp2 = await supabase.from("member").select("*")
        if (resp2.error) throw resp2.error
        data = resp2.data
      }

      // Asegura mostrar full_name aunque no exista en la tabla
      const rowsWithFullName = (data || []).map(r => ({
        ...r,
        full_name: r.full_name || `${r.first_name ?? ""} ${r.last_name ?? ""}`.trim()
      }))

      // Ordenar por fecha o id
      const sorted = rowsWithFullName.sort((a, b) => {
        if (a.created_at && b.created_at) return (a.created_at < b.created_at) ? 1 : -1
        return (a.id < b.id) ? 1 : -1
      })

      setRows(sorted)
    } catch (e) {
      console.error("[member.load]", e)
      setError(e.message || "No se pudo cargar el listado.")
      setRows([])
    } finally {
      setLoading(false)
    }
  }

  // Crear miembro
  async function createMember(e){
    e.preventDefault()
    setError(""); setMsg(""); setSaving(true)

    const cedula = form.cedula.trim()
    const first_name = form.first_name.trim()
    const last_name = form.last_name.trim()
    const full_name = `${first_name} ${last_name}`.trim()
    const sex = (form.sex || "").toUpperCase() === "M" ? "M" : "F"

    if (!cedula || !first_name || !last_name){
      setError("Cédula, nombre y apellido son requeridos.")
      setSaving(false); return
    }

    const cedula_norm = normalizeCedulaLocal(cedula)
    const payload = {
      cedula,
      cedula_norm,
      first_name,
      last_name,
      full_name,
      sex,
      notes: form.notes?.trim() || null,
      is_active: true
    }

    try {
      // Verifica duplicado
      const { data: dup, error: dupErr } = await supabase
        .from("member")
        .select("id")
        .eq("cedula_norm", cedula_norm)
        .maybeSingle()
      if (dupErr) throw dupErr
      if (dup) { setError("Ya existe un miembro con esa cédula."); setSaving(false); return }

      // Inserta
      const { error: insErr } = await supabase.from("member").insert(payload)
      if (insErr) throw insErr

      setMsg("Miembro creado correctamente.")
      setForm({ cedula:"", first_name:"", last_name:"", sex:"F", notes:"" })
      await load()
    } catch (e) {
      console.error("[member.create]", e)
      setError(e.message || "No se pudo crear el miembro.")
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive(row){
    try {
      const { error } = await supabase
        .from("member")
        .update({ is_active: !row.is_active })
        .eq("id", row.id)
      if (error) throw error
      setMsg("Estado actualizado.")
      await load()
    } catch (e) {
      setError(e.message || "No se pudo actualizar el estado.")
    }
  }

  async function remove(row){
    if (!confirm("¿Eliminar este miembro?")) return
    try {
      const { error } = await supabase.from("member").delete().eq("id", row.id)
      if (error) throw error
      setMsg("Miembro eliminado.")
      await load()
    } catch (e) {
      setError(e.message || "No se pudo eliminar.")
    }
  }

  // 👉 NUEVO: iniciar edición de cédula
  function startEditCedula(row){
    setEditingId(row.id)
    setEditingCedula(row.cedula || "")
    setError("")
    setMsg("")
  }

  // 👉 NUEVO: cancelar edición
  function cancelEditCedula(){
    setEditingId(null)
    setEditingCedula("")
  }

  // 👉 NUEVO: guardar nueva cédula
  async function saveCedula(row){
    const cedula = (editingCedula || "").trim()
    if (!cedula){
      setError("La cédula no puede estar vacía.")
      return
    }

    const newNorm = normalizeCedulaLocal(cedula)
    const oldNorm = row.cedula ? normalizeCedulaLocal(row.cedula) : row.cedula_norm || null

    try {
      setEditingSaving(true)
      setError("")
      setMsg("")

      // Si cambió la cédula normalizada, validar duplicados
      if (newNorm !== oldNorm) {
        const { data: dup, error: dupErr } = await supabase
          .from("member")
          .select("id")
          .eq("cedula_norm", newNorm)
          .neq("id", row.id)
          .maybeSingle()
        if (dupErr) throw dupErr
        if (dup) {
          setError("Ya existe un miembro con esa cédula.")
          setEditingSaving(false)
          return
        }
      }

      const payload = {
        cedula,
        cedula_norm: newNorm
      }

      const { error: upErr } = await supabase
        .from("member")
        .update(payload)
        .eq("id", row.id)

      if (upErr) throw upErr

      // Actualizar en memoria
      setRows(prev =>
        prev.map(r => r.id === row.id ? { ...r, ...payload } : r)
      )

      setMsg("Cédula actualizada correctamente.")
      setEditingId(null)
      setEditingCedula("")
    } catch (e) {
      console.error("[member.updateCedula]", e)
      setError(e.message || "No se pudo actualizar la cédula.")
    } finally {
      setEditingSaving(false)
    }
  }

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase()
    if (!t) return rows
    return rows.filter(r =>
      `${r.full_name ?? ""}`.toLowerCase().includes(t) ||
      (r.cedula || "").toLowerCase().includes(t)
    )
  }, [rows, q])

  return (
    <div style={s.page}>
      <div style={s.wrap}>

        {/* ====== CREAR MIEMBRO (ARRIBA) ====== */}
        <div style={{...s.card, marginBottom:16}}>
          <div style={s.headerRow}>
            <div style={s.headerTitle}>Crear miembro</div>
          </div>
          <form style={s.cardBody} onSubmit={createMember}>
            <div>
              <div style={s.label}>Cédula *</div>
              <input
                style={s.input}
                value={form.cedula}
                onChange={e=>{ setForm(v=>({...v, cedula:e.target.value})); setError(""); setMsg(""); }}
                placeholder="8-123-456"
                autoFocus
              />
            </div>
            <div style={s.row2}>
              <div>
                <div style={s.label}>Nombre *</div>
                <input
                  style={s.input}
                  value={form.first_name}
                  onChange={e=>{ setForm(v=>({...v, first_name:e.target.value})); setError(""); setMsg(""); }}
                />
              </div>
              <div>
                <div style={s.label}>Apellido *</div>
                <input
                  style={s.input}
                  value={form.last_name}
                  onChange={e=>{ setForm(v=>({...v, last_name:e.target.value})); setError(""); setMsg(""); }}
                />
              </div>
            </div>
            <div style={s.row2}>
              <div>
                <div style={s.label}>Sexo *</div>
                <select
                  style={s.input}
                  value={form.sex}
                  onChange={e=>{ setForm(v=>({...v, sex:e.target.value})); setError(""); setMsg(""); }}
                >
                  <option value="F">F</option>
                  <option value="M">M</option>
                </select>
              </div>
              <div>
                <div style={s.label}>Notas (opcional)</div>
                <input
                  style={s.input}
                  value={form.notes}
                  onChange={e=>{ setForm(v=>({...v, notes:e.target.value})); setError(""); setMsg(""); }}
                  placeholder="Observaciones"
                />
              </div>
            </div>

            <div style={s.bar}>
              <button type="submit" style={s.btn("primary")} disabled={saving}>
                {saving ? "Creando…" : "Crear"}
              </button>
              <button type="button" style={s.btn("ghost")} onClick={()=>{
                setForm({cedula:"",first_name:"",last_name:"",sex:"F",notes:""})
                setError(""); setMsg("")
              }}>
                Limpiar
              </button>
            </div>

            {error && <div style={s.err}>{error}</div>}
            {msg && <div style={s.ok}>{msg}</div>}
          </form>
        </div>

        {/* ====== LISTADO DE MIEMBROS (ABAJO) ====== */}
        <div style={s.card}>
          <div style={s.headerRow}>
            <div style={s.headerTitle}>Miembros ({rows.length})</div>
            <div style={{display:"flex", gap:8}}>
              <input
                style={s.input}
                placeholder="Buscar por nombre o cédula…"
                value={q}
                onChange={e=>setQ(e.target.value)}
              />
              <button onClick={load} style={s.btn("ghost")}>Actualizar</button>
            </div>
          </div>

          <div style={s.cardBody}>
            {loading ? "Cargando…" :
             error && !msg ? <div style={s.err}>{error}</div> :
             filtered.length === 0 ? "Sin coincidencias." :
             <div style={s.grid}>
               {filtered.map(r => {
                 const isEditing = editingId === r.id
                 return (
                   <div key={r.id} style={s.item}>
                     <div style={{display:"flex", justifyContent:"space-between", alignItems:"center"}}>
                       <div style={{fontWeight:800}}>{r.full_name || "—"}</div>
                       <span style={s.badge(r.is_active)}>{r.is_active ? "Activo" : "Inactivo"}</span>
                     </div>

                     {/* Cédula: ahora editable */}
                     <div style={s.meta}>
                       Cédula:{" "}
                       {isEditing ? (
                         <input
                           style={{...s.input, marginTop:4, padding:"6px 8px", fontSize:12}}
                           value={editingCedula}
                           onChange={e=>setEditingCedula(e.target.value)}
                           placeholder="8-123-456"
                         />
                       ) : (
                         r.cedula ?? "—"
                       )}
                     </div>

                     <div style={s.meta}>Sexo: {r.sex ?? "—"}</div>
                     {r.notes && <div style={{fontSize:12, color:"#4b5563", marginTop:6}}>{r.notes}</div>}

                     <div style={{display:"flex", gap:8, marginTop:10, flexWrap:"wrap"}}>
                       {isEditing ? (
                         <>
                           <button
                             style={s.btn("primary")}
                             onClick={()=>saveCedula(r)}
                             disabled={editingSaving}
                           >
                             {editingSaving ? "Guardando…" : "Guardar cédula"}
                           </button>
                           <button
                             style={s.btn("ghost")}
                             onClick={cancelEditCedula}
                             disabled={editingSaving}
                           >
                             Cancelar
                           </button>
                         </>
                       ) : (
                         <>
                           <button
                             style={s.btn("primary")}
                             onClick={()=>startEditCedula(r)}
                           >
                             Editar cédula
                           </button>
                           <button style={s.btn("ghost")} onClick={()=>toggleActive(r)}>
                             {r.is_active ? "Desactivar" : "Activar"}
                           </button>
                           <button style={s.btn("danger")} onClick={()=>remove(r)}>Eliminar</button>
                         </>
                       )}
                     </div>
                   </div>
                 )
               })}
             </div>
            }
          </div>
        </div>

      </div>
    </div>
  )
}

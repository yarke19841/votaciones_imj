// src/pages/admin/AdminElectionList.jsx
import { useEffect, useMemo, useState } from "react"
import { supabase } from "../../lib/supabase"

export default function AdminElectionList(){
  const [rows, setRows]       = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState("")
  const [msg, setMsg]         = useState("")

  const [saving, setSaving]   = useState(false)

  // Elección seleccionada (null = modo crear)
  const [selectedId, setSelectedId] = useState(null)

  const [form, setForm] = useState({
    title: "",
    required_male: 0,
    required_female: 0,
    notes: "",
    status: "borrador",
    opened_at: null,
    closed_at: null,
    created_at: null,
  })

  const isCreateMode = !selectedId

  const s = useMemo(() => {
    const card = {
      background:"#fff",
      border:"1px solid #e5e7eb",
      borderRadius:16,
      boxShadow:"0 8px 24px rgba(15,23,42,.06)",
    }
    return {
      page:{ fontFamily:"system-ui,-apple-system,Segoe UI,Roboto", background:"#f3f4f6", minHeight:"100vh" },
      wrap:{ maxWidth:1100, margin:"0 auto", padding:"24px 16px", display:"flex", flexDirection:"column", gap:16 },

      card,
      headerRow:{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"14px 16px", borderBottom:"1px solid #e5e7eb" },
      headerTitle:{ fontWeight:800, fontSize:18 },
      subHeader:{ fontSize:12, color:"#6b7280", marginTop:2 },
      cardBody:{ padding:16 },

      table:{ width:"100%", borderCollapse:"collapse", fontSize:14 },
      th:{ textAlign:"left", padding:"8px 6px", borderBottom:"1px solid #e5e7eb", color:"#6b7280", fontWeight:600 },
      td:{ padding:"8px 6px", borderBottom:"1px solid #e5e7eb", cursor:"pointer" },

      rowActive:{ background:"#eff6ff" },

      statusBadge:(status)=>{
        const st = (status || "").toLowerCase()
        let bg="#f1f5f9", color="#0f172a", border="#e2e8f0", text="Borrador"
        if (st === "abierta"){
          bg="#ecfdf5"; color="#065f46"; border="#6ee7b7"; text="Abierta"
        } else if (st === "cerrada"){
          bg="#fef2f2"; color:"#b91c1c"; border:"#fecaca"; text="Cerrada"
        }
        return {
          style:{
            display:"inline-flex", padding:"2px 8px", borderRadius:999,
            fontSize:12, fontWeight:700, background:bg, color, border:`1px solid ${border}`
          },
          text
        }
      },

      btnPrimary:{
        display:"inline-flex", alignItems:"center", justifyContent:"center",
        padding:"8px 14px", borderRadius:10, border:"1px solid #2563eb",
        background:"#2563eb", color:"#fff", fontSize:13, fontWeight:700,
        textDecoration:"none", cursor:"pointer"
      },
      btnGhost:{
        display:"inline-flex", alignItems:"center", justifyContent:"center",
        padding:"8px 10px", borderRadius:10, border:"1px solid #d1d5db",
        background:"#fff", color:"#111827", fontSize:12, fontWeight:600,
        cursor:"pointer"
      },

      label:{ display:"block", fontSize:13, fontWeight:600, color:"#374151", marginBottom:4 },
      hint:{ fontSize:11, color:"#6b7280", marginTop:2 },
      input:{ width:"100%", padding:"10px 12px", border:"1px solid #d1d5db", borderRadius:10, outline:"none", fontSize:14, background:"#fff" },
      ta:{ width:"100%", minHeight:80, padding:"10px 12px", border:"1px solid #d1d5db", borderRadius:10, outline:"none", fontSize:14, resize:"vertical" },
      row2:{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 },

      sticky:{ marginTop:14, display:"flex", gap:10, flexWrap:"wrap", alignItems:"center" },
      muted:{ fontSize:12, color:"#6b7280" },
      err:{ color:"#b91c1c", fontSize:13, marginTop:8 },
      ok:{ color:"#047857", fontSize:13, marginTop:8 },

      toastOK:{ position:"fixed", right:18, bottom:18, background:"#16a34a", color:"#fff",
        padding:"10px 14px", borderRadius:12, fontWeight:700, boxShadow:"0 8px 24px rgba(0,0,0,.15)" },
      toastERR:{ position:"fixed", right:18, bottom:18, background:"#dc2626", color:"#fff",
        padding:"10px 14px", borderRadius:12, fontWeight:700, boxShadow:"0 8px 24px rgba(0,0,0,.15)" },
    }
  }, [])

  const [toast, setToast] = useState({ type:"", text:"" })
  const showToast = (type, text) => {
    setToast({ type, text })
    setTimeout(() => setToast({ type:"", text:"" }), 1800)
  }

  const isClosed = !isCreateMode && (
    (form.status || "").toLowerCase() === "cerrada" || !!form.closed_at
  )
  const isOpen = !isCreateMode &&
    (form.status || "").toLowerCase() === "abierta" &&
    !form.closed_at
  const isReadOnly = isClosed

  useEffect(() => {
    load()
  }, [])

  async function load(){
    try {
      setLoading(true)
      setError("")
      setMsg("")
      const { data, error } = await supabase
        .from("election")
        .select("id,title,required_male,required_female,created_at,opened_at,closed_at,status,notes")
        .order("created_at", { ascending:false })
      if (error) throw error
      setRows(data || [])

      // Si hay selección, refrescamos el form según la fila actual
      if (selectedId) {
        const found = (data || []).find(r => r.id === selectedId)
        if (found) fillFormFromRow(found)
        else clearForm()
      }
    } catch (e) {
      console.error(e)
      setError("No se pudo cargar el listado.")
    } finally {
      setLoading(false)
    }
  }

  function fillFormFromRow(r){
    setSelectedId(r.id)
    setForm({
      title: r.title ?? "",
      required_male: r.required_male ?? 0,
      required_female: r.required_female ?? 0,
      notes: r.notes ?? "",
      status: r.status ?? "borrador",
      opened_at: r.opened_at,
      closed_at: r.closed_at,
      created_at: r.created_at,
    })
  }

  function clearForm(){
    setSelectedId(null)
    setForm({
      title:"",
      required_male:0,
      required_female:0,
      notes:"",
      status:"borrador",
      opened_at:null,
      closed_at:null,
      created_at:null,
    })
  }

  function handleRowClick(r){
    fillFormFromRow(r)
  }

  function handleChange(e){
    const { name, value } = e.target
    if (isReadOnly) return
    setForm(f => ({
      ...f,
      [name]: name.startsWith("required_")
        ? Math.max(0, Number(value ?? 0))
        : value
    }))
  }

  async function handleSave(){
    if (isReadOnly) {
      showToast("err","La elección está cerrada. No se puede modificar.")
      return
    }

    setSaving(true)
    setError("")
    const title = form.title.trim()
    if (!title){
      setSaving(false)
      setError("El título es obligatorio.")
      showToast("err","Agrega un título a la elección.")
      return
    }

    try {
      if (isCreateMode){
        // Insert
        const { data, error } = await supabase
          .from("election")
          .insert({
            title,
            required_male: Number(form.required_male) || 0,
            required_female: Number(form.required_female) || 0,
            notes: form.notes || "",
            status: "borrador"
          })
          .select("id, title, required_male, required_female, created_at, opened_at, closed_at, status, notes")
          .single()
        if (error) throw error

        setRows(prev => [data, ...prev])
        fillFormFromRow(data)
        showToast("ok","Elección creada.")
      } else {
        // Update
        const { error } = await supabase
          .from("election")
          .update({
            title,
            required_male: Number(form.required_male) || 0,
            required_female: Number(form.required_female) || 0,
            notes: form.notes
          })
          .eq("id", selectedId)
        if (error) throw error

        await load()
        showToast("ok","Cambios guardados.")
      }
    } catch (e) {
      console.error(e)
      setError("No se pudo guardar.")
      showToast("err","Error al guardar.")
    } finally {
      setSaving(false)
    }
  }

  async function toggleOpenClose(){
    if (isCreateMode){
      showToast("err","Primero guarda la elección.")
      return
    }
    if (isClosed){
      showToast("err","La elección está cerrada y no se puede reabrir.")
      return
    }

    setSaving(true)
    setError("")
    try {
      if (!isOpen){
        const { error } = await supabase
          .from("election")
          .update({
            status: "abierta",
            opened_at: form.opened_at ?? new Date().toISOString(),
            closed_at: null
          })
          .eq("id", selectedId)
        if (error) throw error
        showToast("ok","✅ Votación abierta.")
      } else {
        const { error } = await supabase
          .from("election")
          .update({
            status: "cerrada",
            closed_at: new Date().toISOString()
          })
          .eq("id", selectedId)
        if (error) throw error
        showToast("ok","🛑 Votación cerrada.")
      }
      await load()
    } catch (e) {
      console.error(e)
      setError("No se pudo actualizar el estado.")
      showToast("err","Error al cambiar estado.")
    } finally {
      setSaving(false)
    }
  }

  const currentStatusBadge = s.statusBadge(form.status)

  return (
    <div style={s.page}>
      <div style={s.wrap}>

        {/* 1) FORMULARIO ARRIBA */}
        <div style={s.card}>
          <div style={s.headerRow}>
            <div>
              <div style={s.headerTitle}>
                {isCreateMode ? "Nueva elección" : "Configurar elección"}
              </div>
              <div style={s.subHeader}>
                {isCreateMode
                  ? "Rellena los datos y guarda para crear el proceso."
                  : (
                    <>
                      ID: {selectedId} · Estado:{" "}
                      <span style={{...currentStatusBadge.style, marginLeft:4}}>
                        {currentStatusBadge.text}
                      </span>
                    </>
                  )}
              </div>
            </div>
            <div>
              <button
                type="button"
                style={s.btnGhost}
                onClick={clearForm}
              >
                New
              </button>
            </div>
          </div>

          <div style={s.cardBody}>
            {isClosed && !isCreateMode && (
              <div style={s.err}>
                Esta elección está <b>cerrada</b>. Solo puedes verla; no se puede modificar ni reabrir.
              </div>
            )}

            <div style={{marginBottom:10}}>
              <label style={s.label}>Título</label>
              <input
                name="title"
                value={form.title}
                onChange={handleChange}
                placeholder="Elección de Diáconos 2025"
                style={s.input}
                disabled={isReadOnly}
              />
              <div style={s.hint}>Nombre visible en la boleta y en los resultados.</div>
            </div>

            <div style={{...s.row2, marginBottom:10}}>
              <div>
                <label style={s.label}>Cupo Hombres</label>
                <input
                  type="number"
                  name="required_male"
                  value={form.required_male}
                  onChange={handleChange}
                  style={s.input}
                  disabled={isReadOnly}
                  min={0}
                />
                <div style={s.hint}>Cantidad de hombres a elegir.</div>
              </div>
              <div>
                <label style={s.label}>Cupo Mujeres</label>
                <input
                  type="number"
                  name="required_female"
                  value={form.required_female}
                  onChange={handleChange}
                  style={s.input}
                  disabled={isReadOnly}
                  min={0}
                />
                <div style={s.hint}>Cantidad de mujeres a elegir.</div>
              </div>
            </div>

            <div style={{marginBottom:10}}>
              <label style={s.label}>Notas pastorales</label>
              <textarea
                name="notes"
                value={form.notes}
                onChange={handleChange}
                style={s.ta}
                placeholder="Indicaciones, requisitos, observaciones internas…"
                disabled={isReadOnly}
              />
              <div style={s.hint}>No se muestran a los votantes (solo para el equipo pastoral).</div>
            </div>

            <div style={s.sticky}>
              <button
                type="button"
                style={s.btnPrimary}
                onClick={handleSave}
                disabled={saving || isReadOnly}
                title={isReadOnly ? "Elección cerrada: no se puede modificar" : ""}
              >
                {saving
                  ? (isCreateMode ? "Creando…" : "Guardando…")
                  : (isCreateMode ? "Crear elección" : "Guardar cambios")}
              </button>

              <button
                type="button"
                style={s.btnGhost}
                onClick={toggleOpenClose}
                disabled={saving || isCreateMode || isClosed}
                title={
                  isCreateMode
                    ? "Primero guarda la elección"
                    : isClosed
                    ? "Elección cerrada definitivamente"
                    : ""
                }
              >
                {isClosed
                  ? "Cerrada"
                  : (isOpen ? "Cerrar votación" : "Abrir votación")}
              </button>

              {!isCreateMode && (
                <span style={s.muted}>
                  {form.opened_at && <>Abierta desde <b>{new Date(form.opened_at).toLocaleString()}</b></>}
                  {form.closed_at && <> · Cerrada el <b>{new Date(form.closed_at).toLocaleString()}</b></>}
                </span>
              )}
            </div>

            {error && <div style={s.err}>{error}</div>}
            {msg && <div style={s.ok}>{msg}</div>}
          </div>
        </div>

        {/* 2) LISTADO ABAJO */}
        <div style={s.card}>
          <div style={s.headerRow}>
            <div>
              <div style={s.headerTitle}>Listado de elecciones</div>
              <div style={s.subHeader}>
                Haz clic en una fila para cargarla en el formulario de arriba.
              </div>
            </div>
            <div>
              <button type="button" style={s.btnGhost} onClick={load}>
                Actualizar
              </button>
            </div>
          </div>

          <div style={s.cardBody}>
            {loading && <div>Cargando…</div>}
            {error && <div style={s.err}>{error}</div>}
            {!loading && !error && rows.length === 0 && (
              <div style={{fontSize:14, color:"#6b7280"}}>
                No hay elecciones aún. Crea una arriba con el formulario.
              </div>
            )}

            {!loading && !error && rows.length > 0 && (
              <table style={s.table}>
                <thead>
                  <tr>
                    <th style={s.th}>Título</th>
                    <th style={s.th}>Cupos</th>
                    <th style={s.th}>Estado</th>
                    <th style={s.th}>Creada</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(r => {
                    const badge = s.statusBadge(r.status)
                    const isActive = selectedId === r.id
                    return (
                      <tr
                        key={r.id}
                        onClick={() => handleRowClick(r)}
                        style={isActive ? s.rowActive : undefined}
                      >
                        <td style={s.td}>{r.title}</td>
                        <td style={s.td}>
                          {r.required_male ?? 0} H / {r.required_female ?? 0} M
                        </td>
                        <td style={s.td}>
                          <span style={badge.style}>{badge.text}</span>
                        </td>
                        <td style={s.td}>
                          {r.created_at && new Date(r.created_at).toLocaleDateString()}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Toasts */}
        {!!toast.text && (
          <div style={toast.type === "ok" ? s.toastOK : s.toastERR}>
            {toast.text}
          </div>
        )}
      </div>
    </div>
  )
}


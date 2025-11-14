// src/pages/admin/AdminElectionConfig.jsx
import { useEffect, useMemo, useState, useCallback } from "react"
import { useParams, Link } from "react-router-dom"
import { supabase } from "../../lib/supabase"

export default function AdminElectionConfig() {
  const { id } = useParams()

  // ---------- Estilos ----------
  const s = useMemo(() => {
    const card = {
      background:"#fff",
      border:"1px solid #e5e7eb",
      borderRadius:16,
      padding:20,
      boxShadow:"0 6px 24px rgba(15,23,42,0.06)"
    }
    const inputBase = {
      width:"100%", padding:"12px 14px", fontSize:14, borderRadius:10,
      border:"1px solid #d1d5db", background:"#fff",
      outline:"none", transition:"box-shadow .15s, border-color .15s"
    }
    const focusable = (err=false)=>({
      ...inputBase,
      border: `1px solid ${err ? "#ef4444" : "#d1d5db"}`,
      boxShadow: err ? "0 0 0 4px rgba(239,68,68,.12)" : "none"
    })
    return {
      page:{ fontFamily:"system-ui,-apple-system,Segoe UI,Roboto",
        background:"linear-gradient(180deg,#f8fafc, #f3f4f6)", minHeight:"100vh" },
      wrap:{ maxWidth:1100, margin:"0 auto", padding:"24px 16px" },

      // Header
      head:{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16 },
      title:{ fontSize:22, fontWeight:800, color:"#0f172a" },
      crumb:{ fontSize:13, color:"#64748b" },
      badge:{ display:"inline-flex", alignItems:"center", gap:8, padding:"6px 12px",
        borderRadius:999, fontSize:12, border:"1px solid #e5e7eb", background:"#f8fafc", color:"#334155" },
      badgeGreen:{ background:"#ecfdf5", color:"#065f46", border:"1px solid #a7f3d0" },
      badgeRed:{ background:"#fef2f2", color:"#991b1b", border:"1px solid #fecaca" },
      badgeGray:{ background:"#f1f5f9", color:"#334155", border:"1px solid #e2e8f0" },
      link:{ color:"#2563eb", textDecoration:"none" },

      // Layout
      grid2:{ display:"grid", gridTemplateColumns:"1.25fr .75fr", gap:16 },
      card,

      h:{ fontSize:16, fontWeight:800, color:"#0f172a", marginBottom:10 },
      label:{ display:"block", fontSize:13, color:"#334155", marginBottom:6, fontWeight:600 },
      hint:{ fontSize:12, color:"#64748b", marginTop:6 },
      row2:{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 },

      input: inputBase,
      focus: focusable(),

      // KPIs
      kpis:{ display:"grid", gap:12, gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))" },
      kpi:{ padding:"14px", borderRadius:12, border:"1px solid #e5e7eb", background:"#f8fafc" },
      kpiVal:{ fontSize:22, fontWeight:900, color:"#0f172a" },
      kpiLbl:{ fontSize:12, color:"#64748b", marginTop:2 },

      // Actions sticky
      sticky:{ position:"sticky", bottom:12, marginTop:14, display:"flex", gap:10, alignItems:"center",
        background:"transparent", padding:"0", flexWrap:"wrap" },

      btn:{ padding:"10px 14px", borderRadius:12, border:"1px solid #d1d5db", background:"#fff",
        cursor:"pointer", fontSize:14, fontWeight:700, color:"#0f172a" },
      btnPrimary:{ padding:"10px 14px", borderRadius:12, border:"1px solid #2563eb",
        background:"#2563eb", color:"#fff", cursor:"pointer", fontSize:14, fontWeight:800 },
      btnDanger:{ padding:"10px 14px", borderRadius:12, border:"1px solid #ef4444",
        background:"#ef4444", color:"#fff", cursor:"pointer", fontSize:14, fontWeight:800 },

      // Alerts
      muted:{ fontSize:13, color:"#64748b" },
      err:{ background:"#fef2f2", border:"1px solid #fecaca", color:"#991b1b",
        padding:12, borderRadius:10, fontSize:14, marginBottom:12 },
      toastOK:{ position:"fixed", right:18, bottom:18, background:"#16a34a", color:"#fff",
        padding:"10px 14px", borderRadius:12, fontWeight:700, boxShadow:"0 8px 24px rgba(0,0,0,.15)" },
      toastERR:{ position:"fixed", right:18, bottom:18, background:"#dc2626", color:"#fff",
        padding:"10px 14px", borderRadius:12, fontWeight:700, boxShadow:"0 8px 24px rgba(0,0,0,.15)" }
    }
  }, [])

  // ---------- Estado ----------
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [toast, setToast] = useState({ type:"", text:"" })

  const [form, setForm] = useState({
    title: "", required_male: 0, required_female: 0, notes: "",
    opened_at: null, closed_at: null, created_at: null, status: null
  })
  const [counts, setCounts] = useState({ male:0, female:0, total:0 })

  // ---------- UI helpers ----------
  const statusBadge = useMemo(() => {
    const st = (form.status || "").toLowerCase()
    if (st === "abierta" && !form.closed_at) return { text:"Votación abierta", cls:s.badgeGreen }
    if (st === "cerrada" || form.closed_at) return { text:"Cerrada", cls:s.badgeRed }
    return { text:"Borrador", cls:s.badgeGray }
  }, [form.status, form.closed_at, s])

  const showToast = (type, text) => {
    setToast({ type, text })
    setTimeout(() => setToast({ type:"", text:"" }), 1800)
  }

  // ---------- Fetch ----------
  const fetchElection = useCallback(async () => {
    const { data, error } = await supabase
      .from("election")
      .select("id,title,required_male,required_female,notes,opened_at,closed_at,created_at,status")
      .eq("id", id)
      .single()
    if (error) { setError("No se pudo cargar la elección."); console.error(error); return }
    setForm({
      title: data.title ?? "",
      required_male: data.required_male ?? 0,
      required_female: data.required_female ?? 0,
      notes: data.notes ?? "",
      opened_at: data.opened_at,
      closed_at: data.closed_at,
      created_at: data.created_at,
      status: data.status ?? null
    })
  }, [id])

  const fetchCounts = useCallback(async () => {
    const m = await supabase.from("candidate").select("id", { count:"exact" }).eq("election_id", id).eq("gender","M")
    const f = await supabase.from("candidate").select("id", { count:"exact" }).eq("election_id", id).eq("gender","F")
    const t = await supabase.from("candidate").select("id", { count:"exact" }).eq("election_id", id)
    setCounts({ male: m.count ?? 0, female: f.count ?? 0, total: t.count ?? 0 })
  }, [id])

  useEffect(() => {
    let channel
    ;(async () => {
      setLoading(true)
      await fetchElection()
      await fetchCounts()
      setLoading(false)

      channel = supabase
        .channel(`candidate-changes-${id}`)
        .on(
          "postgres_changes",
          { event:"*", schema:"public", table:"candidate", filter:`election_id=eq.${id}` },
          () => fetchCounts()
        )
        .subscribe()
    })()
    return () => { if (channel) supabase.removeChannel(channel) }
  }, [id, fetchElection, fetchCounts])

  // ---------- Handlers ----------
  const handleChange = (e) => {
    const { name, value } = e.target
    setForm(f => ({
      ...f,
      [name]: name.startsWith("required_")
        ? Math.max(0, Number(value ?? 0))
        : value
    }))
  }

  const handleSave = async () => {
    setSaving(true); setError("")
    const { error } = await supabase
      .from("election")
      .update({
        title: form.title.trim(),
        required_male: Number(form.required_male) || 0,
        required_female: Number(form.required_female) || 0,
        notes: form.notes
      })
      .eq("id", id)
    setSaving(false)
    if (error) { setError("No se pudo guardar."); showToast("err","Error al guardar"); }
    else showToast("ok","Cambios guardados")
  }

  const isOpen = (form.status || "").toLowerCase() === "abierta" && !form.closed_at

  const toggleOpenClose = async () => {
    setSaving(true); setError("")
    try {
      if (!isOpen) {
        // ABRIR VOTACIÓN
        const { error } = await supabase
          .from("election")
          .update({
            status: "abierta",
            opened_at: form.opened_at ?? new Date().toISOString(),
            closed_at: null
          })
          .eq("id", id)
        if (error) throw error
        showToast("ok","✅ Votación abierta")
      } else {
        // CERRAR VOTACIÓN
        const { error } = await supabase
          .from("election")
          .update({
            status: "cerrada",
            closed_at: new Date().toISOString()
          })
          .eq("id", id)
        if (error) throw error
        showToast("ok","🛑 Votación cerrada")
      }
      await fetchElection()
    } catch (e) {
      console.error(e)
      setError("No se pudo actualizar el estado de la elección.")
      showToast("err","Error al cambiar estado")
    } finally {
      setSaving(false)
    }
  }

  // ---------- UI ----------
  return (
    <div style={s.page}>
      <div style={s.wrap}>
        {/* Header */}
        <div style={s.head}>
          <div>
            <div style={s.crumb}>
              <Link to="/admin/elections" style={s.link}>Elecciones</Link> · Configurar
            </div>
            <div style={s.title}>Configurar elección</div>
            <div style={{ fontSize:12, color:"#94a3b8", marginTop:2 }}>ID: {id}</div>
          </div>
          <span style={{...s.badge, ...(statusBadge.cls||{})}}>● {statusBadge.text}</span>
        </div>

        {error && <div style={s.err}>{error}</div>}

        {loading ? (
          <div style={s.card}><div style={s.muted}>Cargando…</div></div>
        ) : (
          <div style={s.grid2}>
            {/* Reglas */}
            <div style={s.card}>
              <div style={s.h}>Reglas</div>

              <label style={s.label}>Título</label>
              <input
                name="title" value={form.title} onChange={handleChange}
                placeholder="Elección de Diáconos 2025"
                style={s.focus}
                onFocus={e => e.currentTarget.style.boxShadow="0 0 0 4px rgba(37,99,235,.15)"}
                onBlur={e => e.currentTarget.style.boxShadow="none"}
              />
              <div style={s.hint}>Nombre visible en boletas y resultados.</div>

              <div style={{ height:12 }} />

              <div style={s.row2}>
                <div>
                  <label style={s.label}>Cupo Hombres</label>
                  <input
                    type="number" name="required_male" min={0}
                    value={form.required_male} onChange={handleChange}
                    style={s.focus}
                    onFocus={e => e.currentTarget.style.boxShadow="0 0 0 4px rgba(37,99,235,.15)"}
                    onBlur={e => e.currentTarget.style.boxShadow="none"}
                  />
                  <div style={s.hint}>Cantidad de hombres a elegir.</div>
                </div>
                <div>
                  <label style={s.label}>Cupo Mujeres</label>
                  <input
                    type="number" name="required_female" min={0}
                    value={form.required_female} onChange={handleChange}
                    style={s.focus}
                    onFocus={e => e.currentTarget.style.boxShadow="0 0 0 4px rgba(37,99,235,.15)"}
                    onBlur={e => e.currentTarget.style.boxShadow="none"}
                  />
                  <div style={s.hint}>Cantidad de mujeres a elegir.</div>
                </div>
              </div>

              <div style={{ height:12 }} />

              <label style={s.label}>Notas pastorales</label>
              <textarea
                name="notes" value={form.notes} onChange={handleChange}
                placeholder="Indicaciones, requisitos y consideraciones…"
                style={{ ...s.input, minHeight:120 }}
                onFocus={e => e.currentTarget.style.boxShadow="0 0 0 4px rgba(37,99,235,.15)"}
                onBlur={e => e.currentTarget.style.boxShadow="none"}
              />
              <div style={s.hint}>No se muestran a los votantes (solo guía interna).</div>

              {/* Acciones sticky */}
              <div style={s.sticky}>
                <button style={s.btnPrimary} onClick={handleSave} disabled={saving}>
                  {saving ? "Guardando…" : "Guardar cambios"}
                </button>

                <button
                  style={isOpen ? s.btnDanger : s.btnPrimary}
                  onClick={toggleOpenClose}
                  disabled={saving}
                >
                  {saving ? "Procesando…" : (isOpen ? "Cerrar votación" : "Abrir votación")}
                </button>

                <button style={s.btn} onClick={fetchCounts} title="Refrescar KPIs">Refrescar</button>

                <span style={s.muted}>
                  {form.opened_at && <>Oficial abierta desde <b>{new Date(form.opened_at).toLocaleString()}</b></>}
                  {form.closed_at && <> · Cerrada el <b>{new Date(form.closed_at).toLocaleString()}</b></>}
                </span>
              </div>
            </div>

            {/* Resumen & Candidatos */}
            <div style={s.card}>
              <div style={s.h}>Resumen y candidatos</div>
              <div style={s.kpis}>
                <div style={s.kpi}>
                  <div style={s.kpiVal}>{counts.total}</div>
                  <div style={s.kpiLbl}>Candidatos totales</div>
                </div>
                <div style={s.kpi}>
                  <div style={s.kpiVal}>{counts.male}</div>
                  <div style={s.kpiLbl}>Hombres postulados</div>
                </div>
                <div style={s.kpi}>
                  <div style={s.kpiVal}>{counts.female}</div>
                  <div style={s.kpiLbl}>Mujeres postuladas</div>
                </div>
                <div style={s.kpi}>
                  <div style={s.kpiVal}>{form.required_male}</div>
                  <div style={s.kpiLbl}>Cupos hombres</div>
                </div>
                <div style={s.kpi}>
                  <div style={s.kpiVal}>{form.required_female}</div>
                  <div style={s.kpiLbl}>Cupos mujeres</div>
                </div>
              </div>

              <div style={{ height:12 }} />
              <div style={{ display:"flex", gap:10, alignItems:"center", flexWrap:"wrap" }}>
                <Link to={`/admin/candidates?election=${id}`} style={s.link}>👥 Gestionar candidatos →</Link>
                {!form.opened_at && (
                  <span style={{ fontSize:12, color:"#64748b" }}>
                    Consejo: define candidatos y cupos antes de abrir la votación.
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

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

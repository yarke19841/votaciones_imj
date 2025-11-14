import { useEffect, useMemo, useState } from "react"
import { supabase } from "../../lib/supabase"

// Normaliza cédula para búsquedas (coincide con tu otro módulo)
function normalizeCedulaLocal(c) {
  return (c ?? "").toUpperCase().replace(/[^A-Z0-9]+/g, "")
}

export default function AdminCheckIn() {
  const s = useMemo(() => ({
    page: { fontFamily: "system-ui,-apple-system,Segoe UI,Roboto", background: "#f3f4f6", minHeight: "100vh" },
    wrap: { maxWidth: 1100, margin: "0 auto", padding: "24px 16px" },
    grid: { display: "grid", gap: 16, gridTemplateColumns: "1.2fr .8fr" },
    card: { background: "#fff", border: "1px solid #e5e7eb", borderRadius: 16, padding: 16, boxShadow: "0 8px 24px rgba(0,0,0,.06)" },
    head: { display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 10 },
    title: { fontSize: 20, fontWeight: 800, color: "#0f172a" },
    subtitle: { fontSize: 13, color: "#64748b" },
    row: { display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" },
    input: { width: "100%", padding: "10px 12px", border: "1px solid #d1d5db", borderRadius: 10, outline: "none" },
    select: { width: "100%", padding: "10px 12px", border: "1px solid #d1d5db", borderRadius: 10, outline: "none" },
    btn: (kind = "primary") => {
      const map = {
        primary: { background: "#2563eb", border: "#2563eb", color: "#fff" },
        ghost: { background: "#fff", border: "#d1d5db", color: "#111827" },
        success: { background: "#16a34a", border: "#16a34a", color: "#fff" },
        muted: { background: "#e5e7eb", border: "#d1d5db", color: "#6b7280" },
      }
      const x = map[kind] || map.primary
      return {
        padding: "10px 12px",
        borderRadius: 12,
        border: `1px solid ${x.border}`,
        background: x.background,
        color: x.color,
        fontWeight: 800,
        cursor: "pointer",
      }
    },
    list: { display: "grid", gap: 8, marginTop: 10 },
    item: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px", border: "1px solid #e5e7eb", borderRadius: 12, background: "#fff" },
    meta: { fontSize: 12, color: "#64748b" },
    tag: (ok = true) => ({
      display: "inline-flex",
      padding: "2px 8px",
      borderRadius: 999,
      fontSize: 12,
      fontWeight: 700,
      border: "1px solid #d1d5db",
      background: ok ? "#dcfce7" : "#fee2e2",
      color: ok ? "#065f46" : "#7f1d1d",
    }),
    ok: { color: "#065f46", fontSize: 13 },
    err: { color: "#b91c1c", fontSize: 13 },
    small: { fontSize: 12, color: "#64748b" },
    kpiBox: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 10, marginTop: 10 },
    kpi: { padding: 12, border: "1px solid #e5e7eb", borderRadius: 12, background: "#f8fafc" },
    kpiVal: { fontSize: 22, fontWeight: 900, color: "#0f172a" },
    kpiLbl: { fontSize: 12, color: "#64748b" },
  }), [])

  const [elections, setElections] = useState([])
  const [selElection, setSelElection] = useState("")
  const [query, setQuery] = useState("")
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState("")
  const [error, setError] = useState("")
  const [padron, setPadron] = useState({ total: 0, asistieron: 0, pct: 0 })
  const [attMap, setAttMap] = useState({})
  const [attDate, setAttDate] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  })
  const [sessionKind, setSessionKind] = useState("practica")

  useEffect(() => { (async () => {
    setLoading(true); setError(""); setMsg("")
    const { data, error } = await supabase
      .from("election")
      .select("id,title,status,opened_at,closed_at,created_at")
      .order("created_at", { ascending: false })
    if (error) { setError("No se pudieron cargar las elecciones."); setLoading(false); return }
    setElections(data || [])
    const open = (data || []).find(e => e.status === "abierta")
    setSelElection(open?.id || data?.[0]?.id || "")
    setLoading(false)
  })() }, [])

  useEffect(() => { if (selElection) refreshKPIs() }, [selElection])

  async function refreshKPIs() {
    try {
      const tot = await supabase.from("member").select("id", { count: "exact", head: true }).eq("is_active", true)
      const asist = await supabase.from("attendance_voter").select("id", { count: "exact", head: true }).eq("election_id", selElection)
      const total = tot.count ?? 0
      const asistieron = asist.count ?? 0
      const pct = total ? Math.round((asistieron / total) * 100) : 0
      setPadron({ total, asistieron, pct })
    } catch (e) { console.error(e) }
  }

  async function refreshAttendanceForResults(list) {
    try {
      if (!selElection || !attDate || !list?.length) { setAttMap({}); return }
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
      for (const r of (data || [])) map[r.member_id] = { id: r.id, present: r.present }
      setAttMap(map)
    } catch (e) {
      console.error("[attendance.refresh]", e)
      setAttMap({})
    }
  }

  // Solo busca por cédula
  async function search() {
    if (!query.trim()) { setResults([]); setAttMap({}); return }
    setBusy(true); setError(""); setMsg("")
    const norm = normalizeCedulaLocal(query.trim())

    const { data, error } = await supabase
      .from("member")
      .select("id,full_name,cedula,sex,is_active")
      .or(`cedula.ilike.%${query.trim()}%,cedula_norm.ilike.%${norm}%`)
      .limit(20)

    setBusy(false)
    if (error) { setError("Error buscando por cédula."); console.error(error); return }

    setResults(data || [])
    await refreshAttendanceForResults(data || [])
  }

  async function activateMember(memberId) {
    setBusy(true); setError(""); setMsg("")
    const { error } = await supabase.from("member").update({ is_active: true }).eq("id", memberId)
    setBusy(false)
    if (error) { setError("No se pudo activar al miembro."); console.error(error); return }
    setMsg("✅ Miembro activado")
    setResults(prev => prev.map(r => r.id === memberId ? { ...r, is_active: true } : r))
    refreshKPIs()
  }

  async function checkIn(memberId) {
    if (!selElection) { setError("Selecciona una elección."); return }
    if (!attDate) { setError("Selecciona la fecha de asistencia."); return }

    setBusy(true); setError(""); setMsg("")
    try {
      const { data: existing } = await supabase
        .from("attendance_voter")
        .select("id,present")
        .eq("election_id", selElection)
        .eq("member_id", memberId)
        .eq("session_kind", sessionKind)
        .eq("attended_on", attDate)
        .maybeSingle()

      if (existing?.id) {
        if (existing.present === true) {
          setMsg("ℹ️ Ya tenía asistencia registrada.")
        } else {
          await supabase.from("attendance_voter").update({ present: true }).eq("id", existing.id)
          setMsg("📝 Asistencia actualizada.")
        }
        setAttMap(prev => ({ ...prev, [memberId]: { id: existing.id, present: true } }))
      } else {
        const { data: ins } = await supabase
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
        setMsg("📝 Asistencia marcada.")
        setAttMap(prev => ({ ...prev, [memberId]: { id: ins.id, present: true } }))
      }
      refreshKPIs()
    } catch (e) {
      console.error(e)
      setError("No se pudo marcar asistencia.")
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
            <div style={s.subtitle}>Buscar solo por cédula y marcar asistencia.</div>
          </div>
        </div>

        <div style={s.grid}>
          {/* IZQ */}
          <div style={s.card}>
            <div style={s.row}>
              <div style={{ flex: 1, minWidth: 220 }}>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Elección</div>
                <select style={s.select} value={selElection} onChange={e => setSelElection(e.target.value)}>
                  {elections.map(e => (
                    <option key={e.id} value={e.id}>
                      {e.title} {e.status === "abierta" ? "(Abierta)" : e.status === "cerrada" ? "(Cerrada)" : "(Borrador)"}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ minWidth: 160 }}>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Fecha de asistencia</div>
                <input type="date" style={s.input} value={attDate} onChange={e => setAttDate(e.target.value)} />
              </div>

              <div style={{ minWidth: 160 }}>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Tipo de jornada</div>
                <select style={s.select} value={sessionKind} onChange={e => setSessionKind(e.target.value)}>
                  
                  <option value="final">Final</option>
                </select>
              </div>
            </div>

            <div style={{ height: 12 }} />

            <div>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Buscar (solo por cédula)</div>
              <div style={s.row}>
                <input
                  style={s.input}
                  placeholder="Ej: 8-765-1234"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") search() }}
                />
                <button style={s.btn("ghost")} onClick={search} disabled={!query || busy}>
                  {busy ? "Buscando…" : "Buscar"}
                </button>
              </div>

              {error && <div style={{ marginTop: 8, ...s.err }}>{error}</div>}
              {msg && <div style={{ marginTop: 8, ...s.ok }}>{msg}</div>}

              <div style={s.list}>
                {results.map(r => {
                  const att = attMap[r.id]
                  const hasAttendance = att?.present === true
                  return (
                    <div key={r.id} style={s.item}>
                      <div>
                        <div style={{ fontWeight: 800 }}>{r.full_name}</div>
                        <div style={s.meta}>{r.cedula} · {r.sex || "—"}</div>
                        <div style={s.meta}>
                          Estado: <b>{r.is_active ? "Activo" : "Inactivo"}</b>{" · "}
                          {hasAttendance
                            ? <span style={s.tag(true)}>Asistencia OK</span>
                            : <span style={s.tag(false)}>Sin asistencia</span>}
                        </div>
                      </div>
                      <div style={s.row}>
                        {!r.is_active && (
                          <button style={s.btn("ghost")} onClick={() => activateMember(r.id)}>Activar</button>
                        )}
                        <button
                          style={s.btn(hasAttendance ? "muted" : "success")}
                          onClick={() => checkIn(r.id)}
                          disabled={!selElection || hasAttendance || busy}
                        >
                          {hasAttendance ? "Ya tiene asistencia" : "Asistencia"}
                        </button>
                      </div>
                    </div>
                  )
                })}
                {query && results.length === 0 && !busy && (
                  <div style={s.small}>No se encontró ninguna coincidencia con esa cédula.</div>
                )}
              </div>
            </div>
          </div>

          {/* KPIs */}
          <div style={s.card}>
            <div style={s.head}><div style={s.title}>Participación</div></div>
            <div style={s.kpiBox}>
              <div style={s.kpi}><div style={s.kpiVal}>{padron.total}</div><div style={s.kpiLbl}>Miembros activos</div></div>
              <div style={s.kpi}><div style={s.kpiVal}>{padron.asistieron}</div><div style={s.kpiLbl}>Asistieron</div></div>
              <div style={s.kpi}><div style={s.kpiVal}>{padron.pct}%</div><div style={s.kpiLbl}>Participación</div></div>
            </div>
            <div style={{ marginTop: 12 }}>
              <button style={s.btn("ghost")} onClick={refreshKPIs} disabled={!selElection}>Refrescar</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

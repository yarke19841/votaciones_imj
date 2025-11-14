// src/pages/admin/AdminHome.jsx
import { Link, useNavigate } from "react-router-dom"
import { useEffect, useState, useMemo } from "react"
import { supabase } from "../../lib/supabase.js"

// Conteo robusto
async function getCountSafe(table) {
  const a = await supabase.from(table).select("id", { count: "exact" }).range(0, 0)
  if (!a.error && typeof a.count === "number") return a.count
  const b = await supabase.from(table).select("id").range(0, 9999)
  if (!b.error && Array.isArray(b.data)) return b.data.length
  if (b.error) throw b.error
  return 0
}

export default function AdminHome() {
  const nav = useNavigate()

  const [stats, setStats] = useState({ elections: 0, members: 0, candidates: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [latest, setLatest] = useState(null) // { id, title, opened_at, closed_at }
  const [closing, setClosing] = useState(false) // ← NUEVO

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        setLoading(true); setError("")
        const [elections, members, candidates] = await Promise.all([
          getCountSafe("election"),
          getCountSafe("member"),
          getCountSafe("candidate"),
        ])

        const { data: last, error: e2 } = await supabase
          .from("election")
          .select("id,title,opened_at,closed_at,created_at")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle()

        if (e2) throw e2
        if (!cancelled) {
          setStats({ elections, members, candidates })
          setLatest(last ?? null)
        }
      } catch (e) {
        if (!cancelled) setError(e.message || "Error cargando estadísticas")
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  const s = useMemo(() => ({
    wrap: { maxWidth: 1100, margin: "0 auto", padding: "24px 16px" },
    grid: { display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fill,minmax(240px,1fr))" },
    card: { background: "#fff", border: "1px solid #e5e7eb", borderRadius: 16, padding: 20, boxShadow: "0 8px 24px rgba(0,0,0,.06)" },
    title: { fontWeight: 800, fontSize: 18, marginBottom: 6 },
    subtitle: { color: "#6b7280", fontSize: 14, marginBottom: 12 },
    statBox: { background: "#f8fafc", borderRadius: 12, padding: 16, textAlign: "center", border: "1px solid #e5e7eb" },
    statNumber: { fontSize: 28, fontWeight: 800, color: "#2563eb" },
    btnGrid: { display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))", marginTop: 16 },
    btn: (kind = "primary") => {
      const map = {
        primary: { background: "#2563eb", border: "#2563eb", color: "#fff" },
        ghost:   { background: "#fff", border: "#d1d5db", color: "#111827" },
        danger:  { background: "#e11d48", border: "#e11d48", color: "#fff" }, // ← NUEVO
      }
      const x = map[kind]
      return {
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        padding: "12px 14px", borderRadius: 12, border: `1px solid ${x.border}`,
        background: x.background, color: x.color, fontWeight: 700, textDecoration: "none",
        transition: "all .2s", cursor: "pointer"
      }
    },
    row: { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" },
    badge: { display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: 999, fontSize: 12, border: "1px solid #e5e7eb", background: "#f9fafb", color: "#374151" },
    badgeGreen:{ background:"#ecfdf5", color:"#065f46", border:"1px solid #a7f3d0" },
    badgeRed:{ background:"#fef2f2", color:"#991b1b", border:"1px solid #fecaca" },
    badgeGray:{ background:"#f3f4f6", color:"#374151", border:"1px solid #e5e7eb" }
  }), [])

  const statusBadge = () => {
    if (!latest) return <span style={{...s.badge, ...s.badgeGray}}>● Sin elecciones</span>
    if (latest.closed_at) return <span style={{...s.badge, ...s.badgeRed}}>● Cerrada</span>
    if (latest.opened_at) return <span style={{...s.badge, ...s.badgeGreen}}>● Abierta</span>
    return <span style={s.badge}>● Borrador</span>
  }

  // Abre el configurador; si no hay elección, crea una y navega
  const goConfigureElection = async () => {
    try {
      if (latest?.id) {
        nav(`/admin/elections/${latest.id}/config`)
        return
      }
      const { data, error } = await supabase
        .from("election")
        .insert([{ title: "Nueva elección", required_male: 0, required_female: 0, notes: "" }])
        .select("id, title, opened_at, closed_at, created_at")
        .single()
      if (error) throw error
      setLatest(data) // ← sync
      nav(`/admin/elections/${data.id}/config`)
    } catch (e) {
      setError(e.message || "No se pudo abrir el configurador")
    }
  }

  // ← NUEVO: Cerrar votación de la última elección
  const closeElection = async () => {
    if (!latest?.id) { setError("No hay elección para cerrar."); return }
    if (!latest.opened_at) { setError("La elección aún no está abierta."); return }
    if (latest.closed_at) { setError("La elección ya está cerrada."); return }

    if (!confirm("¿Cerrar la votación ahora? Esta acción registrará 'closed_at' con la hora actual.")) return

    try {
      setClosing(true); setError("")
      const now = new Date().toISOString()
      const { error } = await supabase
        .from("election")
        .update({ closed_at: now })
        .eq("id", latest.id)
      if (error) throw error

      // Actualiza UI local
      setLatest(prev => prev ? { ...prev, closed_at: now } : prev)
    } catch (e) {
      setError(e.message || "No se pudo cerrar la votación")
    } finally {
      setClosing(false)
    }
  }

  const canClose = !!latest?.opened_at && !latest?.closed_at

  return (
    <div style={{ background: "#f3f4f6", minHeight: "100vh" }}>
      <div style={s.wrap}>
        <div style={s.card}>
          <div style={s.row}>
            <div style={s.title}>📊 Panel de Administrador</div>
            {statusBadge()}
          </div>
          <p style={s.subtitle}>
            Gestiona miembros, candidatos y elecciones. Configura títulos, cupos H/M, notas y estado de votación.
          </p>

          {error && (
            <div style={{ marginBottom: 12, padding: 12, borderRadius: 10, background: "#fef2f2", border: "1px solid #fecaca", color: "#991b1b", fontSize: 14 }}>
              {error}
            </div>
          )}

          <div style={s.grid}>
            <div style={s.statBox}>
              <div style={s.statNumber}>{loading ? "…" : stats.members}</div>
              <div>Miembros</div>
            </div>
            <div style={s.statBox}>
              <div style={s.statNumber}>{loading ? "…" : stats.candidates}</div>
              <div>Candidatos</div>
            </div>
            <div style={s.statBox}>
              <div style={s.statNumber}>{loading ? "…" : stats.elections}</div>
              <div>Elecciones</div>
            </div>
          </div>

          <h3 style={{ fontWeight: 700, marginTop: 24, marginBottom: 8 }}>Accesos rápidos</h3>
          <div style={s.btnGrid}>
            <button style={s.btn("primary")} onClick={() => nav("/admin/members")}>➕ Miembros</button>
            <button style={s.btn("primary")} onClick={() => nav("/admin/candidates")}>🧑‍💼 Candidatos</button>
            <Link to="/admin/elections" style={s.btn("ghost")}>🗳️ Elecciones</Link>
            <Link to="/admin/results"   style={s.btn("ghost")}>📈 Resultados</Link>

            {/* Configurar elección (crea si no hay) */}
            <button style={s.btn("primary")} onClick={goConfigureElection}>
              ⚙️ Configurar elección
            </button>

<button style={s.btn("primary")} onClick={()=> nav("/admin/checkin")}>📝 Check-In / Asistencia</button>

            {/* ← NUEVO: Cerrar votación */}
            <button
              style={s.btn("danger")}
              onClick={closeElection}
              disabled={!canClose || closing}
              title={!latest ? "No hay elección" : (latest.closed_at ? "Ya está cerrada" : (!latest.opened_at ? "Aún no está abierta" : "Cerrar votación"))}
            >
              {closing ? "Cerrando…" : "⛔ Cerrar votación"}
            </button>
          </div>

          <p style={{ color:"#6b7280", fontSize: 12, marginTop: 10 }}>
            Tip: el botón cierra la <b>última elección</b> (más reciente). Puedes reabrirla desde Configurar.
          </p>
        </div>
      </div>
    </div>
  )
}

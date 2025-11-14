// src/pages/VoteBallot.jsx
import { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { supabase } from "../lib/supabase"

// Hook simple para detectar mobile (<= 640px)
function useIsMobile(breakpoint = 640) {
  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined" ? window.innerWidth <= breakpoint : false
  )
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= breakpoint)
    window.addEventListener("resize", onResize)
    return () => window.removeEventListener("resize", onResize)
  }, [breakpoint])
  return isMobile
}

export default function VoteBallot(){
  const navigate = useNavigate()
  const isMobile = useIsMobile(640)

  // Elección y votante desde sesión
  const election = useMemo(() => {
    try { return JSON.parse(sessionStorage.getItem("election") || "null") } catch { return null }
  }, [])
  const voter = useMemo(() => {
    try { return JSON.parse(sessionStorage.getItem("voter") || "null") } catch { return null }
  }, [])

  // Nombre y avatar
  const displayName = useMemo(() => (voter?.full_name?.trim() || voter?.cedula || ""), [voter])
  const initials = useMemo(() => {
    const parts = (displayName || "").split(/\s+/).filter(Boolean)
    return parts.length ? (parts[0][0] + (parts[1]?.[0] || "")).toUpperCase() : "👤"
  }, [displayName])

  const [female, setFemale] = useState([])
  const [male, setMale] = useState([])
  const [selF, setSelF] = useState([])
  const [selM, setSelM] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState("")
  const [okMsg, setOkMsg] = useState("")

  const [activePool, setActivePool] = useState(null) // "simulacro" | "oficial" | null
  const [electionMeta, setElectionMeta] = useState({ opened_at:null, closed_at:null, status:null })
  const [ballotLoaded, setBallotLoaded] = useState(false)

  const reqF = election?.required_female ?? 0
  const reqM = election?.required_male ?? 0
  const ready = selF.length === reqF && selM.length === reqM

  // estilos
  const s = {
    page: { minHeight:"100vh", background:"#f3f4f6", fontFamily:"system-ui,-apple-system,Segoe UI,Roboto" },
    headerWrap:{ background:"#fff", borderBottom:"1px solid #e5e7eb" },
    header:{
      maxWidth:960, margin:"0 auto", padding:"14px 16px",
      display:"grid",
      gridTemplateColumns: isMobile ? "1fr" : "1fr auto",
      gap: isMobile ? 8 : 12,
      alignItems:"center"
    },
    headLeftWrap:{ display:"flex", alignItems:"center", gap:12, minWidth:0, order: isMobile ? 2 : 1 },
    brandSquare:{ width:40, height:40, borderRadius:12, background:"#2563eb" },
    headTextWrap:{ minWidth:0 },
    brandTitle:{
      fontSize: isMobile ? 18 : 22,
      fontWeight:800,
      lineHeight:1.1,
      whiteSpace: isMobile ? "normal" : "nowrap",
      overflow:"hidden",
      textOverflow:"ellipsis"
    },
    brandSubtitle:{ fontSize:12, color:"#6b7280", marginTop:4 },
    welcome:{
      order: isMobile ? 1 : 2,
      display:"flex", alignItems:"center", gap:12, background:"#f8fafc",
      border:"1px solid #e5e7eb", padding: isMobile ? "10px 12px" : "8px 12px",
      borderRadius:14
    },
    avatar:{ width:36, height:36, borderRadius:999, background:"#e0e7ff", color:"#3730a3",
      fontWeight:800, display:"grid", placeItems:"center", fontSize:14 },
    welcomeTextWrap:{ lineHeight:1.15 },
    welcomeTitle:{ fontSize:12, color:"#6b7280", display:"block" },
    welcomeName:{ fontSize: isMobile ? 16 : 16, fontWeight:800, display:"block" },
    main:{ maxWidth:960, margin:"0 auto", padding:"24px 16px" },
    card:{ background:"#fff", border:"1px solid #e5e7eb", borderRadius:16, padding:20, boxShadow:"0 8px 24px rgba(0,0,0,.06)", marginBottom:16 },
    sectionTitle:{ fontSize:16, fontWeight:700, marginBottom:6 },
    sectionCap:{ fontSize:13, color:"#6b7280", marginBottom:12 },
    grid:{ display:"grid", gap:12, gridTemplateColumns:"repeat(auto-fill, minmax(220px, 1fr))" },
    candBtn:(selected)=>({
      textAlign:"left", width:"100%", border:"2px solid "+(selected ? "#3b82f6" : "transparent"),
      borderRadius:16, padding:0, background:"transparent", cursor:"pointer"
    }),
    candCard:{ background:"#fff", border:"1px solid #e5e7eb", borderRadius:16, padding:12, boxShadow:"0 6px 18px rgba(0,0,0,.06)" },
    candPhoto:{ width:"100%", height:160, background:"#eef2ff", borderRadius:12, objectFit:"cover", marginBottom:10 },
    candName:{ fontWeight:700 },
    candDesc:{ fontSize:13, color:"#6b7280" },
    note:{ display:"inline-block", background:"#dbeafe", color:"#1e40af", padding:"4px 8px", borderRadius:8, fontSize:12, fontWeight:700, marginRight:8 },
    ok:{ color:"#065f46", fontSize:13, marginTop:8 },

    // Botón principal
    ctaBtn:(enabled)=>({
      padding:"12px 16px",
      borderRadius:12,
      border:"1px solid " + (enabled ? "#2563eb" : "#d1d5db"),
      background: enabled ? "#2563eb" : "#f3f4f6",
      color: enabled ? "#fff" : "#9ca3af",
      fontWeight:800,
      cursor: enabled ? "pointer" : "not-allowed",
      minWidth:200
    })
  }

  // Carga inicial: NO carga candidatos. Solo: ¿ya votó? + status/active_pool
  useEffect(() => {
    if (!election || !voter) { navigate("/"); return }
    ;(async () => {
      setLoading(true); setErr(""); setOkMsg("")
      try {
        // 0) ¿Ya votó?
        const { data: existing, error: exErr } = await supabase
          .from("cast_vote")
          .select("id", { head: false })
          .eq("election_id", election.id)
          .eq("voter_member_id", voter.member_id)
        if (exErr) throw exErr
        if (existing && existing.length > 0) {
          navigate("/vote/thanks", { replace: true })
          return
        }

        // 1) Estado + fase
        const { data: eRow, error: eErr } = await supabase
          .from("election")
          .select("status, active_pool, opened_at, closed_at")
          .eq("id", election.id)
          .single()
        if (eErr) throw eErr

        const status = (eRow?.status || "").toLowerCase() // 'abierta' | 'cerrada'
        const pool = eRow?.active_pool || null            // 'simulacro' | 'oficial' | null
        setElectionMeta({ opened_at: eRow?.opened_at ?? null, closed_at: eRow?.closed_at ?? null, status })
        setActivePool(pool)
      } catch (e) {
        console.error(e)
        setErr("No se pudo cargar la información de la elección.")
      } finally {
        setLoading(false)
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Botón: cargar papeleta bajo demanda (si aún no empezó, avisa)
  async function loadBallot() {
    try {
      setLoading(true); setErr(""); setOkMsg("")
      const { data: eRow, error: eErr } = await supabase
        .from("election")
        .select("status, active_pool")
        .eq("id", election.id)
        .single()
      if (eErr) throw eErr

      const status = (eRow?.status || "").toLowerCase()
      const pool = eRow?.active_pool || null

      if (status !== "abierta") {
        setErr("Aún no hemos iniciado. Cuando el moderador diga “Empezar”, vuelve a presionar Cargar papeleta.")
        setBallotLoaded(false)
        return
      }
      if (!pool) {
        setErr("La elección está abierta, pero no hay fase activa (simulacro u oficial). Consulta al moderador.")
        setBallotLoaded(false)
        return
      }

      const { data: females, error: ef } = await supabase
        .from("candidate")
        .select("id, full_name, photo_url, description, gender, active, pool")
        .eq("election_id", election.id)
        .eq("gender", "F")
        .eq("active", true)
        .eq("pool", pool)
        .order("full_name", { ascending: true })

      const { data: males, error: em } = await supabase
        .from("candidate")
        .select("id, full_name, photo_url, description, gender, active, pool")
        .eq("election_id", election.id)
        .eq("gender", "M")
        .eq("active", true)
        .eq("pool", pool)
        .order("full_name", { ascending: true })

      if (ef || em) throw new Error("No se pudieron cargar los candidatos.")

      setFemale(females || [])
      setMale(males || [])
      setBallotLoaded(true)
      setOkMsg("✅ Papeleta cargada correctamente.")
    } catch (e) {
      console.error(e)
      setErr("No se pudo cargar la papeleta.")
    } finally {
      setLoading(false)
    }
  }

  const toggle = (id, list, setList, limit) => {
    setOkMsg("")
    setList(prev =>
      prev.includes(id)
        ? prev.filter(x => x !== id)
        : (prev.length >= limit ? prev : [...prev, id])
    )
  }

  async function submit(){
    try{
      setErr(""); setOkMsg(""); setSaving(true)
      if (!ready) { setSaving(false); return }

      // Revalidar estado/fase justo antes de guardar (evita votos fuera de fase)
      const { data: eRow, error: eErr } = await supabase
        .from("election")
        .select("status, active_pool, opened_at, closed_at")
        .eq("id", election.id)
        .single()
      if (eErr) throw eErr

      const status = (eRow?.status || "").toLowerCase()
      if (status !== "abierta") {
        setErr("La elección está cerrada. No se puede registrar el voto.")
        setSaving(false); return
      }
      if (!eRow?.active_pool) {
        setErr("No hay una fase abierta en este momento."); setSaving(false); return
      }
      if (eRow.active_pool === "oficial" && eRow.closed_at) {
        setErr("La votación oficial ya fue cerrada. No se puede registrar el voto.")
        setSaving(false); return
      }

      // Bloquea segundo intento
      const { data: already, error: alErr } = await supabase
        .from("cast_vote")
        .select("id")
        .eq("election_id", election.id)
        .eq("voter_member_id", voter.member_id)
      if (alErr) throw alErr
      if (already && already.length > 0) {
        navigate("/vote/thanks", { replace: true })
        return
      }

      // Inserta votos
      const rows = [
        ...selM.map(cid => ({ election_id: election.id, voter_member_id: voter.member_id, candidate_id: cid })),
        ...selF.map(cid => ({ election_id: election.id, voter_member_id: voter.member_id, candidate_id: cid })),
      ]
      if (rows.length === 0) { setErr("Selecciona tus candidatos."); setSaving(false); return }

      const { error: insErr } = await supabase.from("cast_vote").insert(rows)
      if (insErr) throw insErr

      // Marca ya votó (si tienes esa tabla)
      await supabase
        .from("election_member")
        .update({ already_voted: true, voted_at: new Date().toISOString() })
        .eq("election_id", election.id)
        .eq("member_id", voter.member_id)

      // Limpia sesión y redirige
      try {
        sessionStorage.removeItem("voter")
        sessionStorage.removeItem("election")
      } catch {}
      navigate("/vote/thanks", { replace: true })
      return
    } catch (e) {
      console.error(e)
      const msg = (e?.message || "").toLowerCase()
      if (msg.includes("duplicate key") || msg.includes("unique")) {
        setErr("Intentaste repetir un candidato. Revisa tu selección.")
      } else {
        setErr("No pudimos registrar tu voto. Verifica la conexión e inténtalo nuevamente.")
      }
    } finally {
      setSaving(false)
    }
  }

  if (!election || !voter) return <div style={{padding:24, fontFamily:"system-ui"}}>Redirigiendo…</div>

  return (
    <div style={s.page}>
      <header style={s.headerWrap}>
        <div style={s.header}>
          {/* Bienvenida */}
          <div style={s.welcome}>
            <div style={s.avatar}>{initials}</div>
            <div style={s.welcomeTextWrap}>
              <span style={s.welcomeTitle}>Bienvenido(a) al voto electrónico</span>
              <span style={s.welcomeName}>{displayName}</span>
            </div>
          </div>

          {/* Título/estado */}
          <div style={s.headLeftWrap}>
            <div style={s.brandSquare} />
            <div style={s.headTextWrap}>
              <div style={s.brandTitle}>{election?.title || "Elección"}</div>
              <div style={s.brandSubtitle}>
                {activePool
                  ? <>Fase: <b>{activePool === "simulacro" ? "Simulacro" : "Oficial"}</b> · Debes elegir: <b>{reqM}</b> H · <b>{reqF}</b> M</>
                  : <>Fase: <b>—</b> · Debes elegir: <b>{reqM}</b> H · <b>{reqF}</b> M</>
                }
              </div>
            </div>
          </div>
        </div>
      </header>

      <main style={s.main}>
        <div style={s.card}>
          <span style={s.note}>Secreto</span>
          <span style={{fontSize:13, color:"#6b7280"}}>
            Tu voto se registra de forma anónima. Solo puedes votar <b>una vez</b> en esta elección.
          </span>
        </div>

        {loading ? (
          <div style={s.card}>Procesando...</div>
        ) : (
          <>
            {/* CTA SIEMPRE VISIBLE Y HABILITADA */}
            {!ballotLoaded && (
              <div style={{...s.card, textAlign:"center"}}>
                <div style={{fontSize:15, marginBottom:10}}>
                  { (electionMeta.status || '').toLowerCase() === 'abierta'
                    ? <span style={{color:"#065f46", fontWeight:600}}>✅ Elección abierta. Cuando el moderador diga “Empezar”, presiona el botón.</span>
                    : <span style={{color:"#92400e", fontWeight:600}}>⌛ A la espera del inicio. Presiona el botón cuando indiquen “Empezar”.</span>
                  }
                </div>

                <button
                  onClick={loadBallot}
                  style={s.ctaBtn(true /* siempre habilitado */)}
                >
                  🗳️ Cargar papeleta
                </button>

                <div style={{marginTop:8, fontSize:12, color:"#6b7280"}}>
                  Si aún no inicia, verás un aviso y podrás volver a intentarlo cuando lo indiquen.
                </div>
              </div>
            )}

            {/* Boleta cuando ya fue cargada */}
            {ballotLoaded && !loading && !err && (
              <>
                {/* Mujeres */}
                <div style={s.card}>
                  <div style={s.sectionTitle}>Mujeres (elige {reqF})</div>
                  <div style={s.sectionCap}>{selF.length} / {reqF} seleccionadas</div>
                  <div style={s.grid}>
                    {female.map(c => {
                      const selected = selF.includes(c.id)
                      return (
                        <button key={c.id} type="button" style={s.candBtn(selected)}
                          onClick={() => toggle(c.id, selF, setSelF, reqF)}>
                          <div style={s.candCard}>
                            {c.photo_url
                              ? <img src={c.photo_url} alt={c.full_name} style={s.candPhoto} />
                              : <div style={s.candPhoto} />
                            }
                            <div style={s.candName}>{c.full_name}</div>
                            {c.description && <div style={s.candDesc}>{c.description}</div>}
                          </div>
                        </button>
                      )
                    })}
                    {female.length === 0 && <div style={{color:"#6b7280"}}>No hay candidatas.</div>}
                  </div>
                </div>

                {/* Hombres */}
                <div style={s.card}>
                  <div style={s.sectionTitle}>Hombres (elige {reqM})</div>
                  <div style={s.sectionCap}>{selM.length} / {reqM} seleccionados</div>
                  <div style={s.grid}>
                    {male.map(c => {
                      const selected = selM.includes(c.id)
                      return (
                        <button key={c.id} type="button" style={s.candBtn(selected)}
                          onClick={() => toggle(c.id, selM, setSelM, reqM)}>
                          <div style={s.candCard}>
                            {c.photo_url
                              ? <img src={c.photo_url} alt={c.full_name} style={s.candPhoto} />
                              : <div style={s.candPhoto} />
                            }
                            <div style={s.candName}>{c.full_name}</div>
                            {c.description && <div style={s.candDesc}>{c.description}</div>}
                          </div>
                        </button>
                      )
                    })}
                    {male.length === 0 && <div style={{color:"#6b7280"}}>No hay candidatos.</div>}
                  </div>
                </div>

                {okMsg && <div style={{...s.card, ...s.ok}}>{okMsg}</div>}

                <div style={{ display:"flex", justifyContent:"flex-end", marginTop:12 }}>
                  <button
                    style={{
                      display:"inline-flex", justifyContent:"center", alignItems:"center",
                      padding:"12px 16px", borderRadius:12, border:"1px solid " + (ready && !saving ? "#16a34a" : "#9ca3af"),
                      background: ready && !saving ? "#16a34a" : "#e5e7eb",
                      color: ready && !saving ? "#fff" : "#6b7280",
                      fontWeight:800, cursor: ready && !saving ? "pointer" : "not-allowed", minWidth:180
                    }}
                    disabled={!ready || saving}
                    onClick={submit}
                  >
                    {saving ? "Guardando..." : "Guardar voto"}
                  </button>
                </div>
              </>
            )}

            {/* Errores (si los hubiera) */}
            {err && <div style={{...s.card, color:"#b91c1c"}}>{err}</div>}
          </>
        )}
      </main>

      <footer style={{ padding:24, textAlign:"center", color:"#6b7280", fontSize:12 }}>
        IMJP · Módulo de Votaciones
      </footer>
    </div>
  )
}

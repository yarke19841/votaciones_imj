// src/pages/admin/AdminResults.jsx
import { useEffect, useMemo, useState } from "react"
import { useParams, Link } from "react-router-dom"
import { supabase } from "../../lib/supabase"

export default function AdminResults() {
  // Soporta /admin/elections/:id/results o /admin/results (con selector)
  const routeParams = useParams()
  const routeId = routeParams?.id || null

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [closedList, setClosedList] = useState([])      // [{id,title,closed_at,opened_at}]
  const [selectedId, setSelectedId] = useState(routeId) // elección elegida

  const [election, setElection] = useState(null)
  const [candidates, setCandidates] = useState([])      // [{id, full_name, gender, active, description, photo_url}]
  const [validVotes, setValidVotes] = useState([])      // votos dentro de ventana
  const [lateVotes, setLateVotes]   = useState([])      // votos fuera de ventana (excluidos)
  const [members, setMembers]       = useState({})      // {member_id: full_name}
  const [csvHref, setCsvHref]       = useState("")
  const [padronCount, setPadronCount] = useState(0)     // total filas en member
  const [asistenciaCount, setAsistenciaCount] = useState(0) // total filas en attendance_voter por elección

  // ---------- estilos mínimos ----------
  const s = useMemo(()=>({
    page:{ fontFamily:"system-ui,-apple-system,Segoe UI,Roboto", background:"#f3f4f6", minHeight:"100vh" },
    wrap:{ maxWidth:1100, margin:"0 auto", padding:"24px 16px" },
    head:{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16, gap:12, flexWrap:"wrap" },
    title:{ fontSize:22, fontWeight:800 },
    crumb:{ fontSize:13, color:"#64748b" },
    link:{ color:"#2563eb", textDecoration:"none" },
    select:{ padding:"10px 12px", borderRadius:10, border:"1px solid #d1d5db", background:"#fff", minWidth:280 },
    btn:{ padding:"10px 14px", borderRadius:10, border:"1px solid #111827", background:"#111827", color:"#fff", fontWeight:800, cursor:"pointer" },
    btnGhost:{ padding:"10px 14px", borderRadius:10, border:"1px solid #e5e7eb", background:"#fff", color:"#111827", fontWeight:700, cursor:"pointer" },
    card:{ background:"#fff", border:"1px solid #e5e7eb", borderRadius:12, padding:16, marginTop:16 },
    h:{ fontSize:16, fontWeight:800, marginBottom:10 },
    grid2:{ display:"grid", gap:16, gridTemplateColumns:"1fr 1fr" },
    row:{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"8px 0", borderBottom:"1px dashed #e5e7eb" },
    rowLast:{ borderBottom:"none" },
    badges:{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" },
    b:(bg)=>({ display:"inline-flex", alignItems:"center", gap:6, padding:"2px 8px", borderRadius:999, fontSize:12, fontWeight:700, border:"1px solid #e5e7eb", background:bg }),
    muted:{ fontSize:13, color:"#6b7280" },
    err:{ background:"#fef2f2", border:"1px solid #fecaca", color:"#991b1b", padding:12, borderRadius:10, fontSize:14, marginTop:12 },
    kpis:{ display:"grid", gap:12, gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))", marginTop:16 },
    winnersList:{ display:"flex", flexWrap:"wrap", gap:8, marginTop:8 },
    tag:{ padding:"4px 10px", border:"1px solid #e5e7eb", borderRadius:999, background:"#ecfdf5", color:"#065f46", fontSize:12, fontWeight:800 },

    banner:{
      marginTop: 8,
      marginBottom: 12,
      padding: "16px 20px",
      borderRadius: 12,
      background: "#1e3a8a",
      color: "white",
      textAlign: "center",
      boxShadow: "0 8px 20px rgba(0,0,0,.15)"
    },
    bannerMain:{ fontSize: 24, fontWeight: 900 },
    bannerSub:{ marginTop: 6, fontSize: 14, opacity:.95, display:"flex", gap:12, justifyContent:"center", flexWrap:"wrap" },
    chip:(bg="#0ea5e9")=>({
      display:"inline-flex", alignItems:"center", gap:6,
      padding:"4px 10px", borderRadius:999, fontWeight:800,
      background:bg, color:"#06263a"
    }),
    chipAlt:(bg="#facc15")=>({
      display:"inline-flex", alignItems:"center", gap:6,
      padding:"4px 10px", borderRadius:999, fontWeight:800,
      background:bg, color:"#1e1b4b"
    })
  }),[])

  // ---------- cargar elecciones cerradas (para el selector) ----------
  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const { data, error } = await supabase
          .from("election")
          .select("id,title,closed_at,status,opened_at")
          .or("status.eq.cerrada,closed_at.not.is.null")
          .order("closed_at", { ascending:false })
        if (error) throw error
        if (!alive) return
        const list = (data || []).map(x => ({
          id: x.id,
          title: x.title || "(Sin título)",
          closed_at: x.closed_at,
          opened_at: x.opened_at
        }))
        setClosedList(list)
        // Si no viene id por ruta y hay cerradas, auto-selecciona la más reciente
        if (!routeId && list.length > 0) setSelectedId(prev => prev || list[0].id)
      } catch (e) {
        console.error(e)
        if (alive) setError("No se pudieron cargar las elecciones cerradas.")
      }
    })()
    return () => { alive = false }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeId])

  // ---------- cargar resultados para selectedId ----------
  useEffect(() => {
    let alive = true
    ;(async () => {
      if (!selectedId) { setElection(null); return }
      try {
        setLoading(true); setError("")
        // Elección
        const { data: eRow, error: eErr } = await supabase
          .from("election")
          .select("id,title,required_male,required_female,opened_at,closed_at")
          .eq("id", selectedId)
          .single()
        if (eErr) throw eErr
        if (!alive) return
        setElection(eRow)

        // Candidatos
        const { data: cRows, error: cErr } = await supabase
          .from("candidate")
          .select("id, full_name, gender, active, description, photo_url")
          .eq("election_id", selectedId)
        if (cErr) throw cErr
        const onlyActive = (cRows || []).filter(c => c.active !== false)
        if (!alive) return
        setCandidates(onlyActive)

        // Votos (cast_vote: una fila por candidato votado)
        const { data: vRows, error: vErr } = await supabase
          .from("cast_vote")
          .select("id,election_id,voter_member_id,candidate_id,created_at")
          .eq("election_id", selectedId)
        if (vErr) throw vErr

        const openedAt = eRow.opened_at ? new Date(eRow.opened_at).getTime() : -Infinity
        const closedAt = eRow.closed_at ? new Date(eRow.closed_at).getTime() : Date.now()

        const _valid = []
        const _late  = []
        for (const v of (vRows || [])) {
          const t = v.created_at ? new Date(v.created_at).getTime() : 0
          if (t >= openedAt && t <= closedAt) _valid.push(v)
          else _late.push(v)
        }
        if (!alive) return
        setValidVotes(_valid)
        setLateVotes(_late)

        // Nombres de miembros (si existe tabla member) para mostrar nombres de los excluidos
        const memberIds = Array.from(new Set((vRows || []).map(v => v.voter_member_id).filter(Boolean)))
        if (memberIds.length) {
          const { data: mRows } = await supabase
            .from("member")
            .select("id, full_name")
            .in("id", memberIds)
          if (alive && mRows) {
            const map = {}
            mRows.forEach(m => { map[m.id] = m.full_name })
            setMembers(map)
          }
        }

        // PADRÓN (total miembros)
        {
          const { count } = await supabase
            .from("member")
            .select("id", { count:"exact", head:true })
          if (alive && typeof count === "number") setPadronCount(count || 0)
        }

        // ASISTENCIA (attendance_voter por elección)
        {
          const { count } = await supabase
            .from("attendance_voter")
            .select("member_id", { count:"exact", head:true })
            .eq("election_id", selectedId)
          if (alive && typeof count === "number") setAsistenciaCount(count || 0)
        }

      } catch (e) {
        console.error(e)
        if (alive) setError("No se pudieron cargar los resultados de la elección seleccionada.")
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => { alive = false }
  }, [selectedId])

  // ---------- agregaciones ----------
  const counts = useMemo(() => {
    const map = new Map()
    for (const v of validVotes) {
      map.set(v.candidate_id, (map.get(v.candidate_id) || 0) + 1)
    }
    return map
  }, [validVotes])

  const validVotersCount = useMemo(() => {
    return new Set(validVotes.map(v => v.voter_member_id)).size
  }, [validVotes])

  const lateVotersCount = useMemo(() => {
    return new Set(lateVotes.map(v => v.voter_member_id)).size
  }, [lateVotes])

  const pct = (num, den) => {
    if (!den || den <= 0) return "—"
    return `${(100 * (num/den)).toFixed(1)}%`
  }

  function rankByGender(genderLetter) {
    return candidates
      .filter(c => (c.gender || "").toUpperCase() === genderLetter)
      .map(c => ({ id:c.id, name:c.full_name, gender:genderLetter, votes: counts.get(c.id) || 0 }))
      .sort((a,b) => b.votes - a.votes || a.name.localeCompare(b.name))
  }

  const menRank   = useMemo(() => rankByGender("M"), [candidates, counts])
  const womenRank = useMemo(() => rankByGender("F"), [candidates, counts])

  function computeWinners(rank, slots) {
    if (slots <= 0) return { rows: rank.map(r => ({...r, status:"Fuera"})), hasTie:false, winners:[] }
    const rows = rank.map(r => ({...r}))
    const kthScore = rows[slots - 1] ? rows[slots - 1].votes : -Infinity

    rows.forEach((r, idx) => { r.status = idx < slots ? "GANADOR" : "FUERA" })

    let hasTie = false
    if (kthScore >= 0) {
      const countAbove  = rows.filter(r => r.votes > kthScore).length
      const tiedAtCut   = rows.filter(r => r.votes === kthScore)
      const remaining   = Math.max(0, slots - countAbove)
      if (tiedAtCut.length > remaining) {
        hasTie = true
        rows.forEach(r => { if (r.votes === kthScore) r.status = "EMPATE" })
      }
    }
    const winners = rows.filter(r => r.status === "GANADOR")
    return { rows, hasTie, winners }
  }

  const maleSlots   = election?.required_male   ?? 0
  const femaleSlots = election?.required_female ?? 0

  const menW   = useMemo(() => computeWinners(menRank, maleSlots),     [menRank,   maleSlots])
  const womenW = useMemo(() => computeWinners(womenRank, femaleSlots), [womenRank, femaleSlots])

  const hasTie = menW.hasTie || womenW.hasTie

  // ---------- crear ronda de desempate (con copia de asistencia habilitada) ----------
  async function createTieRound(gender /* "M" | "F" */){
    try{
      const pack = gender === "M" ? menW : womenW
      const tied = (pack.rows || []).filter(r => r.status === "EMPATE")
      const winnersCount = (pack.rows || []).filter(r => r.status === "GANADOR").length
      const totalSlots = gender === "M"
        ? (election?.required_male ?? 0)
        : (election?.required_female ?? 0)
      const remainingSlots = Math.max(0, totalSlots - winnersCount)

      if (tied.length === 0 || remainingSlots === 0) {
        alert("No hay empatados o no hay cupos pendientes para este género.")
        return
      }

      const tiedIds = tied.map(t => t.id)

      // Usa exactamente los literales que acepta tu esquema ('oficial' vs 'official', 'abierta' vs 'borrador')
      const { data, error } = await supabase.rpc("admin_setup_tie_round_with_attendance", {
        p_source_election_id: election.id,
        p_gender: gender,
        p_remaining_slots: remainingSlots,
        p_tied_candidate_ids: tiedIds,
        p_pool: 'oficial',       // Debe coincidir con tu CHECK en candidate.pool
        p_status: 'abierta',     // Si prefieres abrirla de una vez; usa 'borrador' si no
        p_copy_checked_in: true  // ⬅️ Copia checked_in_at (evita NOT NULL y habilita a todos)
      })
      if (error) throw error

      const rec = data?.[0] || {}
      alert(`Ronda creada (ID: ${rec.new_election_id}). Candidatos: ${rec.inserted_candidates}. Asistencia copiada: ${rec.seeded_attendance}.`)

      // Opcional: redirigir a configurar/abrir la nueva elección:
      // navigate(`/admin/elections/${rec.new_election_id}/config`)
    }catch(e){
      console.error(e)
      alert(`No se pudo crear la ronda:\n${e?.message || e}`)
    }
  }

  // ---------- export CSV ----------
  useEffect(() => {
    if (!election) return
    const all = [
      ...menW.rows.map(r => ({ genero:"M", candidato:r.name, votos:r.votes, estado:r.status })),
      ...womenW.rows.map(r => ({ genero:"F", candidato:r.name, votos:r.votes, estado:r.status })),
    ]
    const header = ["Genero","Candidato","Votos","Estado"]
    const lines = [header.join(",")]
    for (const r of all) lines.push([r.genero, `"${(r.candidato||"").replace(/"/g,'""')}"`, r.votos, r.estado].join(","))
    const blob = new Blob([lines.join("\n")], { type:"text/csv;charset=utf-8;" })
    const url  = URL.createObjectURL(blob)
    setCsvHref(url)
    return () => URL.revokeObjectURL(url)
  }, [election, menW.rows, womenW.rows])

  // ---------- agrupación de excluidos: UNA LÍNEA POR PERSONA ----------
  const lateMembers = useMemo(() => {
    const map = new Map()
    for (const v of lateVotes) {
      const k = v.voter_member_id
      if (!k) continue
      if (!map.has(k)) {
        map.set(k, { member_id: k, firstAt: v.created_at || null, count: 1 })
      } else {
        const rec = map.get(k)
        rec.count += 1
        if (v.created_at && (!rec.firstAt || new Date(v.created_at) < new Date(rec.firstAt))) {
          rec.firstAt = v.created_at
        }
        map.set(k, rec)
      }
    }
    const arr = Array.from(map.values())
    // Ordena por nombre si lo tenemos; si no, por fecha
    arr.sort((a,b) => {
      const an = (members[a.member_id] || "").toLowerCase()
      const bn = (members[b.member_id] || "").toLowerCase()
      if (an && bn) return an.localeCompare(bn)
      return (new Date(a.firstAt || 0)) - (new Date(b.firstAt || 0))
    })
    return arr
  }, [lateVotes, members])

  // ---------- UI ----------
  const Selector = (
    <div style={{display:"flex", gap:8, alignItems:"center", flexWrap:"wrap"}}>
      <select
        value={selectedId || ""}
        onChange={e => setSelectedId(e.target.value || null)}
        style={s.select}
      >
        {closedList.length === 0 && <option value="">(No hay elecciones cerradas)</option>}
        {closedList.length > 0 && closedList.map(x => (
          <option key={x.id} value={x.id}>
            {x.title} {x.closed_at ? `— Cerrada: ${new Date(x.closed_at).toLocaleString()}` : ""}
          </option>
        ))}
      </select>
      <Link to="/admin/elections" style={s.link}>← Volver a Elecciones</Link>
    </div>
  )

  return (
    <div style={s.page}>
      <div style={s.wrap}>
        <div style={s.head}>
          <div>
            <div style={s.crumb}>
              <Link to="/admin/elections" style={s.link}>Elecciones</Link> · Resultados
            </div>
            <div style={s.title}>Resultados</div>
          </div>
          {Selector}
        </div>

        {error && <div style={s.err}>{error}</div>}

        {!selectedId ? (
          <div style={s.card}>
            <div style={s.h}>Selecciona una elección cerrada</div>
            <div style={s.muted}>Cuando cierres una elección, aparecerá aquí para consultar sus resultados.</div>
          </div>
        ) : (
          <>
            {loading || !election ? (
              <div style={s.card}><div style={s.muted}>Cargando resultados…</div></div>
            ) : (
              <>
                {/* ===== Banner de totales y participación ===== */}
                <div style={s.banner}>
                  <div style={s.bannerMain}>
                    Votantes válidos: {validVotersCount}
                    {lateVotersCount > 0 && (
                      <span style={{ marginLeft:12 }}>
                        (+{lateVotersCount} fuera de horario)
                      </span>
                    )}
                  </div>
                  <div style={s.bannerSub}>
                    <span style={s.chip()}>
                      Asistencia: <b style={{marginLeft:6}}>{asistenciaCount}</b>
                    </span>
                    <span style={s.chip("#34d399")}>
                      Padrón: <b style={{marginLeft:6}}>{padronCount}</b>
                    </span>
                    <span style={s.chipAlt("#fde047")}>
                      Part. sobre asistentes: <b style={{marginLeft:6}}>{pct(validVotersCount, asistenciaCount)}</b>
                    </span>
                    <span style={s.chipAlt("#fda4af")}>
                      Part. sobre padrón: <b style={{marginLeft:6}}>{pct(validVotersCount, padronCount)}</b>
                    </span>
                  </div>
                </div>

                {/* Resumen */}
                <div style={{display:"flex", alignItems:"center", justifyContent:"space-between", gap:12, flexWrap:"wrap"}}>
                  <div style={{fontSize:14, color:"#64748b"}}>
                    Ventana válida: {election?.opened_at ? new Date(election.opened_at).toLocaleString() : "—"}
                    &nbsp;→&nbsp;
                    {election?.closed_at ? new Date(election.closed_at).toLocaleString() : "(aún abierta)"}
                  </div>
                  <a href={csvHref} download={`resultados_${election?.id||"election"}.csv`} style={s.btn}>Exportar CSV</a>
                </div>

                {/* Ganadores */}
                <div style={s.kpis}>
                  <div style={s.card}>
                    <div style={s.h}>Ganadores Hombres ({maleSlots})</div>
                    {menW.winners.length === 0
                      ? <div style={s.muted}>—</div>
                      : <div style={s.winnersList}>
                          {menW.winners.map(w => <span key={w.id} style={s.tag}>{w.name} · {w.votes}</span>)}
                        </div>}
                  </div>
                  <div style={s.card}>
                    <div style={s.h}>Ganadoras Mujeres ({femaleSlots})</div>
                    {womenW.winners.length === 0
                      ? <div style={s.muted}>—</div>
                      : <div style={s.winnersList}>
                          {womenW.winners.map(w => <span key={w.id} style={s.tag}>{w.name} · {w.votes}</span>)}
                        </div>}
                  </div>
                </div>

                {/* Listados por género */}
                <div style={s.grid2}>
                  {/* Hombres */}
                  <div style={s.card}>
                    <div style={s.h}>Hombres</div>
                    {menW.rows.length === 0 && <div style={s.muted}>No hay candidatos hombres.</div>}
                    {menW.rows.map((r, idx) => {
                      const last = idx === menW.rows.length - 1
                      return (
                        <div key={r.id} style={{...s.row, ...(last ? s.rowLast : {})}}>
                          <div>{r.name}</div>
                          <div style={s.badges}>
                            <span style={s.b("#eff6ff")}>Votos: <b>{r.votes}</b></span>
                            {r.status === "GANADOR" && <span style={s.b("#ecfdf5")}>GANADOR</span>}
                            {r.status === "EMPATE"  && <span style={s.b("#fff7ed")}>EMPATE</span>}
                            {r.status === "FUERA"   && <span style={s.b("#f1f5f9")}>FUERA</span>}
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {/* Mujeres */}
                  <div style={s.card}>
                    <div style={s.h}>Mujeres</div>
                    {womenW.rows.length === 0 && <div style={s.muted}>No hay candidatas mujeres.</div>}
                    {womenW.rows.map((r, idx) => {
                      const last = idx === womenW.rows.length - 1
                      return (
                        <div key={r.id} style={{...s.row, ...(last ? s.rowLast : {})}}>
                          <div>{r.name}</div>
                          <div style={s.badges}>
                            <span style={s.b("#eff6ff")}>Votos: <b>{r.votes}</b></span>
                            {r.status === "GANADOR" && <span style={s.b("#ecfdf5")}>GANADOR</span>}
                            {r.status === "EMPATE"  && <span style={s.b("#fff7ed")}>EMPATE</span>}
                            {r.status === "FUERA"   && <span style={s.b("#f1f5f9")}>FUERA</span>}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Empates: crear rondas */}
                {hasTie && (
                  <div style={{...s.card, display:"flex", justifyContent:"space-between", alignItems:"center", gap:8, flexWrap:"wrap"}}>
                    <div>
                      <div style={{fontWeight:800}}>Empate detectado</div>
                      <div style={s.muted}>Crea una ronda de desempate solo con los empatados y los cupos restantes.</div>
                    </div>
                    <div style={{display:"flex", gap:8, flexWrap:"wrap"}}>
                      {menW.hasTie && (
                        <button style={s.btnGhost} onClick={() => createTieRound("M")}>
                          Desempate — Hombres
                        </button>
                      )}
                      {womenW.hasTie && (
                        <button style={s.btnGhost} onClick={() => createTieRound("F")}>
                          Desempate — Mujeres
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* Votos fuera de horario — UNA LÍNEA POR PERSONA */}
                <div style={s.card}>
                  <div style={s.h}>Votos excluidos por horario</div>
                  {lateMembers.length === 0 ? (
                    <div style={s.muted}>No se encontraron votos fuera de la ventana válida.</div>
                  ) : (
                    <>
                      <div style={{...s.muted, marginBottom:8}}>
                        Personas con voto no válido: <b>{lateMembers.length}</b>
                      </div>

                      {/* Encabezado simple (una sola columna) */}
                      <div style={{
                        display:"grid", gridTemplateColumns:"1fr",
                        gap:8, fontSize:13, fontWeight:700, color:"#374151",
                        paddingBottom:6, borderBottom:"1px solid #e5e7eb"
                      }}>
                        <div>Votante</div>
                      </div>

                      {/* Una línea por persona */}
                      {lateMembers.map(m => (
                        <div key={m.member_id} style={{
                          display:"grid", gridTemplateColumns:"1fr",
                          gap:8, padding:"8px 0",
                          borderBottom:"1px dashed #e5e7eb"
                        }}>
                          <div>
                            {members[m.member_id] || `member:${m.member_id}`}
                            <span style={{
                              marginLeft:8, padding:"2px 8px", borderRadius:999,
                              fontSize:12, fontWeight:700,
                              border:"1px solid #fecaca", background:"#fef2f2", color:"#991b1b"
                            }}>
                              Voto no válido (fuera de horario)
                            </span>
                          </div>
                        </div>
                      ))}

                      <div style={{marginTop:6, fontSize:12, color:"#6b7280"}}>
                        * Las personas listadas emitieron su(s) voto(s) fuera de <b>opened_at → closed_at</b>.
                      </div>
                    </>
                  )}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}

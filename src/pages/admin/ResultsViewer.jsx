import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { logoutAdmin } from '../../lib/authAdmin'
import { classifyResults } from '../../lib/adminResults'
import { AdminNavigation, AdminPageHeader, ResultPanels } from '../../components/AdminReferenceUI'

const kindLabel = kind => ({ practice: 'Simulacro', official: 'Oficial', tie: 'Desempate' }[kind] || kind)
const sections = [['results', 'Resultados', 'chart']]
const csvCell = value => `"${String(value ?? '').replace(/^[\s]*[=+@\-]/, "'$&").replaceAll('"', '""')}"`
async function call(name, args = {}) {
  const { data, error } = await supabase.rpc(name, args)
  if (error) throw error
  return data
}

export default function ResultsViewer() {
  const [snapshot, setSnapshot] = useState({ elections: [], rounds: [] })
  const [electionId, setElectionId] = useState(''), [roundId, setRoundId] = useState('')
  const [result, setResult] = useState(null), [msg, setMsg] = useState(''), [busy, setBusy] = useState(true)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuToggle = useRef(null), menuClose = useRef(null), request = useRef(0)
  const closeMenu = useCallback(() => { setMenuOpen(false); menuToggle.current?.focus() }, [])
  useEffect(() => {
    if (!menuOpen) return
    menuClose.current?.focus()
    const escape = e => { if (e.key === 'Escape') closeMenu() }
    document.addEventListener('keydown', escape)
    return () => document.removeEventListener('keydown', escape)
  }, [menuOpen, closeMenu])

  const refresh = useCallback(async () => {
    const version = ++request.current
    setBusy(true); setMsg(''); setResult(null)
    try {
      const data = await call('voting_results_snapshot')
      const selected = data.elections.some(e => e.id === electionId) ? electionId : data.elections[0]?.id || ''
      const rounds = data.rounds.filter(r => r.election_id === selected)
      const chosen = rounds.some(r => r.id === roundId) ? roundId : rounds[0]?.id || ''
      const detail = chosen ? await call('voting_results_read', { p_round_id: chosen }) : null
      if (version !== request.current) return
      setSnapshot(data); setElectionId(selected); setRoundId(chosen)
      setResult(detail ? { ...detail, rows: classifyResults(detail.rows, detail.round) } : null)
    } catch (error) {
      if (version !== request.current) return
      setSnapshot({ elections: [], rounds: [] }); setResult(null); setMsg(error.message || 'No se pudieron consultar los resultados.')
    } finally { if (version === request.current) setBusy(false) }
  }, [electionId, roundId])
  useEffect(() => {
    refresh()
    return () => { request.current += 1 }
  }, [refresh])
  function exportCsv() {
    if (!result || busy) return
    const year = snapshot.elections.find(e => e.id === result.round.election_id)?.election_year
    const rows = [['Año', 'Tipo', 'Ronda', 'Candidato', 'Género', 'Votos', 'Estado por cupo'], ...result.rows.map(r => [year, kindLabel(result.round.round_kind), result.round.round_number, r.full_name, r.gender, r.vote_count, r.result_status])]
    const text = '\uFEFF' + rows.map(row => row.map(csvCell).join(',')).join('\r\n')
    const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' })), a = document.createElement('a')
    a.href = url; a.download = `resultados-${year}-${result.round.round_kind}-${result.round.round_number}.csv`
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url)
  }
  return <main className="admin-page admin-with-navigation">
    {menuOpen && <button className="admin-menu-backdrop" aria-label="Cerrar menú lateral" onClick={closeMenu}/>}
    <AdminNavigation view="results" sections={sections} open={menuOpen} closeRef={menuClose} onClose={closeMenu} onSelect={closeMenu}/>
    <AdminPageHeader title="Resultados" elections={snapshot.elections} selected={electionId} onElectionChange={id => { request.current += 1; setResult(null); setElectionId(id); setRoundId('') }} busy={busy} onRefresh={refresh} onExit={async () => { await logoutAdmin(); location.hash = '/admin/login' }} onMenu={() => menuOpen ? closeMenu() : setMenuOpen(true)} menuRef={menuToggle} menuOpen={menuOpen}/>
    <p className="notice">Acceso de solo consulta · Resultados de rondas cerradas.</p>
    {msg && <p className="error" role="alert">{msg}</p>}
    <section className="admin-grid"><article className="card full">
      {busy ? <p role="status">Cargando resultados…</p> : <>
        {snapshot.rounds.some(r => r.election_id === electionId) && <label className="reference-round-select">Tipo y ronda<select value={roundId} onChange={e => { request.current += 1; setResult(null); setRoundId(e.target.value) }}>{snapshot.rounds.filter(r => r.election_id === electionId).map(r => <option key={r.id} value={r.id}>{kindLabel(r.round_kind)} · Ronda {r.round_number}</option>)}</select></label>}
        {result ? <ResultPanels rows={result.rows} voterCount={result.round.voter_count} onExport={exportCsv}/> : !msg && <p>Los resultados estarán disponibles cuando Administración cierre una votación.</p>}
      </>}
    </article></section>
  </main>
}

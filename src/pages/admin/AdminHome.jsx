import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { getAdminSession, logoutAdmin } from '../../lib/authAdmin'
import RegistrationDesk from './RegistrationDesk'
import AdminQuickCheckIn from './AdminQuickCheckIn'
import { classifyResults } from '../../lib/adminResults'
import { AdminNavigation, AdminPageHeader, CandidateWorkspace, ResultPanels } from '../../components/AdminReferenceUI'
import RosterImport from './RosterImport'
import { rosterCsv } from '../../lib/rosterCsv'

const call = async (name, args = {}) => {
  const { data, error } = await supabase.rpc(name, args)
  if (error) throw error
  return data
}
const blankElection = () => ({ id: null, year: '', title: '', male: '', female: '', lat: '', lng: '', radius: '' })
const blankCandidate = () => ({ id: null, name: '', gender: 'F', photo: '', practice: false, active: true })
const kindLabel = kind => ({ practice: 'Simulacro', official: 'Oficial', tie: 'Desempate' }[kind] || kind)
const statusLabel = status => ({ draft: 'Preparación', checkin: 'Ingreso abierto', open: 'Votación abierta', closed: 'Cerrada' }[status] || status)
const electionDraft = e => ({ id: e.id, year: e.election_year, title: e.title, male: e.male_slots, female: e.female_slots, lat: e.church_latitude ?? '', lng: e.church_longitude ?? '', radius: e.radius_meters ?? '' })
const numeric = value => value === '' ? null : Number(value)
const personGroups = person => person.groups || (person.group_name ? [{ id: person.group_id ?? person.group_name, name: person.group_name }] : [])
const rosterPeople = roster => Array.isArray(roster) ? roster : (roster?.people || roster?.rows || [])
const csvCell = value => `"${String(value ?? '').replace(/^[=+@\-]/, "'$&").replaceAll('"', '""')}"`

export default function AdminHome() {
  const [data, setData] = useState({ elections: [], candidates: [], rounds: [] })
  const [role, setRole] = useState(null), [msg, setMsg] = useState(''), [busy, setBusy] = useState(false)
  const [election, setElection] = useState(blankElection), [selectedElection, setSelectedElection] = useState('')
  const [candidate, setCandidate] = useState(blankCandidate), [photoFile, setPhotoFile] = useState(null), [photoKey, setPhotoKey] = useState(0)
  const pendingRequest = useRef(0)
  const [people, setPeople] = useState([]), [personId, setPersonId] = useState(''), [cedula, setCedula] = useState(''), [group, setGroup] = useState('')
  const [selectedRound, setSelectedRound] = useState(''), [pending, setPending] = useState([]), [tiePolicy, setTiePolicy] = useState('')
  const [exceptions, setExceptions] = useState([]), [exception, setException] = useState({ person: '', from: '', until: '', reason: '' })
  const [churchLocation, setChurchLocation] = useState(null)
  const [results, setResults] = useState(null)
  const [view, setView] = useState('operation')
  const [menuOpen, setMenuOpen] = useState(false)
  const menuToggle = useRef(null), menuClose = useRef(null)
  function closeMenu() { setMenuOpen(false); menuToggle.current?.focus() }
  useEffect(() => {
    if (!menuOpen) return
    menuClose.current?.focus()
    function escape(event) { if (event.key === 'Escape') { setMenuOpen(false); menuToggle.current?.focus() } }
    document.addEventListener('keydown', escape)
    return () => document.removeEventListener('keydown', escape)
  }, [menuOpen])
  const isAdmin = role === 'admin'
  const current = useMemo(() => data.elections.find(e => e.id === selectedElection), [data.elections, selectedElection])
  const coverage = data.member_coverage
  const rounds = data.rounds.filter(r => r.election_id === selectedElection)
  const candidates = data.candidates.filter(c => c.is_practice_reference || c.election_id === selectedElection)
  const groups = [...new Map(people.flatMap(personGroups).map(g => [String(g.id), g])).values()].sort((a, b) => a.name.localeCompare(b.name))
  const visiblePeople = people.filter(p => !group || personGroups(p).some(g => String(g.id) === group))

  const refresh = useCallback(async access => {
    const snapshot = await call(access === 'admin' ? 'voting_admin_snapshot' : 'voting_staff_snapshot')
    if (access === 'admin') setChurchLocation(await call('voting_admin_church_location'))
    setData({ elections: [], candidates: [], rounds: [], ...snapshot })
    setSelectedElection(id => id || snapshot.elections?.[0]?.id || '')
  }, [])
  useEffect(() => {
    let alive = true
    getAdminSession().then(async session => {
      if (!alive) return
      if (!session) { setMsg('La sesión no está disponible. Vuelve a iniciar sesión.'); return }
      setRole(session.votingRole)
      try { if (session.votingRole !== 'registration') await refresh(session.votingRole) } catch (e) { if (alive) setMsg(e.message) }
    }).catch(e => { if (alive) setMsg(e.message) })
    return () => { alive = false }
  }, [refresh])
  useEffect(() => {
    let alive = true
    pendingRequest.current += 1
    setPeople([]); setPersonId(''); setCedula(''); setGroup(''); setSelectedRound(''); setPending([]); setResults(null); setExceptions([]); setCandidate(blankCandidate()); setPhotoFile(null); setPhotoKey(key => key + 1)
    if (selectedElection) call('voting_staff_roster', { p_election_id: selectedElection }).then(roster => { if (alive) setPeople(rosterPeople(roster)) }).catch(e => { if (alive) setMsg(e.message) })
    return () => { alive = false }
  }, [selectedElection])

  useEffect(() => { if (current) setElection(electionDraft(current)) }, [current])

  async function loadPending(id, propagate = false) {
    const request = ++pendingRequest.current
    setSelectedRound(id); setPending([]); setExceptions([])
    if (!id) return
    try {
      const [rows, approved] = await Promise.all([call('voting_staff_pending', { p_round_id: id }), isAdmin ? call('voting_admin_exceptions', { p_round_id: id }) : Promise.resolve([])])
      if (request === pendingRequest.current) { setPending(rows); setExceptions(approved) }
    } catch (e) { if (propagate) throw e; setMsg(e.message) }
  }
  async function run(fn, message = 'Cambio guardado.') {
    setBusy(true); setMsg('')
    try {
      await fn(); await refresh(role)
      if (selectedElection) setPeople(rosterPeople(await call('voting_staff_roster', { p_election_id: selectedElection })))
      if (selectedRound) await loadPending(selectedRound, true)
      setMsg(message)
    } catch (e) { setMsg(e.message) } finally { setBusy(false) }
  }
  async function saveElection(event) {
    event.preventDefault()

    return run(async () => {
      const id = await call('voting_admin_save_election', {
        p_id: election.id, p_year: numeric(election.year), p_title: election.title.trim(),
        p_male_slots: numeric(election.male), p_female_slots: numeric(election.female),
        p_latitude: churchLocation?.latitude ?? null, p_longitude: churchLocation?.longitude ?? null, p_radius_meters: numeric(election.radius),
      })
      setSelectedElection(id); setElection({ ...election, id })
    })
  }
  async function saveCandidate(event) {
    event.preventDefault()
    return run(async () => {
      let photo = candidate.photo || null
      if (photoFile) {
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(photoFile.type) || photoFile.size > 5242880) throw new Error('Usa JPG, PNG o WebP de hasta 5 MB.')
        const path = `${view === 'practice' ? 'practice-2026' : selectedElection}/${crypto.randomUUID()}.${photoFile.type.split('/')[1]}`
        const { error } = await supabase.storage.from('voting-photos').upload(path, photoFile, { contentType: photoFile.type, upsert: false })
        if (error) throw error
        photo = path
      }
      await call('voting_admin_save_candidate', { p_id: candidate.id, p_election_id: view === 'practice' ? null : selectedElection,
        p_full_name: candidate.name.trim(), p_gender: candidate.gender, p_photo_url: photo, p_practice: view === 'practice', p_active: candidate.active })
      setCandidate(blankCandidate()); setPhotoFile(null); setPhotoKey(key => key + 1)
    })
  }
  function editCandidate(c) { setCandidate({ id: c.id, name: c.full_name, gender: c.gender, photo: c.photo_url || '', practice: c.is_practice_reference, active: c.active }); setPhotoFile(null); setPhotoKey(key => key + 1); requestAnimationFrame(() => document.querySelector('.reference-candidate-form')?.scrollIntoView({ block: 'start', behavior: 'smooth' })) }
  async function makeRound(kind) {
    const ids = candidates.filter(c => c.active && (kind === 'practice' ? c.is_practice_reference : !c.is_practice_reference)).map(c => c.id)
    const existing = rounds.find(r => r.round_kind === kind && r.round_number === 1)
    return run(() => call('voting_admin_save_round', { p_id: existing?.id || null, p_election_id: selectedElection, p_kind: kind,
      p_number: 1, p_attendance_policy: 'new', p_male_slots: current.male_slots, p_female_slots: current.female_slots, p_candidate_ids: ids }))
  }
  async function enablePerson(enabled) {
    return run(async () => {
      await call('voting_enable_person', { p_election_id: selectedElection, p_person_id: Number(personId), p_cedula: cedula.trim(), p_enabled: enabled }); setCedula('')
    })
  }
  async function saveException(event) {
    event.preventDefault()
    if (new Date(exception.until) <= new Date(exception.from)) return setMsg('La vigencia final debe ser posterior al inicio.')
    return run(() => call('voting_admin_set_exception', { p_round_id: selectedRound, p_person_id: Number(exception.person),
      p_valid_from: new Date(exception.from).toISOString(), p_valid_until: new Date(exception.until).toISOString(), p_reason: exception.reason.trim() }))
  }
  async function showResults(round, propagate = false) {
    try { const rows = await call('voting_admin_results', { p_round_id: round.id }); setResults({ round, rows: classifyResults(rows, round) }); setView('results') } catch (e) { if (propagate) throw e; setMsg(e.message) }
  }
  async function closeActive() {
    return run(async () => {
      const closed = await call('voting_admin_close_active')
      const round = data.rounds.find(r => r.id === (closed.round_id || closed.id)) || data.rounds.find(r => r.status === 'open')
      if (round) { await showResults({ ...round, status: 'closed' }, true); setView('results') }
    }, 'Votación activa cerrada. Sus resultados están disponibles.')
  }
  function exportCsv() {
    const { round, rows } = results
    const year = data.elections.find(e => e.id === round.election_id)?.election_year
    const text = '\uFEFF' + [['Año', 'Tipo', 'Ronda', 'Candidato', 'Género', 'Votos', 'Estado por cupo'], ...rows.map(r => [year, kindLabel(round.round_kind), round.round_number, r.full_name, r.gender, r.vote_count, r.result_status])].map(row => row.map(csvCell).join(',')).join('\r\n')
    const a = document.createElement('a'), url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }))
    a.href = url; a.download = `resultados-${year}-${round.round_kind}-${round.round_number}.csv`; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url)
  }
  function exportRoster(enabled) {
    const text = rosterCsv(visiblePeople.filter(p => p.enabled === enabled))
    const a = document.createElement('a'), url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }))
    a.href = url; a.download = `padron-${current?.election_year || 'seleccionado'}-${enabled ? 'habilitados' : 'no-habilitados'}.csv`; a.click(); URL.revokeObjectURL(url)
  }
  if (!role) return <main className="center-page"><section className="card" role="status"><h1>Administración de votaciones</h1><p>{msg || 'Cargando tu acceso…'}</p>{msg && <button onClick={() => { location.hash = '/admin/login'; location.reload() }}>Volver al ingreso</button>}</section></main>
  if (role === 'registration') return <RegistrationDesk/>
  return <main className={`admin-page${isAdmin ? ' admin-with-navigation' : ''}`}>
    {isAdmin && menuOpen && <button type="button" className="admin-menu-backdrop" aria-label="Cerrar menú lateral" onClick={closeMenu}/>}
    <AdminPageHeader title={isAdmin ? ({operation:'Votaciones',candidates:`Candidatos oficiales · ${current?.election_year || 'Seleccionar año'}`,practice:'Catálogo del simulacro 2026',results:`Resultados · ${current?.election_year || 'Seleccionar año'}`,roster:'Habilitados',election:'Elecciones y cupos',location:'Ubicación y excepciones',checkin:'Asistencia Rápida',registration:'Registro del día'}[view]) : 'Habilitación de votantes'} elections={data.elections} selected={selectedElection} onElectionChange={setSelectedElection} busy={busy} onRefresh={() => run(async () => {}, 'Datos actualizados.')} onExit={async () => { await logoutAdmin(); location.hash = '/admin/login' }} onMenu={() => menuOpen ? closeMenu() : setMenuOpen(true)} menuRef={menuToggle} menuOpen={menuOpen}/>
    {msg && <p className="notice" role="status">{msg}</p>}
    {isAdmin && view === 'roster' && <RosterImport onImported={() => run(async () => {}, 'Padrón actualizado.')}/>}
    {view === 'roster' && <div className="actions"><button disabled={!selectedElection || busy} onClick={() => exportRoster(true)}>Exportar habilitados CSV</button><button disabled={!selectedElection || busy} onClick={() => exportRoster(false)}>Exportar no habilitados CSV</button><small>Respeta el filtro del listado. Cédulas limitadas a los últimos cuatro caracteres.</small></div>}

    {isAdmin && <AdminNavigation view={view} open={menuOpen} closeRef={menuClose} onClose={closeMenu} onSelect={id => { setView(id); closeMenu(); setCandidate({ ...blankCandidate(), practice: id === 'practice' }); setPhotoFile(null); setPhotoKey(k => k + 1); if (current) setElection(electionDraft(current)) }}/>}
    {isAdmin && view === 'registration' && <RegistrationDesk key={selectedElection} admin electionId={selectedElection} electionDate={current?.registration_date} onSettingsChanged={() => refresh(role)}/>}
    <section className="admin-grid">
      {isAdmin && view === 'checkin' && <AdminQuickCheckIn key={selectedElection} electionId={selectedElection} rounds={rounds} onChanged={() => refresh(role)}/>}
      {isAdmin && view === 'election' && <article className="card"><h2>Elecciones y cupos</h2><div className="actions"><button className="secondary" onClick={() => setElection(blankElection())}>Nueva elección</button><button className="secondary" disabled={!current} onClick={() => setElection(electionDraft(current))}>Editar la seleccionada</button></div><form onSubmit={saveElection}><div className="form-grid">
        <label>Año<input required type="number" min="2026" step="1" value={election.year} onChange={e => setElection({ ...election, year: e.target.value })}/></label><label>Título<input required value={election.title} onChange={e => setElection({ ...election, title: e.target.value })}/></label>
        <label>Cupos hombres<input required type="number" min="0" step="1" value={election.male} onChange={e => setElection({ ...election, male: e.target.value })}/></label><label>Cupos mujeres<input required type="number" min="0" step="1" value={election.female} onChange={e => setElection({ ...election, female: e.target.value })}/></label>

      </div><p className="privacy">Los cupos son cantidades exactas. El punto y radio se administran en Ubicación y excepciones.</p><button disabled={busy}>{election.id ? 'Guardar configuración' : 'Crear elección'}</button></form></article>}
      {isAdmin && ['candidates','practice'].includes(view) && <div className="full"><CandidateWorkspace practice={view === 'practice'} year={current?.election_year} femaleSlots={current?.female_slots} maleSlots={current?.male_slots} candidate={candidate} onCandidate={setCandidate} onSubmit={saveCandidate} photoKey={photoKey} onPhoto={e => setPhotoFile(e.target.files?.[0] || null)} photoSelected={!!photoFile} onCancel={() => { setCandidate({ ...blankCandidate(), practice: view === 'practice' }); setPhotoFile(null); setPhotoKey(k => k + 1) }} candidates={candidates.filter(c => c.is_practice_reference === (view === 'practice'))} onEdit={editCandidate} onChangePhoto={editCandidate} busy={busy} configured={!!selectedElection} practiceAction={<article className="card"><h2>Simulacro {current?.election_year || ''}</h2><p>Participación opcional · Comparte los habilitados del año.</p><button disabled={!current || busy || rounds.some(r => r.round_kind === 'practice' && r.status !== 'draft')} onClick={() => makeRound('practice')}>Preparar simulacro</button></article>}/></div>}
      {(!isAdmin || view === 'roster') && <article className="card"><h2>Habilitación desde listados</h2><p>La asistencia y la habilitación son estados separados. Este padrón se comparte entre simulacro y oficial del año.</p><label>Listado del líder<select value={group} onChange={e => { setGroup(e.target.value); setPersonId('') }}><option value="">Todos los listados permitidos</option>{groups.map(g => <option value={String(g.id)} key={g.id}>{g.name}</option>)}</select></label><p>{visiblePeople.length} registros de miembros visibles · {visiblePeople.filter(p => p.enabled).length} habilitados en estos registros.</p><label>Persona<select value={personId} onChange={e => { setPersonId(e.target.value); setCedula('') }}><option value="">Seleccionar…</option>{visiblePeople.map(p => <option value={p.person_id} key={p.person_id}>{p.full_name} · {personGroups(p).map(g => g.name).join(', ') || 'sin listado'} · {p.enabled ? 'habilitado' : 'sin habilitar'}{p.cedula_last4 ? ` · cédula …${p.cedula_last4}` : ''}</option>)}</select></label><label>Cédula completa verificada<input value={cedula} onChange={e => setCedula(e.target.value)} autoComplete="off"/></label><div className="actions"><button disabled={!selectedElection || !personId || !cedula.trim() || busy} onClick={() => enablePerson(true)}>Habilitar</button>{isAdmin && <button className="secondary" disabled={!selectedElection || !personId || !cedula.trim() || busy} onClick={() => enablePerson(false)}>{people.find(p => p.person_id === Number(personId))?.enabled ? 'Revocar habilitación' : 'Registrar cédula sin habilitar'}</button>}</div><p className="privacy">Solo se muestran personas de tu ámbito autorizado. No se registran votos al habilitar.</p></article>}
      {(!isAdmin || view === 'operation' || view === 'roster') && <article className="card"><h2>Pendientes por ronda</h2><label>Ronda<select value={selectedRound} onChange={e => loadPending(e.target.value)}><option value="">Seleccionar…</option>{rounds.map(r => <option key={r.id} value={r.id}>{kindLabel(r.round_kind)} #{r.round_number} · {statusLabel(r.status)}</option>)}</select></label>{selectedRound && <><p>{pending.filter(p => !p.voted).length} pendientes · {pending.filter(p => p.voted).length} participantes de tu ámbito.</p><ul className="plain-list">{pending.filter(p => !p.voted).map(p => <li key={p.person_id}>{p.full_name} · {p.attended ? 'asistencia registrada' : 'sin asistencia registrada'}</li>)}</ul>{!pending.some(p => !p.voted) && <p>Sin pendientes en el ámbito consultado.</p>}</>}<p className="privacy">El panel conoce participación; nunca muestra las selecciones individuales.</p></article>}
      {isAdmin && view === 'location' && <article className="card full"><h2>Ubicación y excepciones</h2><p><strong>Ministerio Jezreel · Ubicación fija de la iglesia</strong><br/>Latitud: {churchLocation?.latitude ?? 'Cargando…'} · Longitud: {churchLocation?.longitude ?? 'Cargando…'}</p><p>Esta ubicación se guarda una sola vez y se utiliza para todas las elecciones y simulacros.</p><form onSubmit={saveElection}><label>Radio permitido (metros)<input type="number" min="1" step="1" value={election.radius} onChange={e => setElection({ ...election, radius: e.target.value })}/></label><button disabled={busy || !current}>Guardar radio</button></form><h3>Excepciones de ubicación</h3><label>Ronda<select value={selectedRound} onChange={e => loadPending(e.target.value)}><option value="">Seleccionar…</option>{rounds.map(r => <option key={r.id} value={r.id}>{kindLabel(r.round_kind)} #{r.round_number} · {statusLabel(r.status)}</option>)}</select></label><p>Una excepción no habilita ni registra presencia física.</p><form onSubmit={saveException}><label>Persona<select required value={exception.person} onChange={e => setException({ ...exception, person: e.target.value })}><option value="">Seleccionar…</option>{people.map(p => <option value={p.person_id} key={p.person_id}>{p.full_name}</option>)}</select></label><div className="form-grid"><label>Desde (hora local del dispositivo)<input required type="datetime-local" value={exception.from} onChange={e => setException({ ...exception, from: e.target.value })}/></label><label>Hasta (hora local del dispositivo)<input required type="datetime-local" value={exception.until} onChange={e => setException({ ...exception, until: e.target.value })}/></label></div><label>Motivo<input required value={exception.reason} onChange={e => setException({ ...exception, reason: e.target.value })}/></label><button disabled={busy || !selectedRound}>Guardar excepción para la ronda</button></form><ul className="plain-list">{exceptions.map(x => <li key={x.id}><strong>{x.full_name || `Persona ${x.person_id}`}</strong> · {x.reason}<br/><small>{new Date(x.valid_from).toLocaleString()} — {new Date(x.valid_until).toLocaleString()} · {x.revoked_at ? 'Revocada' : 'Autorizada en esa vigencia'}</small>{!x.revoked_at && <button className="secondary" disabled={busy} onClick={() => run(() => call('voting_admin_revoke_exception', { p_exception_id: x.id }))}>Revocar excepción</button>}</li>)}</ul></article>}
      {isAdmin && view === 'operation' && <article className="card full"><h2>Operación · {current?.election_year || 'selecciona elección'}</h2><div className="actions"><button className="danger" disabled={busy || !data.rounds.some(r => r.status === 'open')} onClick={closeActive}>Cerrar votación activa</button></div><p>Abre el simulacro o la oficial cuando corresponda. Solo puede haber una votación abierta. Cerrar votación activa muestra sus resultados.</p><div className="notice" role="status"><strong>Miembros registrados en los listados</strong>{coverage ? <><p>{coverage.member_records} registros territoriales · {coverage.identified_members} personas con cédula vinculada · {coverage.unidentified_records} registros sin cédula vinculada.</p>{coverage.complete ? <p>Total de miembros únicos: {coverage.total_members}. Los registros territoriales de una misma identidad cuentan una sola vez, aunque no esté habilitada para votar.</p> : <p>Porcentaje pendiente: faltan cédulas por vincular para comprobar el total sin duplicados. Puedes registrarlas sin habilitar a la persona.</p>}</> : <p>Conteo pendiente de cargar.</p>}<p>La asistencia se divide entre el total de miembros únicos; los habilitados y votos se muestran por separado.</p></div><div className="round-list">{rounds.map(r => <div className="round" key={r.id}><div><strong>{kindLabel(r.round_kind)} #{r.round_number}</strong><span className={`badge ${r.status}`}>{statusLabel(r.status)}</span><small>{r.attendance_count} asistencias · {r.voter_count} votos · {coverage?.complete && coverage.total_members > 0 ? `${((r.member_attendance_count / coverage.total_members) * 100).toFixed(1)} % de miembros presentes` : 'porcentaje de miembros pendiente'} · cupos {r.male_slots} hombres / {r.female_slots} mujeres</small></div><div className="actions">{r.status === 'draft' && <button disabled={busy} onClick={() => run(() => call('voting_admin_start_checkin', { p_round_id: r.id }))}>Iniciar ingreso</button>}{['draft', 'checkin'].includes(r.status) && <button disabled={busy || data.rounds.some(round => round.status === 'open')} onClick={() => run(() => call('voting_admin_open_round', { p_round_id: r.id }))}>Abrir {kindLabel(r.round_kind).toLowerCase()}</button>}{r.status === 'closed' && <><button disabled={busy} onClick={() => showResults(r)}>Ver resultados / CSV</button><button disabled={busy || !tiePolicy} onClick={() => run(() => call('voting_admin_create_tie_round', { p_origin_round_id: r.id, p_attendance_policy: tiePolicy }))}>Preparar desempate</button></>}</div></div>)}</div></article>}
      {isAdmin && view === 'results' && results && <div className="full"><label className="reference-round-select">Tipo y ronda<select value={results.round.id} onChange={e => { const round = rounds.find(r => r.id === e.target.value); if (round) showResults(round) }}>{rounds.filter(r => r.status === 'closed').map(r => <option value={r.id} key={r.id}>{kindLabel(r.round_kind)} · Ronda {r.round_number}</option>)}</select></label><ResultPanels rows={results.rows} onExport={exportCsv}/></div>}
      {isAdmin && view === 'election' && <article className="card"><h2>Preparación de rondas</h2><p>La preparación se realiza antes de operar la votación.</p><div className="actions">{['practice', 'official'].map(kind => <button key={kind} disabled={!current || busy || rounds.some(r => r.round_kind === kind && r.status !== 'draft')} onClick={() => makeRound(kind)}>{rounds.some(r => r.round_kind === kind) ? 'Actualizar preparación' : 'Preparar'} {kindLabel(kind).toLowerCase()}</button>)}</div></article>}
      {isAdmin && view === 'results' && <article className="card full"><h2>Asistencia para desempates</h2><label>Política de asistencia para el siguiente desempate<select value={tiePolicy} onChange={e => setTiePolicy(e.target.value)}><option value="">Administración debe elegir…</option><option value="origin">Reutilizar asistencia válida de origen</option><option value="new">Exigir nueva asistencia</option></select></label><button disabled={busy || !results || !tiePolicy || !results.rows.some(r => r.result_status === 'Empate por puesto pendiente')} onClick={() => run(async () => { await call('voting_admin_create_tie_round', { p_origin_round_id: results.round.id, p_attendance_policy: tiePolicy }); setView('operation') }, 'Desempate preparado. Revisa la ronda antes de abrirla.')}>Preparar desempate</button></article>}
      {isAdmin && view === 'results' && !results && <article className="card full"><h2>Resultados</h2><div className="actions">{rounds.filter(r => r.status === 'closed').map(r => <button key={r.id} onClick={() => showResults(r)}>{kindLabel(r.round_kind)} #{r.round_number}</button>)}</div>{!rounds.some(r => r.status === 'closed') && <p>Los resultados estarán disponibles al cerrar una votación.</p>}</article>}
    </section>
  </main>
}

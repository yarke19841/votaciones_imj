import { useEffect, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { currentPosition } from '../../lib/voterFlow'

export const panamaDay = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Panama', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
const call = async (name, args) => { const { data, error } = await supabase.rpc(name, args); if (error) throw error; return data }
const kinds = { practice: 'Simulacro', official: 'Oficial', tie: 'Desempate' }

export default function AdminQuickCheckIn({ electionId, rounds, onChanged }) {
 const [roundId, setRoundId] = useState(''), [day, setDay] = useState(panamaDay), [kind, setKind] = useState('official')
 const [cedula, setCedula] = useState(''), [panel, setPanel] = useState(null), [searched, setSearched] = useState(false)
 const [busy, setBusy] = useState(false), [message, setMessage] = useState('')
 const request = useRef(0)
 const available = rounds.filter(r => r.round_kind === kind)
 const selected = available.find(r => r.id === roundId)
 useEffect(() => { setRoundId(''); setCedula(''); setMessage(''); setSearched(false); setPanel(null); request.current++ }, [electionId, kind])
 useEffect(() => {
  const id = ++request.current
  setPanel(null); setSearched(false); setMessage('')
  if (!roundId) return
  call('voting_admin_quick_lookup', { p_round_id: roundId, p_cedula: '', p_day: day })
   .then(data => { if (id === request.current) setPanel(data) }).catch(e => { if (id === request.current) setMessage(e.message) })
  return () => { request.current++ }
 }, [roundId, day])
 async function search(event) {
  event?.preventDefault(); const id = ++request.current
  setBusy(true); setMessage(''); setPanel(null); setSearched(false)
  try { const data = await call('voting_admin_quick_lookup', { p_round_id: roundId, p_cedula: cedula.trim(), p_day: day }); if (id === request.current) { setPanel(data); setSearched(true) } }
  catch (e) { if (id === request.current) setMessage(e.message) }
  finally { setBusy(false) }
 }
 async function act(enable) {
  setBusy(true); setMessage('')
  try {
   if (enable) await call('voting_enable_person', { p_election_id: electionId, p_person_id: panel.person.person_id, p_cedula: cedula.trim(), p_enabled: true })
   else { const p = await currentPosition(); await call('voting_admin_quick_attend', { p_round_id: roundId, p_cedula: cedula.trim(), p_day: day, p_latitude: p.lat, p_longitude: p.lng }) }
   const data = await call('voting_admin_quick_lookup', { p_round_id: roundId, p_cedula: cedula.trim(), p_day: day })
   setPanel(data); setMessage(enable ? 'Habilitación electoral guardada. La asistencia se registra por separado.' : 'Asistencia registrada. No se ha emitido ningún voto.'); await onChanged()
  } catch (e) { setMessage(e.message) } finally { setBusy(false) }
 }
 const coverage = panel?.coverage, person = panel?.person
 return <section className="quick-checkin full"><h2>⚡ Asistencia Rápida</h2><p>Busca por cédula y registra la llegada de una persona existente. Confirma su presencia física antes de marcar asistencia.</p>
  <div className="quick-checkin-grid"><article className="card"><div className="form-grid">
   <label>Tipo de jornada<select disabled={busy} value={kind} onChange={e => setKind(e.target.value)}>{Object.entries(kinds).map(([id,label]) => <option key={id} value={id}>{label}</option>)}</select></label>
   <label>Ronda<select disabled={busy} value={roundId} onChange={e => setRoundId(e.target.value)}><option value="">Seleccionar…</option>{available.map(r => <option key={r.id} value={r.id}>Ronda {r.round_number} · {r.status === 'draft' ? 'Preparación' : r.status === 'checkin' ? 'Ingreso abierto' : r.status === 'open' ? 'Votación abierta' : 'Cerrada'}</option>)}</select></label>
   <label>Fecha de asistencia (Panamá)<input disabled={busy} type="date" required value={day} onChange={e => setDay(e.target.value)}/></label>
  </div><form onSubmit={search}><label>Buscar solo por cédula<input autoComplete="off" maxLength="40" disabled={busy} value={cedula} onChange={e => { setCedula(e.target.value); request.current++; setSearched(false); setPanel(p => p ? { ...p, person: null } : null) }} placeholder="Ej. 8-765-1234"/></label><button disabled={busy || !roundId || !day || cedula.replace(/[^A-Za-z0-9]/g, '').length < 5}>Buscar</button></form>
  {message && <p role="status" className="notice">{message}</p>}
  {searched && !person && <p>No se encontró esa cédula. La carga de miembros se realiza en Habilitados.</p>}
  {person && <div className="quick-person"><strong>{person.full_name}</strong><p>Cédula …{person.cedula_last4} · {person.enabled ? 'Habilitado para votar' : 'Habilitación pendiente'}</p><p>{person.attended ? `Asistencia registrada el ${person.attended_on}` : 'Sin asistencia en esta ronda'}</p><div className="actions">{!person.enabled && <button className="secondary" disabled={busy} onClick={() => act(true)}>Habilitar para votar</button>}<button disabled={busy || person.attended || day !== panamaDay() || !['checkin','open'].includes(selected?.status)} onClick={() => act(false)}>{person.attended ? 'Ya tiene asistencia' : 'Registrar asistencia'}</button></div></div>}
  <p className="privacy">Solo Administración. Para registrar llegada se comprueba la ubicación actual del equipo. La persona deberá verificar también su ubicación al votar.</p></article>
  <aside className="card"><h2>Participación</h2><dl className="quick-kpis"><div><dt>Total de miembros únicos</dt><dd>{coverage?.complete ? coverage.total_members : 'Pendiente de verificar'}</dd></div><div><dt>Miembros presentes en la fecha</dt><dd>{panel?.member_present ?? '—'}</dd></div><div><dt>Porcentaje presente</dt><dd>{coverage?.complete && coverage.total_members > 0 ? `${((panel.member_present / coverage.total_members) * 100).toFixed(1)} %` : '—'}</dd></div></dl>{coverage && !coverage.complete && <p>Faltan {coverage.unidentified_records} registros de miembros por vincular con cédula. No se calcula un porcentaje sobre un total incompleto.</p>}<p>Habilitar, asistir y votar son estados separados.</p></aside></div>
 </section>
}

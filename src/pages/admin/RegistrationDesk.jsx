import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { currentPosition } from '../../lib/voterFlow'
import { logoutAdmin } from '../../lib/authAdmin'
import OfficialLogo from '../../components/OfficialLogo'

const rpc = async (name, args = {}) => {
  const { data, error } = await supabase.rpc(name, args)
  if (error) throw error
  return data
}
const panamaDay = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Panama', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
const showTime = value => new Date(value).toLocaleString('es-PA', { timeZone: 'America/Panama' })

export default function RegistrationDesk({ admin = false, admission = false, electionId, electionDate, onSettingsChanged }) {
  const [elections, setElections] = useState([]), [selected, setSelected] = useState(electionId || '')
  const [day, setDay] = useState(panamaDay), [configuredDay, setConfiguredDay] = useState(electionDate || '')
  const [panel, setPanel] = useState(null)
  const [msg, setMsg] = useState(''), [busy, setBusy] = useState(false), [loaded, setLoaded] = useState(false)
  const [reasons, setReasons] = useState({})
  const [lookupDoc,setLookupDoc]=useState(''),[found,setFound]=useState(null),[searched,setSearched]=useState(false)
  const [manual, setManual] = useState(false)
  const [fullName, setFullName] = useState('')
  const [verification, setVerification] = useState('')
  const [verified, setVerified] = useState(false)
  function resetManual() {
    setManual(false); setFullName(''); setVerification(''); setVerified(false)
  }
  const request = useRef(0)
  const target = admin ? electionId : selected
  useEffect(() => { setConfiguredDay(electionDate || '') }, [electionDate])
  useEffect(() => {
    if (admin) return
    let alive = true
    rpc('voting_registration_access').then(data => {
      if (!alive) return
      const allowed = (data.elections || []).filter(e => admission ? e.admission : e.reception)
      setElections(allowed); setSelected(id => allowed.some(e => e.id === id) ? id : allowed[0]?.id || ''); setLoaded(true)
    }).catch(e => { if (alive) { setMsg(e.message); setLoaded(true) } })
    return () => { alive = false }
  }, [admin, admission])
  const refresh = useCallback(async () => {
    const id = ++request.current
    setPanel(null)
    if (!target) return
    try {
      const data = await rpc('voting_registration_panel', { p_election_id: target, p_day: admin ? day : null })
      if (id === request.current) setPanel(data)
    } catch (e) { if (id === request.current) setMsg(e.message) }
  }, [target, day, admin])
  useEffect(() => { setMsg(''); setReasons({}); setLookupDoc('');setFound(null);setSearched(false); resetManual(); refresh(); return () => { request.current += 1 } }, [refresh])
  async function perform(fn, success) {
    if (busy) return
    setBusy(true); setMsg('')
    try { await fn(); await refresh(); setMsg(success) } catch (e) { setMsg(e.message) } finally { setBusy(false) }
  }
  const canUseDesk = admission ? panel?.can_admit : panel?.can_register
  async function search(event) {
    event.preventDefault()
    await perform(async () => {
      setFound(null); setSearched(false); resetManual()
      const result = await rpc(admission ? 'voting_admission_lookup' : 'voting_reception_lookup', {
        p_election_id: target, p_cedula: lookupDoc.trim(),
      })
      setFound(result.person); setSearched(true)
    }, '')
  }
  async function confirmPerson() {
    await perform(async () => {
      const p = await currentPosition()
      await rpc(admission ? 'voting_admission_enable' : 'voting_reception_attend', {
        p_election_id: target, p_cedula: lookupDoc.trim(), p_latitude: p.lat, p_longitude: p.lng,
      })
      setFound({ ...found, enabled: true, attended: !admission })
    }, admission ? 'Miembro habilitado. Envíalo a Recepción para registrar su llegada.' : 'Llegada registrada. No se ha emitido ningún voto.')
  }
  async function createVerified(event) {
    event.preventDefault()
    if (!admission || !canUseDesk || !panel?.round || !searched || found || !verified) return
    await perform(async () => {
      const position = await currentPosition()
      await rpc('voting_admission_create_verified', {
        p_election_id: target, p_cedula: lookupDoc.trim(), p_full_name: fullName.trim(),
        p_verification: verification.trim(), p_latitude: position.lat, p_longitude: position.lng,
      })
      setFound({ full_name: fullName.trim(), cedula_last4: lookupDoc.replace(/[^a-z0-9]/gi,'').slice(-4), enabled: true })
      resetManual()
    }, 'Alta electoral guardada. Envía a la persona a Recepción para registrar su llegada.')
  }
  const content = <>
    {msg && <p className="notice" role="status">{msg}</p>}
    {!admin && <section className="card"><label>Elección del día<select value={selected} onChange={e => setSelected(e.target.value)} disabled={busy}><option value="">Seleccionar…</option>{elections.map(e => <option key={e.id} value={e.id}>{e.election_year} · {e.title}</option>)}</select></label>{loaded && elections.length === 0 && <p>Tu permiso de registro no está activo hoy. Administración define la fecha y el personal autorizado.</p>}</section>}
    {!admin && <section className="card">
      <h2>{admission ? 'Validar miembro' : 'Registrar llegada'}</h2>
      <form onSubmit={search}><label>Cédula de la persona<input required maxLength="40" autoComplete="off" value={lookupDoc} disabled={busy} onChange={e=>{setLookupDoc(e.target.value);setFound(null);setSearched(false);resetManual()}}/></label><button disabled={busy||!canUseDesk||!panel?.round}>Buscar persona</button></form>
      {panel && !panel.round && <p>Administración debe iniciar el ingreso.</p>}
      {searched && !found && (admission ? <div className="quick-person">
        <p>No encontramos la cédula en el directorio. Verifica la cédula y confirma la membresía con el responsable o con un listado de la iglesia.</p>
        {!manual ? <button type="button" className="secondary" disabled={busy||!canUseDesk||!panel?.round} onClick={() => setManual(true)}>Crear registro electoral</button>
          : <form onSubmit={createVerified}>
            <h3>Crear registro electoral</h3>
            <label>Nombre completo<input value={fullName} onChange={e=>setFullName(e.target.value)} required minLength={3} maxLength={200} disabled={busy}/></label>
            <label>Quién o qué registro confirmó la membresía<input value={verification} onChange={e=>setVerification(e.target.value)} required minLength={5} maxLength={250} disabled={busy}/></label>
            <label className="check"><input type="checkbox" checked={verified} onChange={e=>setVerified(e.target.checked)} required disabled={busy}/> Confirmé la cédula y que la persona ya es miembro de la iglesia.</label>
            <div className="actions">
              <button disabled={busy||!verified||!canUseDesk||!panel?.round}>Crear y habilitar para votar</button>
              <button type="button" className="secondary" disabled={busy} onClick={resetManual}>Cancelar</button>
            </div>
          </form>}
        <p className="privacy">Si no puedes confirmar la membresía, remite el caso a Administración.</p>
      </div> : <p>No figura en el padrón electoral. Envíalo a Nuevo ingreso para validar su membresía.</p>)}
      {found && <div className="quick-person">
        <strong>{found.full_name}</strong><p>Cédula …{found.cedula_last4}</p>
        {found.blocked ? <p>Requiere revisión de Administración.</p> : admission
          ? (found.enabled ? <p>Ya está en el padrón. Puede pasar a Recepción.</p> : <button disabled={busy||!canUseDesk||!panel?.round} onClick={confirmPerson}>Habilitar para votar</button>)
          : (found.enabled ? <><p>{found.attended?'Llegada registrada':'Sin asistencia en esta jornada'}</p><button disabled={busy||found.attended||!canUseDesk||!panel?.round} onClick={confirmPerson}>Registrar llegada</button></> : <p>No figura en el padrón electoral. Envíalo a Nuevo ingreso para validar su membresía.</p>)}
      </div>}
      <p className="privacy">{admission ? 'Solo se habilitan miembros verificados. Confirma la cédula en persona y usa el equipo dentro del radio de la iglesia.' : 'Recepción confirma la presencia física dentro del radio de la iglesia.'}</p>
    </section>}
    {admin && <section className="card"><h2>Permisos de la jornada</h2><p>El permiso funciona únicamente en la fecha electoral configurada, de 00:00 a 23:59, hora de Panamá. Asigna Recepción para registrar asistencia o Nuevo ingreso para validar y habilitar miembros.</p><form onSubmit={event => { event.preventDefault(); perform(async () => { await rpc('voting_admin_registration_date', { p_election_id: target, p_day: configuredDay || null }); await onSettingsChanged?.() }, 'Fecha de registro guardada.') }}><label>Día autorizado<input type="date" required value={configuredDay} onChange={e => setConfiguredDay(e.target.value)}/></label><button disabled={busy || !target}>Guardar fecha</button></form><ul className="plain-list">{panel?.staff.map(user => <li key={user.user_id}><span>{user.label} · {[user.enabled && 'Recepción',user.can_admit && 'Nuevo ingreso'].filter(Boolean).join(' / ') || 'Sin permiso'}</span><button className="secondary" disabled={busy} onClick={() => perform(() => rpc('voting_admin_registration_staff', { p_election_id: target, p_user_id: user.user_id, p_enabled: !user.enabled }), 'Permiso actualizado.')}>{user.enabled ? 'Retirar Recepción' : 'Asignar Recepción'}</button><button className="secondary" disabled={busy} onClick={() => perform(() => rpc('voting_admin_admission_staff', { p_election_id: target, p_user_id: user.user_id, p_enabled: !user.can_admit }), 'Permiso actualizado.')}>{user.can_admit ? 'Retirar Nuevo ingreso' : 'Asignar Nuevo ingreso'}</button></li>)}</ul></section>}
    {(admin || admission) && <section className="card full"><h2>Altas electorales {admin ? 'en la fecha seleccionada' : 'hoy'}</h2><div className="actions">{admin && <label>Fecha (Panamá)<input type="date" value={day} onChange={e => setDay(e.target.value)} required disabled={busy}/></label>}<button className="secondary" disabled={busy || !target} onClick={refresh}>Actualizar listado</button></div>{panel && <p>{panel.rows.length} personas registradas · {panel.rows.filter(r => r.enabled).length} habilitadas.</p>}{!admin ? <ul className="registration-records">{panel?.rows.map(row => <li key={row.id}><strong>{row.full_name}</strong><span>Cédula …{row.cedula_last4}</span><span>{showTime(row.registered_at)} · {row.registered_by}</span><span>{row.enabled ? 'Habilitada' : 'Sin habilitación'} · {row.attended ? 'Asistencia registrada' : 'Sin asistencia'}</span></li>)}</ul> : <div className="table-scroll" tabIndex="0" role="region" aria-label="Personas creadas en el día"><table><thead><tr><th>Persona</th><th>Registrada por / hora Panamá</th><th>Estado</th>{admin && <th>Revisión administrativa</th>}</tr></thead><tbody>{panel?.rows.map(row => <tr key={row.id}><td>{row.full_name}<small>Cédula …{row.cedula_last4}</small></td><td>{row.registered_by}<br/>{showTime(row.registered_at)}</td><td>{row.enabled ? 'Habilitada' : 'Sin habilitación'}<br/>{row.attended ? 'Asistencia registrada' : 'Sin asistencia'}{row.voted && <p>Ya participó. La revocación no elimina votos emitidos.</p>}{!row.enabled && row.revocation_reason && <p>{row.revocation_reason}</p>}</td>{admin && <td>{row.enabled ? <form onSubmit={event => { event.preventDefault(); perform(() => rpc('voting_admin_revoke_registration', { p_registration_id: row.id, p_reason: reasons[row.id] || '' }), 'Habilitación revocada. Se conservan la persona, su asistencia y la auditoría.') }}><label>Motivo<input required minLength="3" value={reasons[row.id] || ''} onChange={e => setReasons({ ...reasons, [row.id]: e.target.value })}/></label><button className="danger" disabled={busy}>Revocar habilitación</button></form> : 'Revocada / sin habilitación'}</td>}</tr>)}</tbody></table></div>}{panel?.rows.length === 0 && <p>No hay altas electorales en esta fecha.</p>}<p className="privacy">Solo Administración puede revocar. El listado conserva los registros y nunca muestra selecciones de voto.</p></section>}
  </>
  if (admin) return <div className="admin-grid">{content}</div>
  return <main className="admin-page registration-desk"><header className="reference-header registration-desk-header"><div className="admin-heading"><OfficialLogo className="admin-header-logo"/><div><p className="eyebrow">Ministerio Jezreel</p><h1>{admission ? 'Nuevo ingreso' : 'Recepción'}</h1><p>Registro electoral del día · hora de Panamá</p></div></div><button className="secondary registration-desk-exit" onClick={async () => { await logoutAdmin(); location.hash = '/admin/login' }}>Salir</button></header><div className="admin-grid">{content}</div></main>
}

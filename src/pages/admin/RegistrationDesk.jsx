import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { currentPosition } from '../../lib/voterFlow'
import { logoutAdmin } from '../../lib/authAdmin'

const rpc = async (name, args = {}) => {
  const { data, error } = await supabase.rpc(name, args)
  if (error) throw error
  return data
}
const panamaDay = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Panama', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
const showTime = value => new Date(value).toLocaleString('es-PA', { timeZone: 'America/Panama' })

export default function RegistrationDesk({ admin = false, electionId, electionDate, onSettingsChanged }) {
  const [elections, setElections] = useState([]), [selected, setSelected] = useState(electionId || '')
  const [day, setDay] = useState(panamaDay), [configuredDay, setConfiguredDay] = useState(electionDate || '')
  const [panel, setPanel] = useState(null), [name, setName] = useState(''), [cedula, setCedula] = useState('')
  const [msg, setMsg] = useState(''), [busy, setBusy] = useState(false), [loaded, setLoaded] = useState(false)
  const [reasons, setReasons] = useState({})
  const request = useRef(0)
  const target = admin ? electionId : selected
  useEffect(() => { setConfiguredDay(electionDate || '') }, [electionDate])
  useEffect(() => {
    if (admin) return
    let alive = true
    rpc('voting_registration_access').then(data => {
      if (!alive) return
      setElections(data.elections || []); setSelected(id => id || data.elections?.[0]?.id || ''); setLoaded(true)
    }).catch(e => { if (alive) { setMsg(e.message); setLoaded(true) } })
    return () => { alive = false }
  }, [admin])
  const refresh = useCallback(async () => {
    const id = ++request.current
    setPanel(null)
    if (!target) return
    try {
      const data = await rpc('voting_registration_panel', { p_election_id: target, p_day: admin ? day : null })
      if (id === request.current) setPanel(data)
    } catch (e) { if (id === request.current) setMsg(e.message) }
  }, [target, day, admin])
  useEffect(() => { setMsg(''); setName(''); setCedula(''); setReasons({}); refresh(); return () => { request.current += 1 } }, [refresh])
  async function perform(fn, success) {
    if (busy) return
    setBusy(true); setMsg('')
    try { await fn(); await refresh(); setMsg(success) } catch (e) { setMsg(e.message) } finally { setBusy(false) }
  }
  async function register(event) {
    event.preventDefault()
    return perform(async () => {
      const location = await currentPosition()
      await rpc('voting_register_person', { p_election_id: target, p_full_name: name.trim(), p_cedula: cedula.trim(), p_latitude: location.lat, p_longitude: location.lng })
      setName(''); setCedula('')
    }, 'Persona creada, habilitada y con asistencia registrada. Puede ingresar como votante con su cédula.')
  }
  const content = <>
    {msg && <p className="notice" role="status">{msg}</p>}
    {!admin && <section className="card"><label>Elección del día<select value={selected} onChange={e => setSelected(e.target.value)} disabled={busy}><option value="">Seleccionar…</option>{elections.map(e => <option key={e.id} value={e.id}>{e.election_year} · {e.title}</option>)}</select></label>{loaded && elections.length === 0 && <p>Tu permiso de registro no está activo hoy. Administración define la fecha y el personal autorizado.</p>}</section>}
    {admin && <section className="card"><h2>Personal de registro</h2><p>El permiso funciona únicamente en la fecha electoral configurada, de 00:00 a 23:59, hora de Panamá. Cada creación comprueba además que el ingreso esté abierto y el dispositivo esté dentro del radio permitido.</p><form onSubmit={event => { event.preventDefault(); perform(async () => { await rpc('voting_admin_registration_date', { p_election_id: target, p_day: configuredDay || null }); await onSettingsChanged?.() }, 'Fecha de registro guardada.') }}><label>Día autorizado<input type="date" required value={configuredDay} onChange={e => setConfiguredDay(e.target.value)}/></label><button disabled={busy || !target}>Guardar fecha</button></form><ul className="plain-list">{panel?.staff.map(user => <li key={user.user_id}><span>{user.label} · {user.enabled ? 'Asignado' : 'Sin permiso de registro'}</span><button className="secondary" disabled={busy} onClick={() => perform(() => rpc('voting_admin_registration_staff', { p_election_id: target, p_user_id: user.user_id, p_enabled: !user.enabled }), 'Permiso actualizado.')}>{user.enabled ? 'Retirar permiso' : 'Asignar registro'}</button></li>)}</ul></section>}
    {!admin && <section className="card"><h2>Registrar persona</h2><p>Guardar crea la persona, la habilita para esta elección y registra su asistencia. La ubicación es obligatoria; una cédula existente requiere revisión de Administración.</p><form onSubmit={register}><label>Nombre completo<input required minLength="3" maxLength="200" autoComplete="off" value={name} onChange={e => setName(e.target.value)} disabled={busy}/></label><label>Cédula<input required maxLength="60" autoComplete="off" value={cedula} onChange={e => setCedula(e.target.value)} disabled={busy}/></label><button disabled={busy || !panel?.can_register || !panel?.round}>{busy ? 'Registrando…' : 'Crear, habilitar y registrar asistencia'}</button></form>{panel && !panel.round && <p>Administración debe iniciar el ingreso de la votación antes de registrar personas.</p>}</section>}
    <section className="card full"><h2>Personas creadas {admin ? 'en la fecha seleccionada' : 'hoy'}</h2><div className="actions">{admin && <label>Fecha (Panamá)<input type="date" value={day} onChange={e => setDay(e.target.value)} required disabled={busy}/></label>}<button className="secondary" disabled={busy || !target} onClick={refresh}>Actualizar listado</button></div>{panel && <p>{panel.rows.length} personas registradas · {panel.rows.filter(r => r.enabled).length} habilitadas.</p>}<div className="table-scroll" tabIndex="0" role="region" aria-label="Personas creadas en el día"><table><thead><tr><th>Persona</th><th>Registrada por / hora Panamá</th><th>Estado</th>{admin && <th>Revisión administrativa</th>}</tr></thead><tbody>{panel?.rows.map(row => <tr key={row.id}><td>{row.full_name}<small>Cédula …{row.cedula_last4}</small></td><td>{row.registered_by}<br/>{showTime(row.registered_at)}</td><td>{row.enabled ? 'Habilitada' : 'Sin habilitación'}<br/>{row.attended ? 'Asistencia registrada' : 'Sin asistencia'}{row.voted && <p>Ya participó. La revocación no elimina votos emitidos.</p>}{!row.enabled && row.revocation_reason && <p>{row.revocation_reason}</p>}</td>{admin && <td>{row.enabled ? <form onSubmit={event => { event.preventDefault(); perform(() => rpc('voting_admin_revoke_registration', { p_registration_id: row.id, p_reason: reasons[row.id] || '' }), 'Habilitación revocada. Se conservan la persona, su asistencia y la auditoría.') }}><label>Motivo<input required minLength="3" value={reasons[row.id] || ''} onChange={e => setReasons({ ...reasons, [row.id]: e.target.value })}/></label><button className="danger" disabled={busy}>Revocar habilitación</button></form> : 'Revocada / sin habilitación'}</td>}</tr>)}</tbody></table></div>{panel?.rows.length === 0 && <p>No hay personas creadas en esta fecha.</p>}<p className="privacy">Solo Administración puede revocar. El listado conserva los registros y nunca muestra selecciones de voto.</p></section>
  </>
  if (admin) return <div className="admin-grid">{content}</div>
  return <main className="admin-page"><header className="admin-header"><div><p className="eyebrow">Ministerio Jezreel</p><h1>Personal de registro</h1><p>Registro electoral del día · hora de Panamá</p></div><button className="secondary" onClick={async () => { await logoutAdmin(); location.hash = '/admin/login' }}>Salir</button></header><div className="admin-grid">{content}</div></main>
}

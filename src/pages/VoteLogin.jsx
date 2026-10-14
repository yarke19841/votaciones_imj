import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { currentPosition, voterMessages as messages } from '../lib/voterFlow'

export default function VoteLogin() {
  const nav = useNavigate(), timer = useRef(null), checking = useRef(false)
  const [cedula, setCedula] = useState(''), [waiting, setWaiting] = useState(false)
  const [msg, setMsg] = useState(''), [busy, setBusy] = useState(false), [enabled, setEnabled] = useState(false)
  useEffect(() => () => clearInterval(timer.current), [])
  async function checkBallot(token) {
    if (checking.current) return
    checking.current = true
    try {
      const p = await currentPosition()
      const {data, error} = await supabase.rpc('voting_ballot', {p_token: token, p_latitude: p.lat, p_longitude: p.lng})
      if (error || !data) { setMsg('No se pudo consultar la votación. Puedes intentar de nuevo.'); return }
      if (data.state === 'ready') { clearInterval(timer.current); nav('/vote', {state: {ballot: data}}); return }
      if (['waiting', 'not_enabled'].includes(data.state)) {
        if (data.state === 'not_enabled') setEnabled(false)
        setMsg(data.reason ? (messages[data.reason] || messages.waiting) : data.state === 'not_enabled' ? messages.not_enabled : messages.waiting)
        return
      }
      clearInterval(timer.current); setWaiting(false); setMsg(messages[data.state] || 'No puedes continuar en esta ronda.')
    } catch { setMsg('Activa la ubicación precisa para continuar y vuelve a revisar.') }
    finally { checking.current = false }
  }
  async function submit(event) {
    event.preventDefault(); setBusy(true); setMsg('')
    try {
      const p = await currentPosition()
      const {data, error} = await supabase.rpc('voting_enter', {p_cedula: cedula, p_latitude: p.lat, p_longitude: p.lng})
      if (error || !data) { setMsg('No se pudo validar el ingreso. Puedes intentar de nuevo.'); return }
      if (data.token) sessionStorage.setItem('voting_token', data.token)
      if (data.state === 'ready') { await checkBallot(data.token); return }
      if (data.state === 'waiting' && data.token && data.attended) {
        setWaiting(true); setEnabled(data.enabled === true)
        setMsg(data.reason ? (messages[data.reason] || messages.waiting) : messages.waiting)
        clearInterval(timer.current); timer.current = setInterval(() => checkBallot(data.token), 10000)
        return
      }
      setMsg(messages[data.state] || 'No puedes continuar.')
    } catch { setMsg('Debes permitir la ubicación precisa. La app la revisa al entrar y al enviar.') }
    finally { setBusy(false) }
  }
  return <main className="center-page"><section className="card voter-card">
    <p className="eyebrow">Iglesia Ministerio Jezreel</p><h1>Votaciones</h1>
    {waiting ? <><div className="waiting-dot"/><h2>Esperando apertura</h2><p>Asistencia registrada.</p><p>{enabled ? 'Habilitado para votar.' : 'Habilitación electoral pendiente.'}</p><p role="status">{msg}</p><button onClick={() => checkBallot(sessionStorage.getItem('voting_token'))}>Revisar ahora</button></> :
      <form onSubmit={submit}><p>Ingresa tu cédula. Dentro del área autorizada, tu asistencia se registra automáticamente. La habilitación electoral se comprueba por separado.</p>
        <label>Cédula<input value={cedula} onChange={e => setCedula(e.target.value)} autoComplete="off" required/></label>
        {msg && <p className="error" role="alert">{msg}</p>}<button disabled={busy}>{busy ? 'Verificando ubicación…' : 'Ingresar'}</button>
        <p className="privacy">La ubicación se revisa al entrar y al enviar. Las selecciones se guardan como conteos sin vínculo con tu identidad.</p></form>}
  </section></main>
}

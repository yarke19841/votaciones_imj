import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { positionForVoting, voterMessages as messages } from '../lib/voterFlow'
import VotingLayout, { VoteIcon } from '../components/VotingLayout'

export default function VoteLogin() {
  const nav = useNavigate(), timer = useRef(null), checking = useRef(false)
  const [cedula, setCedula] = useState(''), [waiting, setWaiting] = useState(false)
  const [msg, setMsg] = useState(''), [busy, setBusy] = useState(false), [enabled, setEnabled] = useState(false)
  const [context, setContext] = useState(null)
  useEffect(() => () => clearInterval(timer.current), [])
  function receipt(data) {
    clearInterval(timer.current)
    let previous = {}
    try { previous = JSON.parse(sessionStorage.getItem('voting_context')) || {} } catch {}
    const value = { year: data.year || previous.year, kind: data.round_kind || data.kind || previous.kind, round_id: data.round_id || previous.round_id, recorded: true }
    sessionStorage.setItem('voting_receipt', JSON.stringify(value))
    nav('/vote/thanks', { replace: true, state: value })
  }
  async function checkBallot(token) {
    if (checking.current || !token) return
    checking.current = true
    try {
      const p = await positionForVoting()
      const { data, error } = await supabase.rpc('voting_ballot', { p_token: token, p_latitude: p.lat, p_longitude: p.lng })
      if (error || !data) { setMsg('No se pudo consultar la votación. Vuelve a intentar.'); return }
      if (data.state === 'ready') { clearInterval(timer.current); nav('/vote', { state: { ballot: data } }); return }
      if (data.state === 'already_voted') { receipt({ ...context, ...data }); return }
      if (data.state === 'not_enabled') setEnabled(false)
      setMsg(messages[data.reason || data.state] || 'No puedes continuar en esta ronda.')
      if (['closed', 'session_expired'].includes(data.state)) clearInterval(timer.current)
    } catch { setMsg('Activa la ubicación precisa para continuar y vuelve a revisar.') }
    finally { checking.current = false }
  }
  async function submit(event) {
    event.preventDefault(); setBusy(true); setMsg('')
    try {
      const p = await positionForVoting()
      const { data, error } = await supabase.rpc('voting_enter', { p_cedula: cedula, p_latitude: p.lat, p_longitude: p.lng })
      if (error || !data) { setMsg('No se pudo validar el ingreso. Vuelve a intentar.'); return }
      if (data.token) sessionStorage.setItem('voting_token', data.token)
      if (data.year) { setContext(data); sessionStorage.setItem('voting_context', JSON.stringify({ year: data.year, kind: data.round_kind, round_id: data.round_id })) }
      if (data.state === 'already_voted') { receipt(data); return }
      if (data.state === 'ready') { await checkBallot(data.token); return }
      if (data.state === 'waiting' && data.token && data.attended) {
        setWaiting(true); setEnabled(data.enabled === true)
        setMsg(data.reason ? (messages[data.reason] || messages.waiting) : '')
        clearInterval(timer.current); timer.current = setInterval(() => checkBallot(data.token), 10000)
        return
      }
      setMsg(messages[data.reason || data.state] || 'No puedes continuar.')
    } catch { setMsg('Debes permitir la ubicación precisa para registrar tu llegada.') }
    finally { setBusy(false) }
  }
  return <VotingLayout year={context?.year}>
    {waiting ? <>
      <div className="voting-checks"><div><span className="voting-check"><VoteIcon/></span>Asistencia registrada</div><div><span className={`voting-check${enabled ? '' : ' pending'}`}>{enabled ? <VoteIcon/> : '—'}</span>{enabled ? 'Habilitado para votar' : 'Habilitación pendiente'}</div></div>
      <div className="voting-clock"><VoteIcon name="clock"/></div>
      <h1 className="waiting-heading">Esperar votaciones</h1><p className="waiting-copy">{!enabled ? 'Tu habilitación electoral está pendiente.' : msg === messages.location_denied ? 'Comprueba tu ubicación para continuar.' : 'La votación todavía no está abierta.'}</p>
      {msg && <p className={msg === messages.waiting ? 'voting-status' : 'voting-error'} role="status">{msg}</p>}
      <button className="voting-primary" disabled={busy} onClick={() => checkBallot(sessionStorage.getItem('voting_token'))}>Verificar apertura</button>
    </> : <>
      <h1 className="voting-intro">Ingresa para votar</h1>
      <form className="voting-form" onSubmit={submit}><label htmlFor="voter-document">Cédula</label><div className="voting-input"><VoteIcon name="person"/><input id="voter-document" value={cedula} onChange={e => setCedula(e.target.value)} placeholder="Ingresa tu cédula" autoComplete="off" autoCapitalize="characters" required/></div>
        {msg && <p className="voting-error" role="alert">{msg}</p>}
        <button className="voting-primary" disabled={busy}>{busy ? 'Verificando ubicación…' : 'Continuar'}</button>
        <p className="voting-help">Al ingresar se registra tu llegada<br/>y se verifica tu habilitación.</p>
      </form>
    </>}
  </VotingLayout>
}

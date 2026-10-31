import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { positionForVoting, toggleCandidate, votingMessage } from '../lib/voterFlow'
import CandidatePhoto from '../components/CandidatePhoto'
import VotingLayout, { VoteIcon } from '../components/VotingLayout'

export default function VoteBallot() {
  const nav = useNavigate(), initial = useLocation().state?.ballot
  const [selected, setSelected] = useState([]), [msg, setMsg] = useState(''), [busy, setBusy] = useState(false)
  useEffect(() => { if (!initial) nav('/', { replace: true }) }, [initial, nav])
  if (!initial) return null
  const ballot = initial
  const counts = selected.reduce((value, id) => { const c = ballot.candidates.find(x => x.id === id); if (c) value[c.gender]++; return value }, { M: 0, F: 0 })
  const ready = counts.M === ballot.male_slots && counts.F === ballot.female_slots
  const kind = { practice: 'Simulacro', official: 'Oficial', tie: 'Desempate' }[ballot.round_kind] || 'Votación'
  function toggle(id) { setSelected(s => toggleCandidate(s, id, ballot.candidates, { M: ballot.male_slots, F: ballot.female_slots })) }
  async function send() {
    if (!ready || busy) return
    setBusy(true); setMsg('')
    try {
      let p
      p = await positionForVoting()
      const { data, error } = await supabase.rpc('voting_submit', { p_token: sessionStorage.getItem('voting_token'), p_candidate_ids: selected, p_latitude: p.lat, p_longitude: p.lng })
      if (error || !data) { setMsg('No se pudo confirmar el envío. Revisa tu conexión y vuelve a intentar.'); return }
      if (data.state !== 'accepted' && data.state !== 'already_voted') { setMsg(votingMessage(data, p)); return }
      const receipt = { year: ballot.year, kind: ballot.round_kind, round_id: ballot.round_id, recorded: true }
      sessionStorage.setItem('voting_receipt', JSON.stringify(receipt)); sessionStorage.removeItem('voting_token')
      nav('/vote/thanks', { replace: true, state: receipt })
    } catch { setMsg('No se pudo confirmar el envío. Revisa tu conexión y vuelve a intentar.') }
    finally { setBusy(false) }
  }
  return <VotingLayout year={ballot.year} compact wide>
    <h1 className="ballot-heading">{kind}{ballot.year ? ` ${ballot.year}` : ''}</h1>
    <p className="ballot-instructions">Selecciona {ballot.female_slots} {ballot.female_slots === 1 ? 'mujer' : 'mujeres'} y {ballot.male_slots} {ballot.male_slots === 1 ? 'hombre' : 'hombres'}.</p>
    <div className="ballot-quotas" aria-live="polite">{['F', 'M'].map(gender => <div className="ballot-quota" key={gender}><VoteIcon name="person"/><span>{gender === 'F' ? 'Mujeres' : 'Hombres'}<strong>{counts[gender]}/{gender === 'F' ? ballot.female_slots : ballot.male_slots}</strong></span></div>)}</div>
    <div className="ballot-options">{[...ballot.candidates].sort((a, b) => a.gender.localeCompare(b.gender)).map(c => {
      const picked = selected.includes(c.id), full = !picked && counts[c.gender] >= (c.gender === 'F' ? ballot.female_slots : ballot.male_slots)
      return <button type="button" className="ballot-card" aria-pressed={picked} aria-label={`${c.name}, ${picked ? 'seleccionado' : full ? 'cupo completo' : 'sin seleccionar'}`} key={c.id} disabled={busy || full} onClick={() => toggle(c.id)}>
        <div className="ballot-portrait"><CandidatePhoto path={c.photo_url} name={c.name}/>{full ? <span className="ballot-full">Cupo completo</span> : <span className={`ballot-mark${picked ? ' selected' : ''}`}>{picked && <VoteIcon/>}</span>}</div><strong className="ballot-name">{c.name}</strong>
      </button>
    })}</div>
    <div className="ballot-summary">{ballot.female_slots} {ballot.female_slots === 1 ? 'mujer' : 'mujeres'} · {ballot.male_slots} {ballot.male_slots === 1 ? 'hombre' : 'hombres'}</div>
    {msg && <p className="voting-error" role="alert">{msg}</p>}
    <div className="ballot-actions"><button className="voting-primary" disabled={!ready || busy} onClick={send}>{busy ? 'Verificando y enviando…' : 'Enviar voto'}</button></div>
  </VotingLayout>
}

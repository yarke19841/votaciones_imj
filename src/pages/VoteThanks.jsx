import { Link, Navigate, useLocation } from 'react-router-dom'
import VotingLayout, { VoteIcon } from '../components/VotingLayout'

export default function VoteThanks() {
  const state = useLocation().state
  let receipt = state
  if (!receipt?.recorded) { try { receipt = JSON.parse(sessionStorage.getItem('voting_receipt')) } catch {} }
  if (!receipt?.recorded) return <Navigate to="/" replace/>
  const kind = { official: 'Oficial', practice: 'Simulacro', tie: 'Desempate' }[receipt.kind] || 'esta ronda'
  return <VotingLayout year={receipt.year}>
    <div className="receipt-icon"><VoteIcon/></div>
    <h1 className="receipt-title">¡Gracias por tu voto!</h1><p>Tu participación quedó registrada.</p>
    <hr className="receipt-rule"/>
    <div className="receipt-box"><strong>Ya votaste en {kind}{receipt.year ? ` ${receipt.year}` : ''}.</strong><p>No puedes votar nuevamente<br/>en esta votación.</p></div>
    <Link className="receipt-finish" to="/">Volver al inicio</Link>
  </VotingLayout>
}

import { useEffect, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'
const rpc=async(name,args)=>{const {data,error}=await supabase.rpc(name,args);if(error)throw error;return data}
export default function AdminQuorum({election,rounds,onSaved}) {
 const [roundId,setRoundId]=useState(''),[percent,setPercent]=useState(election?.quorum_percent??''),[status,setStatus]=useState(null)
 const [error,setError]=useState(''),[busy,setBusy]=useState(false),[updated,setUpdated]=useState('')
 const version=useRef(0)
 useEffect(()=>{setPercent(election?.quorum_percent??'')},[election?.quorum_percent])
 useEffect(()=>{
  const id=++version.current;let pending=false
  setStatus(null);setUpdated('');setError('')
  async function refresh(){if(!roundId||pending||document.hidden)return;pending=true;try{const data=await rpc('voting_admin_quorum',{p_round_id:roundId});if(id===version.current){setStatus(data);setError('');setUpdated(new Date().toLocaleTimeString('es-PA'))}}catch(e){if(id===version.current)setError(e.message)}finally{pending=false}}
  refresh();const timer=setInterval(refresh,5000);window.addEventListener('focus',refresh)
  return()=>{version.current++;clearInterval(timer);window.removeEventListener('focus',refresh)}
 },[roundId,election?.quorum_percent])
 async function save(event){event.preventDefault();setBusy(true);setError('');try{await rpc('voting_admin_set_quorum',{p_election_id:election.id,p_percent:Number(percent)});await onSaved()}catch(e){setError(e.message)}finally{setBusy(false)}}
 return <section className="full"><div className="reference-info">Control de asistencia antes de abrir la votación · Solo Administración</div><div className="quick-checkin-grid"><article className="card"><h2>Configurar quórum</h2><form onSubmit={save}><label>Porcentaje mínimo requerido (%)<input type="number" required min="0.01" max="100" step="0.01" value={percent} onChange={e=>setPercent(e.target.value)} disabled={busy||!election}/></label><button disabled={busy||!election}>{busy?'Guardando…':'Guardar porcentaje'}</button></form><p>Se calcula sobre las personas habilitadas para votar en esta elección. Cada identidad cuenta una sola vez.</p><label>Jornada<select value={roundId} onChange={e=>setRoundId(e.target.value)}><option value="">Seleccionar…</option>{rounds.filter(r=>r.round_kind!=='tie').map(r=><option key={r.id} value={r.id}>{r.round_kind==='practice'?'Simulacro':'Oficial'} · Ronda {r.round_number}</option>)}</select></label>{error&&<p role="alert" className="notice">{error}</p>}</article><aside className="card" aria-live="polite"><h2>Asistencia para el quórum</h2>{status?<><strong className="quorum-count">{status.eligible_present} de {status.eligible_total}</strong><p>Habilitados que registraron su llegada · {status.present_percent??'—'} %</p><p className="reference-info">{status.quorum_percent==null?'Porcentaje pendiente de configurar':status.eligible_total===0?'Padrón de habilitados vacío':status.reached?'Quórum alcanzado':'Quórum pendiente'}</p><p>Mínimo configurado: {status.quorum_percent??'—'} %</p>{status.required_present!=null&&<p>Se requieren {status.required_present} presentes. Faltan {status.remaining}.</p>}<small>Actualización automática cada 5 segundos. Última consulta: {updated}.</small></>:<p>Selecciona una jornada para ver el conteo.</p>}<p>Registrar llegada y emitir voto se cuentan por separado. Alcanzar el porcentaje no abre la votación automáticamente.</p><p className="privacy">Este contador conserva las llegadas registradas; no detecta si alguien sale de la iglesia.</p></aside></div></section>
}

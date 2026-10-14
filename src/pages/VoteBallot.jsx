import { useEffect,useState } from 'react'
import { useLocation,useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { currentPosition, toggleCandidate, voterMessages } from '../lib/voterFlow'
import CandidatePhoto from '../components/CandidatePhoto'

export default function VoteBallot(){
 const nav=useNavigate(),initial=useLocation().state?.ballot,[ballot,setBallot]=useState(initial),[selected,setSelected]=useState([]),[msg,setMsg]=useState(''),[busy,setBusy]=useState(false)
 useEffect(()=>{if(!initial)nav('/',{replace:true})},[initial,nav]); if(!ballot)return null
 const counts=selected.reduce((a,id)=>{const c=ballot.candidates.find(x=>x.id===id);if(c)a[c.gender]++;return a},{M:0,F:0})
 function toggle(id){setSelected(s=>toggleCandidate(s,id,ballot.candidates,{M:ballot.male_slots,F:ballot.female_slots}))}
 async function send(){
  if(counts.M!==ballot.male_slots||counts.F!==ballot.female_slots){setMsg(`Selecciona exactamente ${ballot.male_slots} hombre(s) y ${ballot.female_slots} mujer(es).`);return}
  setBusy(true);setMsg('');let p;try{p=await currentPosition()}catch{setBusy(false);setMsg('Activa la ubicación precisa para enviar.');return}
  const token=sessionStorage.getItem('voting_token');const {data,error}=await supabase.rpc('voting_submit',{p_token:token,p_candidate_ids:selected,p_latitude:p.lat,p_longitude:p.lng});setBusy(false)
  if(error||data?.state!=='accepted'){setMsg(voterMessages[data?.state]||'No se pudo enviar. Revisa los cupos e intenta de nuevo.');return}
  sessionStorage.removeItem('voting_token');nav('/vote/thanks',{replace:true})
 }
 return <main className="page"><header><p className="eyebrow">Boleta secreta</p><h1>Selecciona tus candidatos</h1><p>{ballot.election_year ? `Elección ${ballot.election_year} · ` : ''}{ballot.round_kind==='practice'?'Simulacro':ballot.round_kind==='tie'?'Desempate':'Oficial'}</p><p>Cupos: {ballot.male_slots} hombre(s) y {ballot.female_slots} mujer(es).</p></header>
 <div className="candidate-grid">{ballot.candidates.map(c=><button type="button" className={`candidate ${selected.includes(c.id)?'selected':''}`} onClick={()=>toggle(c.id)} key={c.id}>
   <CandidatePhoto path={c.photo_url} name={c.name}/><strong>{c.name}</strong><span>{c.gender==='M'?'Hombre':'Mujer'}</span></button>)}</div>
 <div className="sticky-submit"><span>H {counts.M}/{ballot.male_slots} · M {counts.F}/{ballot.female_slots}</span>{msg&&<p className="error">{msg}</p>}<button onClick={send} disabled={busy}>{busy?'Verificando y enviando…':'Enviar voto'}</button></div></main>
}

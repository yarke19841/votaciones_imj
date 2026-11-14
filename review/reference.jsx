import React, { useState, useRef } from 'react'
import { createRoot } from 'react-dom/client'
import '../src/styles/ui.css'
import '../src/index.css'
import '../src/styles/identity.css'
import { AdminNavigation, AdminPageHeader, CandidateWorkspace, ResultPanels } from '../src/components/AdminReferenceUI'
import '../src/styles/admin-reference.css'

const noop = () => {}
const candidates = ['Ana Rodríguez','María López','José Pérez','Luis Martínez'].map((full_name,i) => ({id:String(i),full_name,gender:i<2?'F':'M',active:i!==3,photo_url:null}))
const sampleRows = [['Ana Rodríguez','F',88,'Puesto obtenido'],['María López','F',71,'Empate por puesto pendiente'],['Carmen Ruiz','F',71,'Empate por puesto pendiente'],['Elena Díaz','F',40,'Fuera de cupo'],['José Pérez','M',95,'Puesto obtenido'],['Luis Martínez','M',87,'Puesto obtenido'],['Carlos Gómez','M',76,'Puesto obtenido'],['Roberto Mendoza','M',43,'Fuera de cupo']].map(([full_name,gender,vote_count,result_status],candidate_id)=>({candidate_id,full_name,gender,vote_count,result_status}))
const blank = {id:null,name:'',gender:'F',active:true,photo:null}
function Review() {
 const [view,setView]=useState('candidates'),[open,setOpen]=useState(false),[candidate,setCandidate]=useState(blank)
 const toggle=useRef(null),close=useRef(null)
 const practice=view==='practice'
 const pick=id=>{setView(id);setOpen(false);setCandidate(blank)}
 const samplePhoto=c=><div role="img" aria-label={`Foto de referencia de ${c.full_name}`} className="photo-placeholder"><svg className="review-photo" viewBox={`${[648,865,1072,1293][Number(c.id)]} 149 116 106`} preserveAspectRatio="xMidYMid slice" aria-hidden="true"><image href="/docs/referencias/Referencia_Administracion_IMJ.jpeg" width="1536" height="1024"/></svg></div>
 return <><main className="admin-page admin-with-navigation"><AdminPageHeader title={view==='results'?'Resultados · Oficial 2027':practice?'Catálogo del simulacro 2026':view==='candidates'?'Candidatos oficiales · 2027':({operation:'Votaciones',roster:'Habilitados',election:'Elecciones y cupos',location:'Ubicación y excepciones',registration:'Registro del día'}[view])} elections={[{id:'review',election_year:2027,title:'Oficial'}]} selected="review" onElectionChange={noop} onRefresh={noop} onExit={noop} onMenu={()=>setOpen(!open)} menuRef={toggle} menuOpen={open}/>
 {open&&<button className="admin-menu-backdrop" aria-label="Cerrar menú lateral" onClick={()=>setOpen(false)}/>}
 <AdminNavigation view={view} onSelect={pick} open={open} onClose={()=>setOpen(false)} closeRef={close}/>
 {view==='results'?<ResultPanels rows={sampleRows} onExport={noop}/>:['candidates','practice'].includes(view)?<CandidateWorkspace practice={practice} year={2027} femaleSlots={2} maleSlots={3} candidate={candidate} onCandidate={setCandidate} onSubmit={e=>e.preventDefault()} onPhoto={noop} onCancel={()=>setCandidate(blank)} candidates={candidates} onEdit={c=>setCandidate({...blank,id:c.id,name:c.full_name,gender:c.gender,active:c.active})} onChangePhoto={c=>setCandidate({...blank,id:c.id,name:c.full_name})} configured renderPhoto={samplePhoto} practiceAction={<article className="card"><h2>Simulacro 2027</h2><p>En preparación · Comparte los habilitados de 2027.</p><button>Preparar simulacro</button></article>}/>:<section className="card"><h2>Vista de revisión</h2><p>Esta muestra local permite revisar candidatos, resultados y simulacro. No está conectada a la base de datos.</p></section>}
 </main><footer className="developer-credit developer-credit-admin">Desarrollado por Zykodio · Revisión visual con datos ficticios</footer></>
}
createRoot(document.getElementById('root')).render(<Review/> )

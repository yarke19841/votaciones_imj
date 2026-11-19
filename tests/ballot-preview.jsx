// UI-only fixture. No token or vote submission is provided.
import React from 'react'
import {createRoot} from 'react-dom/client'
import {MemoryRouter,Routes,Route} from 'react-router-dom'
import VoteBallot from '../src/pages/VoteBallot'
import '../src/styles/ui.css'
import '../src/index.css'
import '../src/styles/identity.css'
const ballot={year:2098,round_kind:'practice',female_slots:2,male_slots:3,candidates:Array.from({length:8},(_,i)=>({id:String(i+1),gender:i<4?'F':'M',name:'DEMO Catálogo práctica — '+(i+1)}))}
createRoot(document.getElementById('root')).render(<MemoryRouter initialEntries={[{pathname:'/vote',state:{ballot}}]}><Routes><Route path="/vote" element={<VoteBallot/>}/></Routes></MemoryRouter>)

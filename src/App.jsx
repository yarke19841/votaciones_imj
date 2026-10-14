import { Navigate, Route, Routes } from 'react-router-dom'
import RequireAdmin from './components/RequireAdmin'
import VoteLogin from './pages/VoteLogin'
import VoteBallot from './pages/VoteBallot'
import VoteThanks from './pages/VoteThanks'
import AdminLogin from './pages/admin/AdminLogin'
import AdminHome from './pages/admin/AdminHome'

export default function App(){return <Routes>
  <Route path="/" element={<VoteLogin/>}/>
  <Route path="/vote" element={<VoteBallot/>}/>
  <Route path="/vote/thanks" element={<VoteThanks/>}/>
  <Route path="/admin/login" element={<AdminLogin/>}/>
  <Route path="/admin" element={<RequireAdmin><AdminHome/></RequireAdmin>}/>
  <Route path="*" element={<Navigate to="/" replace/>}/>
</Routes>}

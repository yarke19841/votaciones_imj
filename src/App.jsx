// App.jsx
import { Routes, Route, Navigate } from "react-router-dom"
import RequireAdmin from "./components/RequireAdmin.jsx"
import AdminLayout from "./layouts/AdminLayout.jsx"

// Público
import VoteLogin from "./pages/VoteLogin.jsx"
import VoteBallot from "./pages/VoteBallot.jsx"
import VoteThanks from "./pages/VoteThanks.jsx"

// Admin
import AdminLogin from "./pages/admin/AdminLogin.jsx"
import AdminHome from "./pages/admin/AdminHome.jsx"
import AdminElectionList from "./pages/admin/AdminElectionList.jsx"
import AdminElectionConfig from "./pages/admin/AdminElectionConfig.jsx"
import AdminMembers from "./pages/admin/AdminMembersList.jsx"
import AdminResults from "./pages/admin/AdminResults.jsx"
import AdminCheckIn from "./pages/admin/AdminCheckIn.jsx"
import AdminCandidateList from "./pages/admin/AdminCandidateList.jsx"
import AdminVoterEligibility from "./pages/admin/AdminVoterElegibility.jsx"

export default function App() {
  return (
    <Routes>
      {/* Público */}
      <Route path="/" element={<VoteLogin />} />
      <Route path="/vote" element={<VoteBallot />} />
      <Route path="/vote/thanks" element={<VoteThanks />} />

      {/* Admin: login público */}
      <Route path="/admin/login" element={<AdminLogin />} />

      {/* Admin: protegido + layout (rutas RELATIVAS dentro de /admin) */}
      <Route path="/admin" element={<RequireAdmin>
            <AdminLayout />  </RequireAdmin>
        }
      >
        {/* /admin */}
        <Route index element={<AdminHome />} />
        {/* /admin/home (alias opcional) */}
        <Route path="home" element={<AdminHome />} />

        {/* /admin/elections */}
        <Route path="elections" element={<AdminElectionList />} />

        {/* ✅ /admin/members */}
        <Route path="members/" element={<AdminMembers />} />

        {/* ✅ /admin/candidatos*/}
        <Route path="candidates/" element={<AdminCandidateList/>} />
        // en src/App.jsx
<Route path="/admin/checkin" element={
  <RequireAdmin>
    <AdminCheckIn />
  </RequireAdmin>
} />


{/* ✅ /admin/config elecciones */}
        <Route path="electionconfig/" element={<AdminElectionConfig/>} />
<Route path="/admin/voterse" element={<RequireAdmin><AdminVoterEligibility/></RequireAdmin>} />


        {/* /admin/elections/:id/... */}
        <Route path="elections/:id/config"  element={<AdminElectionConfig />} />
        <Route path="elections/:id/members" element={<AdminMembers />} />
        <Route path="elections/:id/results" element={<AdminResults />} />
        <Route path="elections/:id/checkin" element={<AdminCheckIn />} />
        
      </Route>

      {/* Redirección y fallback */}
      <Route path="/admin" element={<Navigate to="/admin/home" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

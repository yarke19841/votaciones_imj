// src/components/RequireAdmin.jsx
import { Navigate, useLocation } from "react-router-dom"
import { isAdmin } from "../lib/authAdmin"

export default function RequireAdmin({ children }) {
  const loc = useLocation()
  const ok = isAdmin()
  if (!ok) {
    console.warn("[RequireAdmin] Bloqueado. isAdmin=false. from:", loc.pathname)
    return <Navigate to="/admin/login" replace state={{ from: loc.pathname }} />
  }
  return children
}

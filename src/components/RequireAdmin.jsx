// src/components/RequireAdmin.jsx
import { Navigate, useLocation } from "react-router-dom"
import { isAdmin } from "../lib/authAdmin"

export default function RequireAdmin({ children }) {
  const location = useLocation()
  if (!isAdmin()) {
    return <Navigate to="/admin/login" replace state={{ from: location }} />
  }
  return children
}

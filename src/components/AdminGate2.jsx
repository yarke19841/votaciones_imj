import { isAdmin } from "../lib/authAdmin"
import { Navigate, useLocation } from "react-router-dom"

export default function AdminGate({ children }){
  const loc = useLocation()
  if (!isAdmin()) return <Navigate to="/admin/login" replace state={{ from: loc.pathname }} />
  return children
}

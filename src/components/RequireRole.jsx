// src/components/RequireRole.jsx
import { Navigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

export default function RequireRole({ role: required, children }) {
  const { role } = useAuth()
  if (role !== required) return <Navigate to="/403" replace />
  return children
}

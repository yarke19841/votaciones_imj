import { useEffect, useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { getAdminSession } from '../lib/authAdmin'
import { staffDestination } from '../lib/staffRoutes'

export default function RequireAdmin({ children }) {
  const location = useLocation()
  const [state, setState] = useState('loading')
  useEffect(() => {
    let mounted = true
    getAdminSession().then(session => mounted && setState({ session })).catch(() => { if (mounted) setState('denied') })
    return () => { mounted = false }
  }, [])
  if (state === 'loading') return <main className="center-page">Validando acceso…</main>
  if (state === 'denied') return <Navigate to="/admin/login" replace state={{ from: location }} />
  const destination = staffDestination(state.session, location.pathname)
  if (!destination) return <Navigate to="/admin/login" replace state={{ from: location }} />
  if (destination !== location.pathname) return <Navigate to={destination} replace />
  return children
}

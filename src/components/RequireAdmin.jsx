import { useEffect, useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { getAdminSession } from '../lib/authAdmin'

export default function RequireAdmin({ children }) {
  const location = useLocation()
  const [state, setState] = useState('loading')
  useEffect(() => {
    let mounted = true
    getAdminSession().then(session => mounted && setState(session ? 'allowed' : 'denied')).catch(() => { if (mounted) setState('denied') })
    return () => { mounted = false }
  }, [])
  if (state === 'loading') return <main className="center-page">Validando acceso…</main>
  if (state === 'denied') return <Navigate to="/admin/login" replace state={{ from: location }} />
  return children
}

import { useEffect, useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { getAdminSession } from '../lib/authAdmin'
import { staffDestination } from '../lib/staffRoutes'
import { supabase } from '../lib/supabase'

export default function RequireAdmin({ children }) {
  const location = useLocation()
  const [state, setState] = useState('loading')
  useEffect(() => {
    let mounted = true
    let request = 0, timer
    async function validate() {
      const current = ++request
      try {
        const session = await getAdminSession()
        if (mounted && current === request) setState({ session })
      } catch { if (mounted && current === request) setState('denied') }
    }
    validate()
    // Defer Supabase calls outside its auth callback to avoid a client lock.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(event => {
      if (!mounted) return
      if (event === 'SIGNED_OUT') { request += 1; clearTimeout(timer); setState('denied') }
      else if (event !== 'INITIAL_SESSION') { clearTimeout(timer); timer = setTimeout(validate, 0) }
    })
    const focused = () => { if (document.visibilityState === 'visible') validate() }
    window.addEventListener('focus', focused)
    document.addEventListener('visibilitychange', focused)
    return () => {
      mounted = false; request += 1; clearTimeout(timer); subscription.unsubscribe()
      window.removeEventListener('focus', focused); document.removeEventListener('visibilitychange', focused)
    }
  }, [location.pathname])
  if (state === 'loading') return <main className="center-page">Validando acceso…</main>
  if (state === 'denied') return <Navigate to="/admin/login" replace state={{ from: location }} />
  const destination = staffDestination(state.session, location.pathname)
  if (!destination) return <Navigate to="/admin/login" replace state={{ from: location }} />
  if (destination !== location.pathname) return <Navigate to={destination} replace />
  return children
}

import { useEffect, useState } from "react"
import { Outlet, useLocation, Navigate } from "react-router-dom"
import { supabase } from "../lib/supabase"

export default function RequireAuth(){
  const [loading, setLoading] = useState(true)
  const [session, setSession] = useState(null)
  const loc = useLocation()

  useEffect(() => {
    let mounted = true

    async function init(){
      const { data: { session } } = await supabase.auth.getSession()
      if (mounted) setSession(session)
      setLoading(false)
    }
    init()

    const { data: sub } = supabase.auth.onAuthStateChange((_evt, s) => {
      setSession(s)
    })

    return () => { mounted = false; sub?.subscription?.unsubscribe() }
  }, [])

  if (loading) {
    return (
      <div style={{
        display:"grid", placeItems:"center", height:"100vh",
        fontFamily:"system-ui,-apple-system,Segoe UI,Roboto"
      }}>
        Cargando…
      </div>
    )
  }

  if (!session) {
    return <Navigate to="/admin/login" replace state={{ from: loc.pathname }} />
  }

  return <Outlet />
}

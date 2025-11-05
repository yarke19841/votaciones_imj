import { useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { clearAdminSession } from "../../components/RequireAdmin.jsx"

export default function AdminLogout(){
  const nav = useNavigate()
  useEffect(() => {
    clearAdminSession()
    nav("/", { replace:true })
  }, [nav])
  return (
    <div style={{display:"grid", placeItems:"center", height:"100vh", fontFamily:"system-ui,-apple-system,Segoe UI,Roboto"}}>
      Cerrando sesión…
    </div>
  )
}

import { Link, useLocation } from "react-router-dom"

export default function AdminBar(){
  const { pathname } = useLocation()
  const is = (p) => pathname.startsWith(p)
  const tab = (active) => `tabs__item ${active?"is-active":""}`
  return (
    <div className="toolbar">
      <div className="toolbar__inner">
        <div className="toolbar__brand">Votaciones · Admin</div>
        <div className="tabs" style={{display:"flex", gap:8, flexWrap:"wrap"}}>
          <Link className={is("/admin/elections")?"is-active":""} to="/admin/elections">Elecciones</Link>
          <Link className={is("/admin/members")?"is-active":""}   to="/admin/members">Miembros</Link>
          <Link className={is("/admin/candidates")?"is-active":""} to="/admin/candidates">Candidatos</Link>
          <Link className={is("/admin/voters")?"is-active":""}    to="/admin/voters">Votantes</Link>
          <Link className={is("/admin/results")?"is-active":""}   to="/admin/results">Resultados</Link>
          <Link className={is("/admin/settings")?"is-active":""}  to="/admin/settings">Ajustes</Link>
        </div>
      </div>
    </div>
  )
}

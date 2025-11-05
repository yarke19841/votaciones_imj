// src/layouts/AdminLayout.jsx
import { Outlet, Link } from "react-router-dom"

export default function AdminLayout() {
  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between border-b px-4 py-3">
        <Link to="/admin" className="text-lg font-semibold">Votaciones · Admin</Link>
        <div className="flex items-center gap-3">
          <Link
            to="/admin/login"
            onClick={() => localStorage.clear()}
            className="rounded bg-neutral-100 px-3 py-1.5 text-sm"
          >
            Salir
          </Link>
        </div>
      </header>
      <main className="p-4">
        <Outlet /> {/* indispensable */}
      </main>
    </div>
  )
}

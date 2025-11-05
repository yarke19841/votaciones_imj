import { Link } from "react-router-dom"

export default function AdminPlaceholder({ title }) {
  return (
    <div className="mx-auto max-w-4xl p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">{title}</h1>
        <Link className="rounded bg-neutral-100 px-3 py-2 text-sm" to="/admin">← Volver al Panel</Link>
      </div>
      <p className="text-neutral-600">
        Vista en construcción. Aquí irá el módulo de <strong>{title}</strong>.
      </p>
    </div>
  )
}

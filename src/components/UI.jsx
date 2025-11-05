export function Container({ children, className="" }) {
  return <div className={`max-w-6xl mx-auto px-4 py-6 ${className}`}>{children}</div>
}

export function Card({ children, className="" }) {
  return <div className={`bg-white rounded-2xl shadow-sm border border-gray-200 p-5 ${className}`}>{children}</div>
}

export function CardHeader({ title, caption, right }) {
  return (
    <div className="flex items-start justify-between gap-4 mb-4">
      <div>
        <h3 className="text-lg font-semibold">{title}</h3>
        {caption && <p className="text-sm text-gray-600">{caption}</p>}
      </div>
      {right}
    </div>
  )
}

export function Button({ children, variant="primary", className="", ...props }) {
  const base = "inline-flex items-center justify-center px-4 py-2.5 rounded-xl text-sm font-medium transition border"
  const map = {
    primary:  "bg-blue-600 text-white border-blue-600 hover:bg-blue-700",
    secondary:"bg-white text-gray-800 border-gray-300 hover:bg-gray-50",
    success:  "bg-green-600 text-white border-green-600 hover:bg-green-700",
    danger:   "bg-rose-600 text-white border-rose-600 hover:bg-rose-700",
    warning:  "bg-amber-500 text-white border-amber-500 hover:bg-amber-600",
    ghost:    "bg-transparent text-gray-700 border-transparent hover:bg-gray-50"
  }
  const disabled = props.disabled ? "opacity-50 cursor-not-allowed" : ""
  return <button className={`${base} ${map[variant]} ${disabled} ${className}`} {...props}>{children}</button>
}

export function Badge({ children, color="gray", className="" }) {
  const map = {
    gray:   "bg-gray-100 text-gray-800",
    blue:   "bg-blue-100 text-blue-800",
    green:  "bg-green-100 text-green-800",
    amber:  "bg-amber-100 text-amber-800",
    rose:   "bg-rose-100 text-rose-800",
    purple: "bg-purple-100 text-purple-800",
  }
  return <span className={`inline-flex items-center px-2 py-1 rounded-lg text-xs font-medium ${map[color]} ${className}`}>{children}</span>
}

export function EmptyState({ title="Nada aquí", caption="Aún no has agregado elementos.", action }) {
  return (
    <div className="text-center py-10">
      <div className="text-4xl mb-2">🗂️</div>
      <h4 className="font-semibold mb-1">{title}</h4>
      <p className="text-sm text-gray-600 mb-4">{caption}</p>
      {action}
    </div>
  )
}

export function Table({ children }) {
  return (
    <div className="overflow-hidden border border-gray-200 rounded-2xl">
      <table className="w-full border-collapse text-sm">
        {children}
      </table>
    </div>
  )
}

export function Th({ children, className="" }) {
  return <th className={`text-left bg-gray-50 px-4 py-3 font-medium text-gray-700 border-b ${className}`}>{children}</th>
}

export function Td({ children, className="" }) {
  return <td className={`px-4 py-3 border-b ${className}`}>{children}</td>
}

export function SelectableCard({ selected, name, photo, desc="", onClick }) {
  return (
    <button type="button"
      onClick={onClick}
      className={`text-left group w-full ${selected ? "ring-4 ring-blue-300" : ""}`}>
      <Card className="hover:shadow-md transition border-2">
        {photo
          ? <img src={photo} alt={name} className="w-full h-40 object-cover rounded-xl mb-3" />
          : <div className="w-full h-40 rounded-xl bg-gray-100 mb-3" />
        }
        <div className="font-semibold">{name}</div>
        {desc && <div className="text-sm text-gray-600">{desc}</div>}
      </Card>
    </button>
  )
}

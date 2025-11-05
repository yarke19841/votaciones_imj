// src/pages/admin/AdminLogin.jsx
import { useState } from "react"
import { useNavigate } from "react-router-dom"

export default function AdminLogin() {
  const navigate = useNavigate()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")

  const handleSubmit = (e) => {
    e.preventDefault()

    // 🧩 DEMO: credenciales fijas
    const validEmail = "admin@iglesia.com"
    const validPassword = "12345" // ← AQUÍ DEFINES TU PASSWORD

    if (email === validEmail && password === validPassword) {
      localStorage.setItem("role", "admin")
      localStorage.setItem("userEmail", email)
      navigate("/Admin") // entra al panel
    } else {
      setError("Correo o contraseña incorrectos")
    }
  }

  return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh" }}>
      <form
        onSubmit={handleSubmit}
        style={{
          display: "grid",
          gap: 12,
          padding: 24,
          border: "1px solid #ddd",
          borderRadius: 8,
          width: 300,
          background: "#fff",
        }}
      >
        <h2>Acceso Administrativo</h2>
        <input
          type="email"
          placeholder="Correo"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          type="password"
          placeholder="Contraseña"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error && <div style={{ color: "red", fontSize: 14 }}>{error}</div>}
        <button type="submit">Entrar</button>
      </form>
    </div>
  )
}

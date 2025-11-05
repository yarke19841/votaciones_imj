// src/auth/AuthContext.jsx
import { createContext, useContext, useEffect, useMemo, useState } from 'react'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)   // { id, email }
  const [role, setRole] = useState(null)   // "admin" | "user" | null
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Restaurar sesión simple desde localStorage (ajústalo si usas tu backend/Supabase)
    const raw = localStorage.getItem('session')
    if (raw) {
      const session = JSON.parse(raw)
      setUser(session.user)
      setRole(session.role)
    }
    setLoading(false)
  }, [])

  const login = async ({ email, password }) => {
    // Aquí deberías autenticar contra tu backend/Supabase.
    // DEMO: si email termina en "@admin" => admin
    const isAdmin = email.includes('@admin')
    const session = { user: { id: 'u1', email }, role: isAdmin ? 'admin' : 'user' }
    localStorage.setItem('session', JSON.stringify(session))
    setUser(session.user)
    setRole(session.role)
    return session
  }

  const logout = () => {
    localStorage.removeItem('session')
    setUser(null)
    setRole(null)
  }

  const value = useMemo(() => ({ user, role, login, logout, loading }), [user, role, loading])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)

// src/pages/Login.jsx
import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

export default function Login() {
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const navigate = useNavigate()
  const location = useLocation()
  const from = location.state?.from?.pathname || '/'

  const onSubmit = async (e) => {
    e.preventDefault()
    try {
      const session = await login({ email, password })
      // Si es admin y venía de /admin, vuelve a /admin; si no, a home
      if (session.role === 'admin' && from.startsWith('/admin')) navigate('/admin', { replace: true })
      else navigate(from, { replace: true })
    } catch (err) {
      setError('Credenciales inválidas')
    }
  }

  return (
    <form onSubmit={onSubmit} style={{maxWidth:360,margin:'40px auto',display:'grid',gap:12}}>
      <h2>Iniciar sesión</h2>
      <input placeholder="email" value={email} onChange={e=>setEmail(e.target.value)} />
      <input placeholder="password" type="password" value={password} onChange={e=>setPassword(e.target.value)} />
      {error && <div style={{color:'red'}}>{error}</div>}
      <button type="submit">Entrar</button>
      <p style={{fontSize:12,opacity:.7}}>Tip demo: usa un correo con “@admin” para entrar como admin.</p>
    </form>
  )
}

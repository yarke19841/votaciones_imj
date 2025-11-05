// src/lib/authAdmin.js
const KEY = "role"
const ROLE = "admin"

// Cambia esta clave cuando quieras (o lee de .env)
const MASTER_PASS = import.meta.env.VITE_ADMIN_PASS || "12345"

export function loginAdmin(pass) {
  if (!pass) return { ok: false, msg: "Ingresa la clave" }
  if (pass !== MASTER_PASS) return { ok: false, msg: "Clave inválida" }
  localStorage.setItem(KEY, ROLE)
  return { ok: true }
}

export function isAdmin() {
  return localStorage.getItem(KEY) === ROLE
}

export function logoutAdmin() {
  localStorage.removeItem(KEY)
}

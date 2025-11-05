// src/lib/authAdmin.js

const STORAGE_KEY = "role"
const ADMIN_ROLE  = "admin"

// ⚠️ Cambia esta clave por una variable de entorno si quieres.
// Ej.: import.meta.env.VITE_ADMIN_PASS
const ADMIN_PASS = import.meta.env.VITE_ADMIN_PASS || "12345"

export function isAdmin() {
  try {
    return localStorage.getItem(STORAGE_KEY) === ADMIN_ROLE
  } catch {
    return false
  }
}

export function loginAdmin(pass) {
  if (!pass || typeof pass !== "string") {
    return { ok: false, msg: "Ingresa tu clave." }
  }
  if (pass.trim() !== ADMIN_PASS) {
    return { ok: false, msg: "Clave incorrecta." }
  }
  try {
    localStorage.setItem(STORAGE_KEY, ADMIN_ROLE)
    localStorage.setItem("admin_logged_at", String(Date.now()))
  } catch (e) {
    return { ok: false, msg: "No se pudo guardar sesión (localStorage bloqueado)." }
  }
  return { ok: true, msg: "OK" }
}

export function logoutAdmin() {
  try {
    if (isAdmin()) localStorage.removeItem(STORAGE_KEY)
  } catch {}
}

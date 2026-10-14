import { supabase } from './supabase'

export async function getAdminSession() {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.user) return null
  const { data, error } = await supabase.from('profiles').select('role,is_active').eq('user_id', session.user.id).maybeSingle()
  if (error || !['admin', 'pastor', 'leader'].includes(data?.role) || !data?.is_active) return null
  return { ...session, votingRole: data.role }
}

export async function loginAdmin(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) return { ok: false, msg: 'Correo o contraseña incorrectos.' }
  const session = await getAdminSession()
  if (!session) {
    await supabase.auth.signOut()
    return { ok: false, msg: 'Esta cuenta no tiene acceso activo al panel de votaciones.' }
  }
  return { ok: true, session: data.session }
}

export async function logoutAdmin() { await supabase.auth.signOut() }

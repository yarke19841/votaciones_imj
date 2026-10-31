import { supabase, isQaEnvironment } from './supabase'

export async function getAdminSession() {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.user) return null
  const { data, error } = await supabase.from('profiles').select('role,is_active').eq('user_id', session.user.id).maybeSingle()
  if (!error && data?.is_active && data.role === 'admin') return { ...session, votingRole: data.role }
  const { data: access, error: registrationError } = await supabase.rpc('voting_registration_access')
  if (!registrationError && access?.elections?.length) return { ...session, votingRole: 'registration' }
  if (!error && data?.is_active && ['pastor', 'leader'].includes(data.role)) return { ...session, votingRole: data.role }
  return null
}

export async function loginAdmin(email, password) {
  const aliases = { sa: 'qa-voting-20261014-admin@example.invalid', registro: 'qa-voting-registration@example.invalid' }
  const loginEmail = isQaEnvironment ? (aliases[email.trim().toLowerCase()] || email) : email
  const { data, error } = await supabase.auth.signInWithPassword({ email: loginEmail, password })
  if (error) return { ok: false, msg: 'Correo o contraseña incorrectos.' }
  const session = await getAdminSession()
  if (!session) {
    await supabase.auth.signOut()
    return { ok: false, msg: 'Esta cuenta no tiene acceso activo al panel de votaciones.' }
  }
  return { ok: true, session: data.session }
}

export async function logoutAdmin() { await supabase.auth.signOut() }

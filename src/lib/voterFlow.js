export function toggleCandidate(selected, candidateId, candidates, slots) {
  if (selected.includes(candidateId)) return selected.filter(id => id !== candidateId)
  const candidate = candidates.find(item => item.id === candidateId)
  if (!candidate) return selected
  const count = selected.filter(id => candidates.find(item => item.id === id)?.gender === candidate.gender).length
  return count < slots[candidate.gender] ? [...selected, candidateId] : selected
}

export function currentPosition(geolocation = globalThis.navigator?.geolocation) {
  return new Promise((resolve, reject) => {
    if (!geolocation) { reject(new Error('La ubicación no está disponible en este navegador.')); return }
    geolocation.getCurrentPosition(
      position => resolve({lat: position.coords.latitude, lng: position.coords.longitude}),
      reject,
      {enableHighAccuracy: true, timeout: 15000, maximumAge: 0}
    )
  })
}

// Null coordinates never grant access: the server checks an active, authorized
// exception plus the attendance and eligibility rules independently.
export async function positionForVoting(geolocation = globalThis.navigator?.geolocation) {
  try { return await currentPosition(geolocation) }
  catch { return { lat: null, lng: null } }
}

export const voterMessages = {
  not_found: 'No encontramos esa cédula. Consulta al líder para verificar su registro.',
  not_enabled: 'Asistencia registrada. Tu habilitación electoral sigue pendiente.',
  not_in_tie_electorate: 'Esta ronda solo admite a quienes votaron en la ronda de origen.',
  location_denied: 'Está fuera del límite permitido para votar',
  attendance_required: 'Debes registrar tu llegada para esta ronda.',
  already_voted: 'Tu voto de esta ronda ya fue registrado.',
  session_expired: 'La sesión expiró; ingresa de nuevo.',
  waiting: 'Esperando apertura de votaciones.',
  pending_configuration: 'Pendiente de configuración por Administración.',
  configuration_required: 'Pendiente de configuración por Administración.',
  no_active_round: 'Todavía no se ha iniciado el ingreso a una votación.',
  invalid_selection: 'Revisa los cupos y los candidatos disponibles antes de enviar.'
}

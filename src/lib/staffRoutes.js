const homeByRole = {
  admin: '/admin',
  pastor: '/admin',
  leader: '/admin',
  registration: '/recepcion',
  admission: '/nuevo-ingreso',
}

export function staffDestination(session, requestedPath) {
  const home = homeByRole[session?.votingRole]
  if (typeof home !== 'string') return null
  const allowed = session.votingRole === 'admin'
    ? ['/admin', '/recepcion', '/nuevo-ingreso']
    : (session.votingRoles || [session.votingRole]).map(role => homeByRole[role])
  return allowed.includes(requestedPath) ? requestedPath : home
}

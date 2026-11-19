import test from 'node:test'
import assert from 'node:assert/strict'
import { staffDestination } from '../src/lib/staffRoutes.js'

test('each staff role lands in its own workspace and cannot open another by URL', () => {
  for (const [role, home] of Object.entries({
    registration: '/recepcion', admission: '/nuevo-ingreso', pastor: '/admin', leader: '/admin',
  })) {
    const session = { votingRole: role }
    assert.equal(staffDestination(session), home)
    for (const requested of ['/admin', '/recepcion', '/nuevo-ingreso', '/vote', '//external.test']) {
      assert.equal(staffDestination(session, requested), home)
    }
  }
  assert.equal(staffDestination(null, '/admin'), null)
  assert.equal(staffDestination({ votingRole: 'unknown' }, '/admin'), null)
})

test('explicitly authorized staff and administrators keep access to their desks', () => {
  const both = { votingRole: 'registration', votingRoles: ['registration', 'admission'] }
  assert.equal(staffDestination(both, '/nuevo-ingreso'), '/nuevo-ingreso')
  assert.equal(staffDestination(both, '/admin'), '/recepcion')
  for (const path of ['/admin', '/recepcion', '/nuevo-ingreso']) {
    assert.equal(staffDestination({ votingRole: 'admin' }, path), path)
  }
})

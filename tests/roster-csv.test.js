import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseRosterCsv, rosterCsv } from '../src/lib/rosterCsv.js'
import { positionForVoting } from '../src/lib/voterFlow.js'

test('CSV understands BOM, accents, quoted commas, escaped quotes and semicolons', () => {
  assert.deepEqual(parseRosterCsv('\uFEFFNombre completo,Cédula\r\n"Ana, Maria",8-123-456\r\n'), [{ full_name: 'Ana, Maria', cedula: '8-123-456' }])
  assert.equal(parseRosterCsv('cedula;nombre_completo\n8-123-456;"Ana ""Maria"""')[0].full_name, 'Ana "Maria"')
})
test('invalid CSV and duplicate normalized identities are rejected', () => {
  for (const csv of ['nombre completo,cedula\nAna,8-123-456\nOtro,8123456', 'nombre completo,cedula\nAna,123', 'nombre completo,cedula\n"Ana,123456', 'otro,cedula\nAna,123456']) assert.throws(() => parseRosterCsv(csv))
  assert.throws(() => parseRosterCsv('nombre completo,cedula\n' + Array(501).fill('Ana,123456').join('\n')))
})
test('export includes enabled status and neutralizes spreadsheet formulas', () => {
  const csv = rosterCsv([{ full_name: '=HYPERLINK("x")', cedula_last4: '2345', enabled: false, groups: [{ name: 'B' }] }])
  assert.ok(csv.includes("'=HYPERLINK")); assert.ok(csv.includes('No habilitado')); assert.ok(csv.includes('2345'))
})
test('missing GPS is sent as null for server authorization, GPS is never fabricated', async () => {
  assert.deepEqual(await positionForVoting({ getCurrentPosition(ok, bad) { bad(new Error('denied')) } }), { lat: null, lng: null })
  assert.deepEqual(await positionForVoting({ getCurrentPosition(ok) { ok({ coords: { latitude: 9, longitude: -79 } }) } }), { lat: 9, lng: -79 })
})

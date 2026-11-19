import { test } from 'node:test'
import assert from 'node:assert/strict'
import { classifyResults } from '../src/lib/adminResults.js'

test('Only candidates tied at the cutoff await a tie; established winner survives', () => {
  const rows = [ ['ana', 8], ['maria', 5], ['carmen', 5], ['luz', 2] ].map(([candidate_id, vote_count]) => ({ candidate_id, vote_count, gender: 'F' }))
  assert.deepEqual(classifyResults(rows, { female_slots: 2, male_slots: 0 }).map(r => r.result_status), ['Puesto obtenido', 'Empate por puesto pendiente', 'Empate por puesto pendiente', 'Fuera de cupo'])
})
test('A tie fully within available slots is not a runoff; genders and zero slots stay independent', () => {
  const rows = [ { candidate_id: 'a', gender: 'F', vote_count: 5 }, { candidate_id: 'b', gender: 'F', vote_count: 5 }, { candidate_id: 'c', gender: 'M', vote_count: 9 } ]
  assert.deepEqual(classifyResults(rows, { female_slots: 2, male_slots: 0 }).map(r => r.result_status), ['Puesto obtenido', 'Puesto obtenido', 'Fuera de cupo'])
})

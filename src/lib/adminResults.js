// Mirrors the cutoff rule used by voting_admin_create_tie_round. No identities.
export function classifyResults(rows, round) {
  const statuses = new Map()
  for (const gender of ['M', 'F']) {
    const slots = Number(gender === 'M' ? round.male_slots : round.female_slots)
    const group = rows.filter(row => row.gender === gender).sort((a, b) => Number(b.vote_count) - Number(a.vote_count))
    const cutoff = group[slots - 1]?.vote_count
    const above = group.filter(row => Number(row.vote_count) > Number(cutoff)).length
    const atCutoff = group.filter(row => Number(row.vote_count) === Number(cutoff)).length
    const needsTie = slots > 0 && cutoff !== undefined && atCutoff > slots - above
    for (const row of group) {
      let label = 'Fuera de cupo'
      if (slots > 0 && (cutoff === undefined || Number(row.vote_count) > Number(cutoff))) label = 'Puesto obtenido'
      else if (slots > 0 && Number(row.vote_count) === Number(cutoff)) label = needsTie ? 'Empate por puesto pendiente' : 'Puesto obtenido'
      statuses.set(row.candidate_id, label)
    }
  }
  return rows.map(row => ({ ...row, result_status: statuses.get(row.candidate_id) || 'Fuera de cupo' }))
}

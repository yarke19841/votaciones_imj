export function parseRosterCsv(text) {
  if (text.length > 1_000_000) throw new Error('El archivo supera 1 MB.')
  const delimiter = text.split(/\r?\n/)[0].includes(';') ? ';' : ','
  const rows = []; let row = [], cell = '', quoted = false, ended = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++ }
      else if (c === '"') { quoted = false; ended = true }
      else cell += c
    } else if (c === '"' && !cell && !ended) quoted = true
    else if (c === delimiter || c === '\n' || c === '\r') {
      row.push(cell.trim()); cell = ''; ended = false
      if (c !== delimiter) {
        if (row.some(Boolean)) rows.push(row)
        row = []; if (c === '\r' && text[i + 1] === '\n') i++
      }
    } else { if (ended && c.trim()) throw new Error('Comillas CSV inválidas.'); cell += c }
  }
  if (quoted) throw new Error('Hay comillas sin cerrar.')
  row.push(cell.trim()); if (row.some(Boolean)) rows.push(row)
  const header = (rows.shift() || []).map(x => x.replace(/^\uFEFF/, '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[ _]/g, ''))
  const name = header.findIndex(x => ['nombrecompleto', 'fullname'].includes(x)), doc = header.indexOf('cedula')
  if (header.length !== 2 || name < 0 || doc < 0) throw new Error('Usa las dos columnas: nombre completo y cédula.')
  if (!rows.length || rows.length > 500) throw new Error('El CSV debe contener entre 1 y 500 personas.')
  const seen = new Set()
  return rows.map((r, i) => {
    const full_name = r[name], cedula = r[doc], normalized = (cedula || '').toUpperCase().replace(/[^A-Z0-9]/g, '')
    if (r.length !== 2 || !full_name || full_name.length < 2 || full_name.length > 200 || normalized.length < 5 || normalized.length > 40) throw new Error(`Revisa el nombre y la cédula de la fila ${i + 2}.`)
    if (seen.has(normalized)) throw new Error(`Cédula repetida en la fila ${i + 2}.`)
    seen.add(normalized); return { full_name, cedula }
  })
}

export function rosterCsv(people) {
  const cell = value => `"${String(value ?? '').replace(/^[\s]*[=+@-]/, "'$&").replaceAll('"', '""')}"`
  return '\uFEFF' + [['Nombre completo', 'Cédula (últimos 4)', 'Listados', 'Habilitación'], ...people.map(p => [p.full_name, p.cedula_last4 || '', (p.groups || []).map(g => g.name).join(' / '), p.enabled ? 'Habilitado' : 'No habilitado'])].map(r => r.map(cell).join(',')).join('\r\n')
}

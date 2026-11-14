import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { parseRosterCsv } from '../../lib/rosterCsv'

export default function RosterImport({ onImported }) {
  const [territories, setTerritories] = useState([]), [territory, setTerritory] = useState('')
  const [rows, setRows] = useState([]), [busy, setBusy] = useState(false), [message, setMessage] = useState('')
  useEffect(() => {
    let alive = true
    supabase.rpc('voting_admin_territories').then(({ data, error }) => {
      if (alive) { if (error) setMessage(error.message); else setTerritories(data || []) }
    }).catch(() => { if (alive) setMessage('No se pudieron cargar los territorios.') })
    return () => { alive = false }
  }, [])
  async function chooseFile(event) {
    setRows([]); setMessage('')
    const file = event.target.files?.[0]; if (!file) return
    try {
      if (file.size > 1_000_000) throw new Error('El archivo supera 1 MB.')
      setRows(parseRosterCsv(await file.text()))
    } catch (error) { setMessage(error.message) }
  }
  async function save() {
    if (busy || !territory || !rows.length) return
    setBusy(true); setMessage('')
    try {
      const { data, error } = await supabase.rpc('voting_admin_import_members', { p_territory_id: Number(territory), p_rows: rows })
      if (error) throw error
      setRows([])
      setMessage(`Carga guardada: ${data.created} registros nuevos, ${data.reused} existentes. No se cambió la habilitación electoral.`)
      await onImported()
    } catch (error) { setMessage(`No se completó la carga: ${error.message}. Si perdiste conexión, puedes repetir el mismo archivo sin duplicar la carga.`) }
    finally { setBusy(false) }
  }
  return <article className="card"><h2>Importar miembros por territorio</h2>
    <p>CSV con dos columnas: nombre completo y cédula. Máximo 500 personas. La carga no habilita para votar ni asigna una célula.</p>
    <label>Territorio<select disabled={busy} value={territory} onChange={e => setTerritory(e.target.value)}><option value="">Seleccionar…</option>{territories.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
    <label>Archivo CSV<input disabled={busy} type="file" accept=".csv,text/csv" onChange={chooseFile}/></label>
    {rows.length > 0 && <><p>{rows.length} personas listas para cargar en {territories.find(t => String(t.id) === territory)?.name || 'el territorio que selecciones'}.</p><ul>{rows.slice(0, 5).map((r, i) => <li key={i}>{r.full_name} · …{r.cedula.replace(/[^A-Za-z0-9]/g, '').slice(-4)}</li>)}</ul></>}
    {message && <p role="status">{message}</p>}
    <button disabled={busy || !rows.length || !territory} onClick={save}>{busy ? 'Guardando…' : 'Confirmar importación'}</button>
  </article>
}

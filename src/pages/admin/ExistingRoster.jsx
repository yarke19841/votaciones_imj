import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { rosterCsv } from '../../lib/rosterCsv'

async function call(name, args) {
  const { data, error } = await supabase.rpc(name, args)
  if (error) throw error
  return data
}

export default function ExistingRoster({ election, onChanged }) {
  const [rows, setRows] = useState([]), [search, setSearch] = useState(''), [memberId, setMemberId] = useState('')
  const [cedula, setCedula] = useState(''), [busy, setBusy] = useState(false), [msg, setMsg] = useState('')
  const request = useRef(0)
  const refresh = useCallback(async () => {
    const id = ++request.current
    setBusy(true); setMsg('')
    try {
      const data = await call('voting_admin_existing_roster', { p_election_id: election?.id || null })
      if (id === request.current) setRows(data)
    } catch (error) { if (id === request.current) { setRows([]); setMsg(error.message) } }
    finally { if (id === request.current) setBusy(false) }
  }, [election?.id])
  useEffect(() => { refresh(); return () => { request.current += 1 } }, [refresh])
  const visible = rows.filter(r => String(r.full_name || '').toLocaleLowerCase().includes(search.toLocaleLowerCase()) || String(r.cedula_last4 || '').includes(search.trim()))
  const selected = rows.find(r => r.member_id === memberId)
  async function save(enabled) {
    if (!election || !selected || busy) return
    setBusy(true); setMsg('')
    try {
      await call('voting_admin_enable_existing_member', { p_election_id: election.id, p_member_id: memberId, p_cedula: cedula, p_enabled: enabled })
      setCedula(''); await refresh(); await onChanged?.()
      setMsg(enabled ? 'Habilitación guardada para simulacro y oficial de esta elección.' : 'Habilitación revocada para simulacro y oficial de esta elección.')
    } catch (error) { setMsg(error.message) }
    finally { setBusy(false) }
  }
  function download(enabled) {
    const text = rosterCsv(visible.filter(r => r.enabled === enabled))
    const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' })), a = document.createElement('a')
    a.href = url; a.download = `padron-existente-${election?.election_year || 'sin-eleccion'}-${enabled ? 'habilitados' : 'no-habilitados'}.csv`
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url)
  }
  return <article className="card full">
    <h2>Padrón electoral existente</h2>
    <p>El mismo padrón se utiliza para simulacros y votación oficial. La habilitación se comparte dentro de la elección; la asistencia y el voto corresponden a cada ronda.</p>
    <p>{rows.length} personas · {rows.filter(r => r.active).length} activas · {rows.filter(r => r.enabled).length} habilitadas en {election?.election_year || 'la elección seleccionada'}.</p>
    <p>Estar activo en el padrón no habilita automáticamente para votar.</p>
    {!election && <p>Selecciona o crea una elección para administrar sus habilitaciones.</p>}
    <label>Buscar por nombre o últimos cuatro caracteres de cédula<input value={search} onChange={e => { setSearch(e.target.value); setMemberId(''); setCedula('') }}/></label>
    <label>Persona del padrón<select value={memberId} onChange={e => { setMemberId(e.target.value); setCedula(''); setMsg('') }} disabled={busy}><option value="">Seleccionar…</option>{visible.map(r => <option key={r.member_id} value={r.member_id}>{r.full_name} · …{r.cedula_last4} · {r.active ? 'activa' : 'inactiva'} · {r.enabled ? 'habilitada' : 'sin habilitar'}{r.needs_review ? ' · requiere revisión' : ''}</option>)}</select></label>
    {selected && <>{selected.needs_review && <p className="notice">Esta persona requiere revisión. Puedes revocar su habilitación anterior{selected.linked_cedula_last4 ? ` (cédula …${selected.linked_cedula_last4})` : ''}; el historial se conserva.</p>}<label>Cédula completa verificada<input autoComplete="off" value={cedula} onChange={e => setCedula(e.target.value)}/></label><div className="actions"><button disabled={busy || !election || !cedula.trim() || !selected.active || selected.needs_review} onClick={() => save(true)}>Habilitar para simulacro y oficial</button><button className="secondary" disabled={busy || !election || !cedula.trim()} onClick={() => save(false)}>Revocar habilitación</button></div></>}
    <div className="actions"><button className="secondary" disabled={busy} onClick={refresh}>Actualizar padrón</button><button className="secondary" disabled={busy || !election} onClick={() => download(true)}>Exportar habilitados CSV</button><button className="secondary" disabled={busy || !election} onClick={() => download(false)}>Exportar no habilitados CSV</button></div>
    {msg && <p role="status" className="notice">{msg}</p>}
    <p className="privacy">Se conservan las personas y sus estados del padrón anterior. Los documentos completos no se muestran en el listado ni en la exportación.</p>
  </article>
}

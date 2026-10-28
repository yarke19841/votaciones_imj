import { useState } from 'react'
import OfficialLogo from './OfficialLogo'
import CandidatePhoto from './CandidatePhoto'

export const adminSections = [
  ['operation', 'Votaciones', 'ballot'], ['candidates', 'Candidatos', 'person'],
  ['roster', 'Habilitados', 'list'], ['results', 'Resultados', 'chart'],
  ['practice', 'Simulacro 2026', 'catalog'], ['election', 'Elecciones y cupos', 'settings'],
  ['location', 'Ubicación y excepciones', 'pin'], ['registration', 'Registro del día', 'list'],
]

function Icon({ name }) {
  const paths = {
    person: 'M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8M5 21v-3a7 7 0 0 1 14 0v3Z',
    chart: 'M4 4v16h16M8 16v-5m5 5V7m5 9v-8',
    pin: 'M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 0 1 14 0ZM15 10a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
    settings: 'M4 6h16M4 12h16M4 18h16M8 3v6m8 0v6m-6 0v6',
    catalog: 'M3 5h18v4H3ZM5 9v12h14V9M9 12v6m6-6v6',
    list: 'M6 3h12v18H6ZM9 7h6m-6 5h6m-6 5h4',
    ballot: 'M5 4h14v16H5ZM8 8l2 2 4-4m-6 8h8',
  }
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name] || paths.list}/></svg>
}

export function AdminNavigation({ view, onSelect, open, onClose, closeRef }) {
  return <nav id="admin-navigation" className={`actions admin-menu${open ? ' admin-menu-open' : ''}`} aria-label="Administración de votaciones">
    <button type="button" ref={closeRef} className="admin-menu-close" onClick={onClose}>Cerrar menú ×</button>
    <div className="admin-menu-brand"><OfficialLogo/><div><strong>Ministerio<br/>Jezreel</strong><span>Votaciones</span></div></div>
    {adminSections.map(([id, label, icon], i) => <button key={id} className={`${view === id ? '' : 'secondary'}${i === 5 ? ' admin-settings-start' : ''}`} aria-current={view === id ? 'page' : undefined} onClick={() => onSelect(id)}><Icon name={icon}/><span>{label}</span></button>)}
  </nav>
}

export function AdminPageHeader({ title, elections, selected, onElectionChange, onRefresh, onExit, busy, onMenu, menuRef, menuOpen }) {
  return <header className="reference-header">
    <div className="reference-title"><button ref={menuRef} type="button" className="admin-menu-toggle" aria-label="Abrir menú de administración" aria-expanded={menuOpen} aria-controls="admin-navigation" onClick={onMenu}>☰</button><OfficialLogo className="reference-mobile-logo"/><h1>{title}</h1></div>
    <div className="reference-header-actions"><label className="sr-label" htmlFor="admin-election">Elección seleccionada</label><select id="admin-election" value={selected} onChange={e => onElectionChange(e.target.value)}><option value="">Seleccionar elección…</option>{elections.map(e => <option key={e.id} value={e.id}>{e.election_year} · {e.title}</option>)}</select><button className="secondary" onClick={onRefresh} disabled={busy} aria-label="Actualizar datos">↻</button><button className="secondary" onClick={onExit}>Salir</button></div>
  </header>
}

export function CandidateWorkspace({ practice, year, femaleSlots, maleSlots, candidate, onCandidate, onSubmit, photoKey, onPhoto, photoSelected, onCancel, candidates, onEdit, onChangePhoto, busy, configured, practiceAction, renderPhoto = c => <CandidatePhoto path={c.photo_url} name={c.full_name}/> }) {
  const [showForm, setShowForm] = useState(false)
  const update = value => onCandidate({ ...candidate, ...value })
  return <>
    <div className="reference-info">{practice ? 'Candidatos y fotos reutilizados en el simulacro de cada año.' : <><strong>Preparación administrativa</strong><span> · Los votantes verán estos candidatos al abrir la votación oficial.</span></>}</div>
    {practice && <div className="reference-catalog-toolbar"><button type="button" onClick={() => setShowForm(v => !v)}>{showForm ? 'Ocultar formulario' : '+ Agregar candidato'}</button></div>}
    <section className={`reference-candidate-workspace${practice ? ' reference-practice-workspace' : ''}`}>
      {(!practice || showForm || candidate.id) && <article className="card reference-candidate-form"><h2>{candidate.id ? 'Editar candidato' : 'Agregar candidato'}</h2><form onSubmit={onSubmit}>
        <label>Nombre completo<input required maxLength="200" placeholder="Ej. Ana Rodríguez" value={candidate.name} onChange={e => update({ name: e.target.value })}/></label>
        <div className="reference-form-pair"><div><label>Género<select value={candidate.gender} onChange={e => update({ gender: e.target.value })}><option value="F">Mujer</option><option value="M">Hombre</option></select></label><label className="reference-enabled">Habilitado<input role="switch" type="checkbox" checked={candidate.active} onChange={e => update({ active: e.target.checked })}/></label></div>
          <label className="reference-photo-field">Foto<span className="reference-upload">↑<input key={photoKey} type="file" accept="image/jpeg,image/png,image/webp" onChange={onPhoto}/><small>{photoSelected ? 'Foto seleccionada' : candidate.photo ? 'Cambiar foto' : 'Subir foto'}</small></span></label></div>
        <p className="privacy">JPG, PNG o WebP · Hasta 5 MB</p><button disabled={busy || (!practice && !configured)}>{candidate.id ? 'Guardar cambios' : 'Guardar candidato'}</button>{candidate.id && <button type="button" className="secondary" onClick={onCancel}>Cancelar edición</button>}
      </form></article>}
      <div className="reference-candidate-catalog">{!practice && <div className="reference-selection"><Icon name="person"/><span>Selección configurada: <strong>{femaleSlots ?? '—'} mujeres y {maleSlots ?? '—'} hombres</strong></span></div>}
        <div className={`reference-candidate-grid${practice ? ' reference-practice-grid' : ''}`}>{candidates.map(c => <article className="reference-candidate-card" key={c.id}>{renderPhoto(c)}<div className="reference-candidate-details"><h3>{c.full_name}</h3><p>{c.gender === 'F' ? 'Mujer' : 'Hombre'}</p><span className={`reference-status ${c.active ? 'enabled' : ''}`}>● {c.active ? practice ? 'Activo' : 'Habilitado' : 'Inactivo'}</span></div><div className="reference-card-actions"><button className="secondary" disabled={busy} onClick={() => onEdit(c)}>Editar</button><button className="secondary" disabled={busy} onClick={() => onChangePhoto(c)}>Cambiar foto</button></div></article>)}</div>
        {!candidates.length && <div className="reference-empty">Todavía no hay candidatos en este catálogo.</div>}
      </div>
      {practice && <aside>{practiceAction}<div className="reference-selection">Cupos del simulacro: {femaleSlots ?? '—'} mujeres · {maleSlots ?? '—'} hombres</div></aside>}
    </section>
    {practice && <div className="reference-info"><strong>Solo una votación puede estar abierta a la vez.</strong><span> Los votos y resultados se conservan por año.</span></div>}
  </>
}

export function ResultPanels({ rows, onExport }) {
  return <><div className="reference-results-actions"><span className="reference-status">▣ Votación cerrada</span><button onClick={onExport}>↓ Exportar resultados</button></div><div className="reference-results-grid">{[['F', 'Mujeres'], ['M', 'Hombres']].map(([gender, title]) => {
    const ordered = rows.filter(r => r.gender === gender).sort((a, b) => Number(b.vote_count) - Number(a.vote_count))
    const ties = ordered.some(r => r.result_status === 'Empate por puesto pendiente')
    return <article className="card reference-results-panel" key={gender}><h2><Icon name="person"/>{title}</h2><div className="table-scroll" role="region" aria-label={`Resultados de ${title.toLowerCase()}`} tabIndex="0"><table><thead><tr><th>#</th><th>{gender === 'F' ? 'Candidata' : 'Candidato'}</th><th>Votos</th><th>Estado</th></tr></thead><tbody>{ordered.map((r, i) => <tr key={r.candidate_id}><td>{i + 1}</td><td>{r.full_name}</td><td>{r.vote_count}</td><td><span className={`reference-status ${r.result_status === 'Puesto obtenido' ? 'enabled' : ''}`} title={r.result_status}>{r.result_status === 'Puesto obtenido' ? gender === 'F' ? 'Ganadora' : 'Ganador' : r.result_status === 'Empate por puesto pendiente' ? 'Empate' : 'Fuera'}</span></td></tr>)}</tbody></table></div>{!ordered.length && <p className="reference-empty">Sin candidatos en esta categoría.</p>}{ties && <div className="reference-info"><strong>Puesto pendiente</strong> · Empate en el último cupo.</div>}</article>
  })}</div><div className="reference-info"><strong>Resultados por año, tipo y ronda</strong><span> · Exportación sin selecciones individuales.</span></div></>
}

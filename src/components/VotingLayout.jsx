import '../styles/voter.css'
import OfficialLogo from './OfficialLogo'

export function VoteIcon({ name = 'check', ...props }) {
  return <svg viewBox="0 0 64 64" fill="none" aria-hidden="true" {...props}>
    {name === 'clock' ? <><circle cx="32" cy="32" r="25" stroke="currentColor" strokeWidth="4"/><path d="M32 14v19l12 9" stroke="currentColor" strokeWidth="4" strokeLinecap="round"/></> : name === 'person' ? <><circle cx="32" cy="20" r="11" fill="currentColor"/><path d="M13 55v-9a19 19 0 0 1 38 0v9" fill="currentColor"/></> : <path d="m14 33 12 12 25-27" stroke="currentColor" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round"/>}
  </svg>
}

export default function VotingLayout({ children, year, compact = false, wide = false }) {
  return <main className={`voting-stage${wide ? ' voting-stage-wide' : ''}`}>
    <section className={`voting-screen${compact ? ' voting-screen-compact' : ''}`}>
      <header className="voting-brand"><OfficialLogo className="voting-official-logo"/><div className="voting-brand-name">Ministerio Jezreel</div><p>Votaciones{year ? ` ${year}` : ''}</p>
        <svg className="voting-header-wave" viewBox="0 0 600 55" preserveAspectRatio="none" aria-hidden="true"><path d="M0 4Q290 88 600 0V55H0Z" fill="#256394"/><path d="M0 14Q290 96 600 8V55H0Z" fill="white"/></svg>
      </header>
      <div className="voting-content">{children}</div>
      <footer className="voting-waves" aria-hidden="true"><svg viewBox="0 0 600 130" preserveAspectRatio="none"><path d="M0 12C170 25 220 110 390 57S560 19 600 42V130H0Z" fill="#edf6ff"/><path d="M0 55C130 6 250 112 389 90S540 40 600 64V130H0Z" fill="#d9edff"/><path d="M0 88C190 30 245 144 420 101S555 83 600 92V130H0Z" fill="#c5e1fb"/></svg><svg className="voting-leaves" viewBox="0 0 100 120"><path d="M22 113Q52 65 78 15" stroke="#a7d1f3" strokeWidth="3" fill="none"/><path d="M35 91Q6 76 15 59q22 7 20 32m8-13Q22 50 37 40q16 12 6 38m12-21Q43 26 60 20q13 17-5 37m15-23Q64 7 85 0q4 22-15 34M30 100q18-28 41-17-5 18-41 17m15-25q18-27 37-17-5 19-37 17m16-28q14-28 33-21-2 20-33 21" fill="#a7d1f3"/></svg></footer>
    </section>
  </main>
}

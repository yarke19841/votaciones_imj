import { useId } from 'react'

// Keep the original emblem intact. The filter recolors its ink, while the
// circular white base clips away the rectangular background of the source PNG.
export default function OfficialLogo({ className = '' }) {
  const filterId = `jezreel-navy-${useId().replace(/:/g, '')}`
  return <span className={`official-logo ${className}`}>
    <svg className="logo-filters" aria-hidden="true" focusable="false">
      <defs><filter id={filterId} colorInterpolationFilters="sRGB">
        <feColorMatrix type="matrix" values="0 0 0 0 0.019608 0 0 0 0 0.156863 0 0 0 0 0.321569 -1 -1 -1 0 3"/>
      </filter></defs>
    </svg>
    <img src={`${import.meta.env.BASE_URL}jezreel-logo.png`} alt="Logo de Ministerio Jezreel" style={{ filter: `url(#${filterId})` }}/>
  </span>
}

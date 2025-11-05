export const Card = ({title, right, children}) => (
  <div className="card">
    <div className="card__header">
      <div className="card__title">{title}</div>
      <div>{right}</div>
    </div>
    <div className="card__body">{children}</div>
  </div>
)

export const Badge = ({kind="neutral", children}) => {
  const cls = kind==="ok" ? "badge badge--ok"
           : kind==="warn" ? "badge badge--warn"
           : kind==="danger" ? "badge badge--danger"
           : "badge"
  return <span className={cls}>{children}</span>
}

export const Button = ({kind="ghost", children, ...rest}) => {
  const cls = `btn ${kind==="primary"?"btn--primary":kind==="ok"?"btn--ok":kind==="warn"?"btn--warn":kind==="danger"?"btn--danger":"btn--ghost"}`
  return <button className={cls} {...rest}>{children}</button>
}

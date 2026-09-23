export function PageHead({
  title,
  description,
  actions,
}: {
  title: string
  description?: string
  actions?: React.ReactNode
}) {
  return (
    <div className="mb-5.5 flex flex-wrap items-end justify-between gap-4.5">
      <div>
        <h1 className="m-0 mb-1.5 font-display text-[30px] leading-tight font-extrabold">{title}</h1>
        {description && <p className="m-0 text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2.5">{actions}</div>}
    </div>
  )
}

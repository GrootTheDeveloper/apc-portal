import { Link } from 'react-router-dom'

export type BreadcrumbItem = {
  label: string
  to?: string
}

type BreadcrumbProps = {
  items: BreadcrumbItem[]
}

/** Component điều hướng breadcrumb cho các trang chi tiết */
export function Breadcrumb({ items }: BreadcrumbProps) {
  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm text-on-surface-variant flex-wrap">
      {items.map((item, index) => {
        const isLast = index === items.length - 1

        return (
          <div key={`${item.label}-${index}`} className="flex items-center gap-2">
            {index > 0 && (
              <span aria-hidden className="material-symbols-outlined text-sm text-outline select-none">
                chevron_right
              </span>
            )}
            {isLast || !item.to ? (
              <span className="text-on-surface font-medium truncate max-w-[240px] sm:max-w-[480px]" aria-current="page">
                {item.label}
              </span>
            ) : (
              <Link to={item.to} className="hover:text-primary transition-colors">
                {item.label}
              </Link>
            )}
          </div>
        )
      })}
    </nav>
  )
}

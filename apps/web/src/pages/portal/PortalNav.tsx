import { NavLink } from 'react-router-dom'

import { Breadcrumb, type BreadcrumbItem } from '../../components/Breadcrumb'

type PortalNavProps = {
  breadcrumbs?: BreadcrumbItem[]
}

const PORTAL_TABS = [
  { label: 'Tổng quan', to: '/portal', end: true },
  { label: 'Hồ sơ của tôi', to: '/portal/profile' },
  { label: 'Lịch sử hoạt động', to: '/portal/activity-history' },
  { label: 'Vai trò của tôi', to: '/portal/account/roles' },
]

export function PortalNav({ breadcrumbs }: PortalNavProps) {
  return (
    <div className="mb-8 border-b border-outline-variant pb-4">
      {breadcrumbs && breadcrumbs.length > 0 && (
        <div className="mb-4">
          <Breadcrumb items={breadcrumbs} />
        </div>
      )}
      <nav aria-label="Portal Navigation" className="flex items-center gap-2 overflow-x-auto py-1">
        {PORTAL_TABS.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.end}
            className={({ isActive }) =>
              `whitespace-nowrap rounded-apc px-4 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-apc-red text-white'
                  : 'text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface'
              }`
            }
          >
            {tab.label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}

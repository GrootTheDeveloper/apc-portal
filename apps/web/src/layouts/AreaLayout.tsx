import { useState } from 'react'
import { matchPath, NavLink, Outlet, useLocation } from 'react-router-dom'

import { Breadcrumb, type BreadcrumbItem } from '../components/Breadcrumb'
import { useAuth } from '../hooks/useAuth'
import { type MenuGroup, menuPages, visibleMenu } from '../lib/menu'

type AreaLayoutProps = {
  /** tên khu vực, cũng là cấp đầu breadcrumb: "Portal", "Quản trị" */
  title: string
  /** đường dẫn gốc của khu vực: /portal, /admin */
  root: string
  menu: readonly MenuGroup[]
}

const itemClass = ({ isActive }: { isActive: boolean }) =>
  `flex min-h-11 items-center rounded-xl px-3 text-[16px] font-bold transition-colors ${
    isActive ? 'bg-ink text-paper' : 'text-ink hover:bg-apc-blue-pale'
  }`

/** Breadcrumb theo Sitemap mục 15.2: Portal > Nhóm > Đối tượng · Quản trị > Phân hệ > Danh sách > Đối tượng. */
function crumbsFor(pathname: string, title: string, root: string, menu: readonly MenuGroup[]): BreadcrumbItem[] {
  const crumbs: BreadcrumbItem[] = [{ label: title, to: root }]
  const hit = menuPages(menu).find(({ page }) => matchPath({ path: page.to, end: true }, pathname))
  if (!hit || hit.page.to === root) return crumbs
  // Nhóm chỉ có một mục cùng tên (vd "Sự kiện") thì không lặp lại; nhóm không có trang riêng nên không là liên kết.
  if (hit.group.label !== (hit.parent ?? hit.page).label && hit.group.label !== title) crumbs.push({ label: hit.group.label })
  if (hit.parent) crumbs.push({ label: hit.parent.label, to: hit.parent.to })
  crumbs.push({ label: hit.page.label })
  return crumbs
}

/**
 * Khung chung của /portal và /admin (A3): menu theo vai trò bên trái, breadcrumb, nội dung trang ở <Outlet />.
 * Trên điện thoại menu thu gọn thành một nút mở. Mỗi trang con tự bọc <main> của mình.
 */
export function AreaLayout({ title, root, menu }: AreaLayoutProps) {
  const { user } = useAuth()
  const { pathname } = useLocation()
  const [open, setOpen] = useState(false)
  const groups = visibleMenu(menu, user)
  const navId = `${root.slice(1)}-menu`

  return (
    <div className="px-4 pb-16 pt-6 md:px-8">
      <div className="mx-auto grid w-full max-w-container-max gap-6 lg:grid-cols-[260px_minmax(0,1fr)] lg:gap-10">
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <button
            type="button"
            className="flex min-h-12 w-full items-center justify-between rounded-xl bg-ink px-4 font-extrabold text-paper lg:hidden"
            aria-expanded={open}
            aria-controls={navId}
            onClick={() => setOpen((value) => !value)}
          >
            Menu {title.toLowerCase()}
            <span aria-hidden className={`transition-transform ${open ? 'rotate-180' : ''}`}>
              ▾
            </span>
          </button>
          <nav
            id={navId}
            aria-label={`Menu ${title.toLowerCase()}`}
            className={`${open ? 'mt-3 block' : 'hidden'} rounded-2xl bg-soft p-3 lg:mt-0 lg:block`}
          >
            {groups.map((group) => {
              // Nhóm một mục cùng tên với mục: hiện thẳng mục, không cần tiêu đề nhóm.
              const single = group.items.length === 1 && group.items[0]?.label === group.label
              return (
                <div key={group.label} className={single ? '' : 'mt-3 first:mt-0'}>
                  {!single && (
                    <p className="px-3 pb-1 pt-2 font-code text-[13px] font-bold lowercase text-muted">
                      <span aria-hidden>{'// '}</span>
                      {group.label}
                    </p>
                  )}
                  <ul>
                    {group.items.map((item) => (
                      <li key={item.to}>
                        <NavLink to={item.to} end={item.to === root} className={itemClass} onClick={() => setOpen(false)}>
                          {item.label}
                        </NavLink>
                      </li>
                    ))}
                  </ul>
                </div>
              )
            })}
          </nav>
        </aside>

        <div className="min-w-0">
          <div className="mb-6 text-muted">
            <Breadcrumb items={crumbsFor(pathname, title, root, menu)} />
          </div>
          <Outlet />
        </div>
      </div>
    </div>
  )
}

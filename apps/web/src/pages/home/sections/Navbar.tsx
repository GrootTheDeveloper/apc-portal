import { Link, NavLink, useNavigate } from 'react-router-dom'

import { useScrolled } from '../hooks/useScrolled'
import { Button } from './Button'

// to: route nội bộ (NavLink) · href: liên kết trong trang/ngoài (thẻ a)
const NAV_LINKS = [
  { label: 'Giới thiệu', to: '/about' },
  { label: 'Hoạt động', href: '/#activities' },
  { label: 'Sự kiện', to: '/events' },
  { label: 'Tin tức', to: '/news' },
  { label: 'Dự án', to: '/projects' },
  { label: 'Gia nhập APC', to: '/recruitment' },
  { label: 'UMTOJ', href: '#', external: true },
  { label: 'Về APC', to: '/about' },
] as const

const linkBase = 'font-nav-link text-nav-link transition-colors flex items-center gap-1'
const linkIdle = `${linkBase} text-on-surface-variant hover:text-primary`
const linkActive = 'font-nav-link text-nav-link text-primary border-b-2 border-primary pb-1'

export function Navbar() {
  const scrolled = useScrolled(20)
  const navigate = useNavigate()

  return (
    <nav
      className={`bg-surface-container-lowest full-width top-0 sticky z-50 border-b border-outline-variant transition-all duration-300${scrolled ? ' nav-scrolled' : ''}`}
    >
      <div className="flex justify-between items-center w-full px-gutter py-4 max-w-container-max mx-auto">
        <Link className="flex items-center gap-2" to="/">
          <img alt="APC Logo" className="h-10 w-auto object-contain" src="/assets/home/00-apc-logo.png" />
        </Link>
        <div className="hidden md:flex items-center gap-6">
          {NAV_LINKS.map((link) =>
            'to' in link ? (
              <NavLink
                key={link.label}
                to={link.to}
                className={({ isActive }) => (isActive ? linkActive : linkIdle)}
              >
                {link.label}
              </NavLink>
            ) : (
              <a
                key={link.label}
                className={linkIdle}
                href={link.href}
                {...('external' in link && link.external
                  ? { target: '_blank', rel: 'noopener noreferrer' }
                  : {})}
              >
                {link.label}
                {'external' in link && link.external && (
                  <span className="material-symbols-outlined text-[16px]">open_in_new</span>
                )}
              </a>
            ),
          )}
        </div>
        <Button className="hidden md:inline-flex px-6 py-2 shadow-none" onClick={() => navigate('/login')}>
          Đăng nhập
        </Button>
        <button className="md:hidden text-on-surface" aria-label="Mở menu">
          <span className="material-symbols-outlined">menu</span>
        </button>
      </div>
    </nav>
  )
}

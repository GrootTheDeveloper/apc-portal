import { useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'

import { useScrolled } from '../hooks/useScrolled'
import { Button } from '../components/Button'

export const UMTOJ_URL = 'https://sot.umtoj.edu.vn'

// to: route nội bộ (NavLink) · href: liên kết trong trang/ngoài (thẻ a)
const NAV_LINKS = [
  { label: 'Giới thiệu', to: '/about' },
  { label: 'Hoạt động', href: '/#activities' },
  { label: 'Sự kiện', to: '/events' },
  { label: 'Tin tức', to: '/news' },
  { label: 'Dự án', to: '/projects' },
  { label: 'Gia nhập APC', to: '/recruitment' },
  { label: 'UMTOJ', href: UMTOJ_URL, external: true },
] as const

const linkBase = 'font-nav-link text-nav-link transition-colors flex items-center gap-1'
const linkIdle = `${linkBase} text-on-surface-variant hover:text-primary`
const linkActive = 'font-nav-link text-nav-link text-primary border-b-2 border-primary pb-1'

function NavItems({ onNavigate }: { onNavigate?: () => void }) {
  return NAV_LINKS.map((link) =>
    'to' in link ? (
      <NavLink
        key={link.label}
        to={link.to}
        onClick={onNavigate}
        className={({ isActive }) => (isActive ? linkActive : linkIdle)}
      >
        {link.label}
      </NavLink>
    ) : (
      <a
        key={link.label}
        className={linkIdle}
        href={link.href}
        onClick={onNavigate}
        {...('external' in link && link.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      >
        {link.label}
        {'external' in link && link.external && (
          <span className="material-symbols-outlined text-[16px]">open_in_new</span>
        )}
      </a>
    ),
  )
}

export function Navbar() {
  const scrolled = useScrolled(20)
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const closeMenu = () => setMenuOpen(false)

  return (
    <nav
      className={`bg-surface-container-lowest full-width top-0 sticky z-50 border-b border-outline-variant transition-all duration-300${scrolled ? ' nav-scrolled' : ''}`}
    >
      <div className="flex justify-between items-center w-full px-gutter py-4 max-w-container-max mx-auto">
        <Link className="flex items-center gap-2" to="/" onClick={closeMenu}>
          <img alt="APC Logo" className="h-10 w-auto object-contain" src="/assets/home/00-apc-logo.png" />
        </Link>
        <div className="hidden md:flex items-center gap-6">
          <NavItems />
        </div>
        <Button className="hidden md:inline-flex px-6 py-2 shadow-none" onClick={() => navigate('/login')}>
          Đăng nhập
        </Button>
        <button
          className="md:hidden text-on-surface"
          aria-label={menuOpen ? 'Đóng menu' : 'Mở menu'}
          aria-expanded={menuOpen}
          aria-controls="mobile-menu"
          onClick={() => setMenuOpen((open) => !open)}
        >
          <span className="material-symbols-outlined">{menuOpen ? 'close' : 'menu'}</span>
        </button>
      </div>
      {menuOpen && (
        <div id="mobile-menu" className="md:hidden flex flex-col items-start gap-4 px-gutter pb-6">
          <NavItems onNavigate={closeMenu} />
          <Button
            className="w-full px-6 py-2 shadow-none"
            onClick={() => {
              closeMenu()
              navigate('/login')
            }}
          >
            Đăng nhập
          </Button>
        </div>
      )}
    </nav>
  )
}

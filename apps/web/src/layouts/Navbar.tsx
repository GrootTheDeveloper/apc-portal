import { useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'

import { useAuth } from '../hooks/useAuth'
import { useScrolled } from '../hooks/useScrolled'
import { Button } from '../components/Button'
import { ADMIN_ROLES, hasAnyRole } from '../lib/auth'

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

/** Nút tài khoản: chưa đăng nhập → Đăng nhập; đã đăng nhập → Portal, Quản trị (chỉ vai trò quản trị), Đăng xuất. */
function AccountActions({ onNavigate, mobile = false }: { onNavigate?: () => void; mobile?: boolean }) {
  const { status, user, logout } = useAuth()
  const navigate = useNavigate()
  const size = mobile ? 'w-full px-6 py-2 shadow-none' : 'px-6 py-2 shadow-none'
  const go = (to: string) => {
    onNavigate?.()
    navigate(to)
  }

  if (status === 'loading') return null
  if (!user) {
    return (
      <Button className={size} onClick={() => go('/login')}>
        Đăng nhập
      </Button>
    )
  }
  return (
    <>
      {hasAnyRole(user, ADMIN_ROLES) && (
        <Button variant="outline" className={size} onClick={() => go('/admin')}>
          Quản trị
        </Button>
      )}
      <Button className={size} onClick={() => go('/portal')}>
        Portal
      </Button>
      <Button
        variant="outline"
        className={size}
        onClick={async () => {
          // Về trang công khai trước (FLOW-10), để route guard của trang đang mở không đẩy sang /login.
          go('/')
          await logout()
        }}
      >
        Đăng xuất
      </Button>
    </>
  )
}

export function Navbar() {
  const scrolled = useScrolled(20)
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
        <div className="hidden md:flex items-center gap-3">
          <AccountActions />
        </div>
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
          <div className="flex w-full flex-col gap-3">
            <AccountActions onNavigate={closeMenu} mobile />
          </div>
        </div>
      )}
    </nav>
  )
}

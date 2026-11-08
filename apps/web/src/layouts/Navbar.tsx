import { useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'

import { useAuth } from '../hooks/useAuth'
import { useNavScroll } from '../hooks/useNavScroll'
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

// Gạch chân ba màu logo chạy ra khi rê chuột, giữ nguyên ở trang đang mở.
const linkBase =
  "relative flex min-h-11 items-center gap-1 px-2 text-[16px] font-extrabold transition-colors after:absolute after:inset-x-2 after:bottom-1 after:h-[3px] after:origin-left after:scale-x-0 after:rounded-full after:bg-[linear-gradient(90deg,#C23B22_0_33%,#F0A202_33%_66%,#1568C9_66%)] after:transition-transform after:duration-300 after:content-[''] hover:after:scale-x-100 max-xl:min-h-14 max-xl:px-0 max-xl:font-display max-xl:text-[26px] max-xl:font-bold max-xl:after:inset-x-0"
const linkIdle = `${linkBase} text-ink hover:text-apc-red`
const linkActive = `${linkBase} text-apc-red after:scale-x-100`

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
          <span aria-hidden className="text-[14px]">
            ↗
          </span>
        )}
      </a>
    ),
  )
}

/** Nút tài khoản: chưa đăng nhập → Đăng nhập; đã đăng nhập → Portal, Quản trị (chỉ vai trò quản trị), Đăng xuất. */
function AccountActions({ onNavigate, mobile = false }: { onNavigate?: () => void; mobile?: boolean }) {
  const { status, user, logout } = useAuth()
  const navigate = useNavigate()
  const size = mobile ? 'w-full' : 'px-6'
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
  const { scrolled, down } = useNavScroll()
  const [menuOpen, setMenuOpen] = useState(false)
  const closeMenu = () => setMenuOpen(false)

  return (
    <nav
      className={`site-nav sticky top-0 z-50 bg-paper${scrolled ? ' nav-scrolled' : ''}${down && !menuOpen ? ' nav-up' : ''}`}
    >
      <div className="mx-auto flex h-[72px] w-full max-w-container-max items-center justify-between gap-6 px-4 md:px-8">
        <Link className="flex shrink-0 items-center" to="/" onClick={closeMenu}>
          <img alt="APC - Applied Programming Club" className="h-11 w-auto object-contain" src="/assets/home/00-apc-logo.png" />
        </Link>
        <div className="hidden items-center gap-1 xl:flex">
          <NavItems />
        </div>
        <div className="hidden items-center gap-2 xl:flex">
          <AccountActions />
        </div>
        <button
          className="grid h-12 w-12 place-items-center rounded-xl bg-apc-red text-paper shadow-[0_4px_0_#9A2A16] active:translate-y-1 active:shadow-none xl:hidden"
          aria-label={menuOpen ? 'Đóng menu' : 'Mở menu'}
          aria-expanded={menuOpen}
          aria-controls="mobile-menu"
          onClick={() => setMenuOpen((open) => !open)}
        >
          <span className="material-symbols-outlined">{menuOpen ? 'close' : 'menu'}</span>
        </button>
      </div>
      {menuOpen && (
        <div id="mobile-menu" className="flex flex-col items-start bg-paper px-4 pb-6 md:px-8 xl:hidden">
          <NavItems onNavigate={closeMenu} />
          <div className="mt-4 flex w-full flex-col gap-3">
            <AccountActions onNavigate={closeMenu} mobile />
          </div>
        </div>
      )}
    </nav>
  )
}

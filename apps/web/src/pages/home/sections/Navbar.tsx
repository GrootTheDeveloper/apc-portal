import { useScrolled } from '../hooks/useScrolled'
import { Button } from './Button'

const NAV_LINKS = [
  { label: 'Giới thiệu', active: true },
  { label: 'Hoạt động' },
  { label: 'Sự kiện' },
  { label: 'Tin tức' },
  { label: 'Dự án' },
  { label: 'Gia nhập APC' },
  { label: 'UMTOJ', external: true },
  { label: 'Về APC' },
]

export function Navbar() {
  const scrolled = useScrolled(20)

  return (
    <nav
      className={`bg-surface-container-lowest full-width top-0 sticky z-50 border-b border-outline-variant transition-all duration-300${scrolled ? ' nav-scrolled' : ''}`}
    >
      <div className="flex justify-between items-center w-full px-gutter py-4 max-w-container-max mx-auto">
        <a className="flex items-center gap-2" href="#">
          <img alt="APC Logo" className="h-10 w-auto object-contain" src="/assets/home/00-apc-logo.png" />
        </a>
        <div className="hidden md:flex items-center gap-6">
          {NAV_LINKS.map((link) => (
            <a
              key={link.label}
              className={
                link.active
                  ? 'font-nav-link text-nav-link text-primary border-b-2 border-primary pb-1'
                  : 'font-nav-link text-nav-link text-on-surface-variant hover:text-primary transition-colors flex items-center gap-1'
              }
              href="#"
            >
              {link.label}
              {link.external && <span className="material-symbols-outlined text-[16px]">open_in_new</span>}
            </a>
          ))}
        </div>
        <Button className="hidden md:inline-flex px-6 py-2 shadow-none">Đăng nhập</Button>
        <button className="md:hidden text-on-surface">
          <span className="material-symbols-outlined">menu</span>
        </button>
      </div>
    </nav>
  )
}

import { Link } from 'react-router-dom'

import { UMTOJ_URL } from './Navbar'

const CONTACT_EMAIL = 'apc@umt.edu.vn'

// to: route nội bộ (Link) · href: liên kết trong trang/ngoài (thẻ a). Theo docs/04-sitemap.md mục 5.1.
const FOOTER_COLUMNS = [
  {
    heading: 'Khám phá',
    links: [
      { label: 'Giới thiệu', to: '/about' },
      { label: 'Hoạt động', href: '/#activities' },
      { label: 'Sự kiện', to: '/events' },
      { label: 'Tin tức', to: '/news' },
    ],
  },
  {
    heading: 'Sản phẩm & Cơ hội',
    links: [
      { label: 'Dự án', to: '/projects' },
      { label: 'UMTOJ', href: UMTOJ_URL, external: true },
      { label: 'Gia nhập APC', to: '/recruitment' },
    ],
  },
  {
    heading: 'Thông tin',
    links: [
      { label: 'Tra cứu hồ sơ ứng tuyển', to: '/recruitment/application-lookup' },
      { label: 'Tra cứu đăng ký sự kiện', to: '/events/registration-lookup' },
      { label: 'Chính sách quyền riêng tư', to: '/privacy' },
      { label: 'Liên hệ', href: `mailto:${CONTACT_EMAIL}` },
    ],
  },
] as const

const linkClass =
  'text-sm text-white opacity-80 hover:opacity-100 hover:text-secondary-container transition-all flex items-center gap-1'

export function SiteFooter() {
  return (
    <footer className="bg-apc-dark text-secondary-fixed border-t border-white/10">
      {/* Dải accent màu brand */}
      <div className="h-1 w-full bg-gradient-to-r from-apc-red via-apc-gold to-apc-blue" />
      <div className="max-w-container-max mx-auto grid grid-cols-1 md:grid-cols-4 gap-8 py-12 px-gutter">
        <div className="col-span-1 md:col-span-1">
          <img alt="APC Logo White" className="h-12 w-auto mb-6 opacity-90" src="/assets/home/10-apc-logo-white.png" />
          <p className="text-sm opacity-70 mb-4 text-white">
            CLB Lập trình Ứng dụng UMT - Nơi kiến tạo những giá trị thực qua công nghệ.
          </p>
          <div className="flex flex-col gap-2 mb-4 text-sm text-white/70">
            <a className="flex items-center gap-2 hover:text-white transition-colors" href={`mailto:${CONTACT_EMAIL}`}>
              <span className="material-symbols-outlined text-[18px]">mail</span> {CONTACT_EMAIL}
            </a>
            <span className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px]">location_on</span> Phòng Lab Công Nghệ (Tầng 3), Tòa nhà UMT
            </span>
          </div>
        </div>
        {FOOTER_COLUMNS.map((column) => (
          <div key={column.heading}>
            <h4 className="font-bold text-white mb-4">{column.heading}</h4>
            <ul className="flex flex-col gap-2">
              {column.links.map((link) => (
                <li key={link.label}>
                  {'to' in link ? (
                    <Link className={linkClass} to={link.to}>
                      {link.label}
                    </Link>
                  ) : (
                    <a
                      className={linkClass}
                      href={link.href}
                      {...('external' in link ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                    >
                      {link.label}
                      {'external' in link && <span className="material-symbols-outlined text-[14px]">open_in_new</span>}
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="max-w-container-max mx-auto pb-12 px-gutter pt-8 border-t border-white/10 flex flex-col md:flex-row justify-between items-center gap-4 relative">
        <p className="text-xs text-white opacity-60">
          © {new Date().getFullYear()} Applied Programming Club - Khoa Công Nghệ – UMT
        </p>
        <img
          alt="APC Symbol"
          className="absolute right-0 bottom-0 h-32 opacity-5 pointer-events-none"
          src="/assets/home/08-image-08.png"
        />
      </div>
    </footer>
  )
}

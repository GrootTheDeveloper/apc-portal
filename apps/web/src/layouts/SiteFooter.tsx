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
const MARK_PIECES = ['/assets/home/mark/mark-red.png', '/assets/home/mark/mark-gold.png', '/assets/home/mark/mark-blue.png']

const linkClass =
  'inline-flex min-h-10 items-center gap-1 text-[16px] text-paper/75 transition-colors hover:text-apc-gold-soft'

export function SiteFooter() {
  return (
    <footer className="site-footer relative flex flex-col overflow-hidden bg-ink text-paper">
      {/* Logo màu thật phóng to, cắt tràn góc phải; rê chuột thì ba mảnh tách ra */}
      <div
        aria-hidden
        className="mark-stack spread absolute bottom-[-12vh] right-[max(16px,calc((100vw-1520px)/2+32px))] hidden w-[min(64vh,600px)] lg:block"
      >
        {MARK_PIECES.map((src) => (
          <img key={src} alt="" loading="lazy" src={src} />
        ))}
      </div>

      <div className="relative mx-auto flex w-full max-w-container-max flex-1 flex-col px-4 pb-8 pt-16 md:px-8 lg:pr-[calc(min(64vh,600px)+64px)] lg:pt-[clamp(48px,10vh,112px)]">
        <p className="font-code text-[15px] font-bold text-apc-gold-soft">
          <span aria-hidden className="opacity-70">
            {'// '}
          </span>
          hẹn gặp ở Lab Công Nghệ, tầng 3
        </p>
        <p className="mt-3 font-display text-[clamp(36px,min(5.6vw,10vh),100px)] font-extrabold leading-[0.95] tracking-[-0.03em]">
          Có ý tưởng? <span className="block text-apc-gold">Code cùng tụi mình.</span>
        </p>
        <a
          className="group mt-6 inline-flex items-center gap-3 font-display text-[clamp(22px,2.2vw,32px)] font-bold underline decoration-apc-red decoration-[3px] underline-offset-[6px] hover:text-apc-gold-soft"
          href={`mailto:${CONTACT_EMAIL}`}
        >
          {CONTACT_EMAIL}
          <span aria-hidden className="transition-transform group-hover:translate-x-1.5">
            →
          </span>
        </a>

        <div className="mt-12 grid grid-cols-2 gap-x-6 gap-y-8 border-t border-paper/15 pt-8 sm:grid-cols-3 lg:mt-auto">
          {FOOTER_COLUMNS.map((column) => (
            <div key={column.heading}>
              <h2 className="font-code text-[14px] font-bold text-paper/55">{column.heading}</h2>
              <ul className="mt-2 flex flex-col">
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
                        {'external' in link && <span aria-hidden>↗</span>}
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-10 flex flex-col gap-2 text-[14px] text-paper/60 md:flex-row md:flex-wrap md:items-center md:justify-between md:gap-x-8">
          <p>
            © {new Date().getFullYear()} Applied Programming Club · Khoa Công Nghệ, Trường Đại học Quản lý và Công nghệ
            TP.HCM (UMT)
          </p>
          <a className="font-bold text-paper/80 hover:text-apc-gold-soft" href="#top">
            ↑ Lên đầu trang
          </a>
        </div>
      </div>

      {/* Dải ba màu logo chốt cuối trang, motif cũ của APC */}
      <div aria-hidden className="relative flex h-2">
        <span className="flex-1 bg-apc-red" />
        <span className="flex-1 bg-apc-gold" />
        <span className="flex-1 bg-apc-blue" />
      </div>
    </footer>
  )
}

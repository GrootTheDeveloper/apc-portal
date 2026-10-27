import type { CSSProperties, ReactNode } from 'react'

// Mảng màu đặc tràn viền; chữ comment và chữ nhấn đổi theo nền để luôn đọc rõ (DESIGN.md mục Colors).
const TONES = {
  ink: { field: 'bg-ink text-paper', comment: 'text-apc-gold-soft' },
  red: { field: 'bg-apc-red text-paper', comment: 'text-paper/85' },
  blue: { field: 'bg-apc-blue text-paper', comment: 'text-paper/85' },
  gold: { field: 'bg-apc-gold text-ink', comment: 'text-ink/75' },
} as const

export type PageHeroTone = keyof typeof TONES

type PageHeroProps = {
  /** dòng comment phía trên tiêu đề, viết thường, không cần `// ` */
  comment: string
  title: ReactNode
  lede?: ReactNode
  tone?: PageHeroTone
  /** hàng phía trên comment (breadcrumb) */
  top?: ReactNode
  /** cột phải trên màn rộng (nút, bộ chọn chế độ xem...) */
  aside?: ReactNode
  /** nội dung thêm dưới lede (meta, nút) */
  children?: ReactNode
  /** tiêu đề nhỏ hơn cho trang chi tiết (tên bài/sự kiện thường dài) */
  compact?: boolean
}

const delay = (ms: number) => ({ '--d': `${ms}ms` }) as CSSProperties

/** Đầu trang con: một mảng màu đặc, comment `//`, tiêu đề Baloo lớn và một câu dẫn. */
export function PageHero({ comment, title, lede, tone = 'ink', top, aside, children, compact = false }: PageHeroProps) {
  const colors = TONES[tone]
  return (
    <section className={`px-4 pb-[clamp(40px,7vh,80px)] pt-[clamp(32px,6vh,72px)] md:px-8 ${colors.field}`}>
      <div className="mx-auto w-full max-w-container-max">
        {top && <div className="mb-[clamp(24px,5vh,48px)]">{top}</div>}
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div className="min-w-0">
            <p data-rv className={`font-code text-[16px] font-bold ${colors.comment}`}>
              <span aria-hidden className="opacity-70">
                {'// '}
              </span>
              {comment}
            </p>
            <h1
              data-rv
              className={`mt-3 font-display font-extrabold tracking-[-0.035em] ${
                compact ? 'max-w-[26ch] text-[clamp(34px,min(4.2vw,8vh),64px)] leading-[1.02]' : 'max-w-[18ch] text-[clamp(40px,min(6vw,11vh),96px)] leading-[0.95]'
              }`}
              style={delay(60)}
            >
              {title}
            </h1>
            {lede && (
              <p data-rv className="mt-5 max-w-[56ch] text-[clamp(17px,1.4vw,20px)] leading-relaxed opacity-90" style={delay(120)}>
                {lede}
              </p>
            )}
            {children && (
              <div data-rv style={delay(180)}>
                {children}
              </div>
            )}
          </div>
          {aside && (
            <div data-rv className="min-w-0" style={delay(200)}>
              {aside}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

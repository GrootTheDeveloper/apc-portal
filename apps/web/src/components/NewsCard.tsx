import { Link } from 'react-router-dom'

import { formatDate } from '../lib/format'
import type { NewsItem } from '../pages/news/list/mock'

// Mỗi chuyên mục một sắc nhạt của màu logo; lưới nhiều bài nên dùng nền nhạt cho dịu mắt (class literal để Tailwind JIT nhận diện).
const CATEGORY_FIELDS: Record<string, { field: string; label: string }> = {
  'Chuyên môn': { field: 'bg-apc-blue-pale text-apc-blue', label: 'text-apc-blue' },
  'Thông báo': { field: 'bg-apc-gold-pale text-apc-gold-deep', label: 'text-apc-gold-deep' },
  'Chia sẻ': { field: 'bg-apc-red-pale text-apc-red', label: 'text-apc-red' },
}
const FALLBACK_FIELD = { field: 'bg-soft text-muted', label: 'text-muted' }

/** Card bài viết: ảnh bìa (chưa có thì mảng màu theo chuyên mục), chuyên mục, tiêu đề, tác giả. */
export function NewsCard({ item }: { item: NewsItem }) {
  const colors = CATEGORY_FIELDS[item.category] ?? FALLBACK_FIELD

  return (
    <Link to={`/news/${item.slug}`} className="group flex min-w-0 flex-col">
      {item.coverUrl ? (
        <div className="photo aspect-[16/10] bg-soft">
          <img alt="" className="h-full" loading="lazy" src={item.coverUrl} />
        </div>
      ) : (
        <div className={`grid aspect-[16/10] place-items-center rounded-[20px] ${colors.field}`}>
          <span aria-hidden className="material-symbols-outlined text-[72px] transition-transform duration-500 group-hover:scale-110">
            {item.icon}
          </span>
        </div>
      )}

      <p className="mt-4 flex items-center justify-between gap-3 font-code text-[13px] font-bold">
        <span className={colors.label}>{item.category}</span>
        {item.publishedAt && <span className="text-muted">{formatDate(item.publishedAt)}</span>}
      </p>
      <h3 className="mt-1 line-clamp-2 font-display text-[22px] font-bold leading-[1.15] transition-colors group-hover:text-apc-red">
        {item.title}
      </h3>
      <p className="mt-2 line-clamp-2 text-[15px] leading-relaxed text-muted">{item.excerpt}</p>

      <div className="mt-auto flex items-center gap-3 pt-4">
        <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-[12px] font-extrabold ${item.author.avatarClass}`}>
          {item.author.initials}
        </span>
        <span className="text-[13px] leading-tight">
          <b className="block">{item.author.name}</b>
          <span className="text-muted">{item.author.role}</span>
        </span>
      </div>
    </Link>
  )
}

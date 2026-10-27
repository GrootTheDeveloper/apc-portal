import { Link } from 'react-router-dom'

import { newsCategoryStyle, type NewsItem } from '../lib/content'
import { formatDate } from '../lib/format'

/** Card bài viết: ảnh bìa (chưa có thì mảng màu theo chuyên mục), chuyên mục, ngày, tiêu đề, tóm tắt. */
export function NewsCard({ item }: { item: NewsItem }) {
  const style = newsCategoryStyle(item.category)

  return (
    <Link to={`/news/${item.slug}`} className="group flex min-w-0 flex-col">
      {item.thumbnailUrl ? (
        <div className="photo aspect-[16/10] bg-soft">
          <img alt="" className="h-full" loading="lazy" src={item.thumbnailUrl} />
        </div>
      ) : (
        <div className={`grid aspect-[16/10] place-items-center rounded-[20px] ${style.field}`}>
          <span aria-hidden className="material-symbols-outlined text-[72px] transition-transform duration-500 group-hover:scale-110">
            {style.icon}
          </span>
        </div>
      )}

      <p className="mt-4 flex items-center justify-between gap-3 font-code text-[13px] font-bold">
        <span className={style.label}>{item.category}</span>
        {item.publishedAt && <span className="text-muted">{formatDate(item.publishedAt)}</span>}
      </p>
      <h3 className="mt-1 line-clamp-2 font-display text-[22px] font-bold leading-[1.15] transition-colors group-hover:text-apc-red">
        {item.title}
      </h3>
      <p className="mt-2 line-clamp-2 text-[15px] leading-relaxed text-muted">{item.summary}</p>
    </Link>
  )
}

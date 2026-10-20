import { Link } from 'react-router-dom'

import {
  getNewsCategoryChipClass,
  getNewsCategoryVisual,
  type NewsItem,
} from '../lib/content'
import { formatDate } from '../lib/format'

type NewsCardProps = {
  item: NewsItem
}

/** Card hiển thị bài viết tin tức, giữ nguyên phong cách visual từ NewsSection */
export function NewsCard({ item }: NewsCardProps) {
  const chipClass = getNewsCategoryChipClass(item.category)
  const visual = getNewsCategoryVisual(item.category)
  const formattedDate = item.publishedAt ? formatDate(item.publishedAt) : ''
  const imageUrl = item.thumbnailUrl || item.coverUrl
  const summaryText = item.summary || item.excerpt || ''

  return (
    <Link
      to={`/news/${item.slug}`}
      className="group bg-white rounded-2xl overflow-hidden shadow-sm border border-outline-variant/20 flex flex-col hover:shadow-md hover:-translate-y-1 transition-all duration-300 cursor-pointer"
    >
      {imageUrl ? (
        <div className="aspect-[16/10] overflow-hidden">
          <img src={imageUrl} alt={item.title} className="w-full h-full object-cover" />
        </div>
      ) : (
        <div className={`aspect-[16/10] flex items-center justify-center bg-gradient-to-br ${visual.coverClass}`}>
          <span className={`material-symbols-outlined text-5xl ${visual.iconClass}`}>{visual.icon}</span>
        </div>
      )}

      <div className="p-6 flex flex-col gap-3 flex-1">
        <div className="flex items-center justify-between">
          <span className={`px-3 py-1 rounded-full text-xs font-bold ${chipClass}`}>{item.category}</span>
          <span className="text-on-surface-variant text-xs">{formattedDate}</span>
        </div>

        <h3 className="font-bold text-lg text-on-surface leading-tight group-hover:text-apc-blue transition-colors">
          {item.title}
        </h3>

        <p className="text-on-surface-variant text-sm line-clamp-2 flex-1">{summaryText}</p>

        <div className="pt-4 border-t border-outline-variant/20 flex items-center gap-3">
          <div className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs bg-apc-blue text-white">
            APC
          </div>
          <div className="text-xs">
            <p className="font-bold text-on-surface">CLB APC</p>
            <p className="text-on-surface-variant">Ban Chuyên môn</p>
          </div>
        </div>
      </div>
    </Link>
  )
}

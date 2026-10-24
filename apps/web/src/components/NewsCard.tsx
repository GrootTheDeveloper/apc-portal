import { Link } from 'react-router-dom'

import { formatDate } from '../lib/format'
import type { NewsItem } from '../pages/news/list/mock'

function getCategoryChipClass(category: string): string {
  switch (category) {
    case 'Chuyên môn':
      return 'bg-apc-blue/10 text-apc-blue'
    case 'Thông báo':
      return 'bg-apc-gold/10 text-apc-gold'
    case 'Chia sẻ':
      return 'bg-apc-red/10 text-apc-red'
    default:
      return 'bg-surface-container-highest text-on-surface-variant'
  }
}

type NewsCardProps = {
  item: NewsItem
}

/** Card hiển thị bài viết tin tức, giữ nguyên visual style từ NewsSection */
export function NewsCard({ item }: NewsCardProps) {
  const chipClass = getCategoryChipClass(item.category)
  const formattedDate = item.publishedAt ? formatDate(item.publishedAt) : ''

  return (
    <Link
      to={`/news/${item.slug}`}
      className="group bg-white rounded-2xl overflow-hidden shadow-sm border border-outline-variant/20 flex flex-col hover:shadow-md hover:-translate-y-1 transition-all duration-300 cursor-pointer"
    >
      {item.coverUrl ? (
        <div className="aspect-[16/10] overflow-hidden">
          <img src={item.coverUrl} alt={item.title} className="w-full h-full object-cover" />
        </div>
      ) : (
        <div className={`aspect-[16/10] flex items-center justify-center bg-gradient-to-br ${item.coverClass}`}>
          <span className={`material-symbols-outlined text-5xl ${item.iconClass}`}>{item.icon}</span>
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

        <p className="text-on-surface-variant text-sm line-clamp-2 flex-1">{item.excerpt}</p>

        <div className="pt-4 border-t border-outline-variant/20 flex items-center gap-3">
          <div
            className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs ${item.author.avatarClass}`}
          >
            {item.author.initials}
          </div>
          <div className="text-xs">
            <p className="font-bold text-on-surface">{item.author.name}</p>
            <p className="text-on-surface-variant">{item.author.role}</p>
          </div>
        </div>
      </div>
    </Link>
  )
}

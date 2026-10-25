import { Link } from 'react-router-dom'

import { Eyebrow } from '../../../components/Eyebrow'
import { NewsCard } from '../../../components/NewsCard'
import { useApi } from '../../../hooks/useApi'
import type { Page } from '../../../lib/api'
import type { NewsItem } from '../../../lib/content'

export function NewsSection() {
  const { data, loading, error } = useApi<Page<NewsItem>>('/public/news?page=1&pageSize=3')

  // Nếu đang tải, lỗi, hoặc danh sách rỗng: ẩn toàn bộ khối, không để khoảng trống (FLOW-01)
  if (loading || error || !data?.items || data.items.length === 0) {
    return null
  }

  const items = data.items.slice(0, 3)

  return (
    <section className="w-full min-h-0 py-12 px-gutter bg-white border-t border-outline-variant/20">
      <div className="max-w-container-max mx-auto fade-up w-full">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-12 border-b border-outline-variant/20 pb-6">
          <div>
            <Eyebrow className="text-apc-blue mb-2">BLOG</Eyebrow>
            <h2 className="font-headline-md text-[32px] font-bold text-on-surface">Tin tức &amp; Cập nhật</h2>
          </div>
          <Link
            className="text-apc-blue font-medium flex items-center gap-1 hover:underline text-sm mt-4 md:mt-0"
            to="/news"
          >
            Đọc thêm trên Blog <span className="material-symbols-outlined text-sm">arrow_forward</span>
          </Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {items.map((item) => (
            <NewsCard key={item.slug} item={item} />
          ))}
        </div>
      </div>
    </section>
  )
}

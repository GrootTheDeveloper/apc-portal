import type { CSSProperties } from 'react'
import { Link } from 'react-router-dom'

import { useApi } from '../../../hooks/useApi'
import type { Page } from '../../../lib/api'
import { newsCategoryStyle, type NewsItem } from '../../../lib/content'
import { formatDate } from '../../../lib/format'

const delay = (ms: number) => ({ '--d': `${ms}ms` }) as CSSProperties

export function NewsSection() {
  const { data } = useApi<Page<NewsItem>>('/public/news?page=1&pageSize=3')
  const news = data?.items ?? []

  // Đang tải, lỗi hoặc chưa có bài công bố: ẩn cả khối, không để khoảng trống (FLOW-01)
  if (news.length === 0) return null

  return (
    <section className="screen flex items-center bg-paper px-4 py-[clamp(40px,8vh,96px)] md:px-8">
      <div className="mx-auto grid w-full max-w-container-max gap-12 lg:grid-cols-[0.75fr_1.25fr] lg:gap-20">
        <div>
          <p data-rv className="font-code text-[16px] font-bold text-apc-blue">
            <span aria-hidden className="opacity-60">
              {'$ '}
            </span>
            git log news/
          </p>
          <h2
            data-rv
            className="mt-3 font-display text-[clamp(40px,min(4.8vw,8vh),76px)] font-extrabold leading-[0.95] tracking-[-0.03em] text-apc-red"
            style={delay(60)}
          >
            Tin mới từ APC
          </h2>
          <p data-rv className="mt-5 max-w-[36ch] text-[18px] leading-relaxed" style={delay(120)}>
            Thông báo của CLB, bài chuyên môn và chia sẻ từ thành viên, mới nhất ở trên cùng.
          </p>
          <Link
            data-rv
            className="mt-6 inline-flex min-h-12 items-center text-[17px] font-extrabold text-apc-red underline decoration-2 underline-offset-4 hover:text-apc-red-deep"
            style={delay(180)}
            to="/news"
          >
            Đọc thêm tin tức →
          </Link>
        </div>

        <ol className="git-log relative">
            {news.map((item, index) => {
              const color = newsCategoryStyle(item.category)
              const head = index === 0
              return (
                <li key={item.slug} data-rv className="relative pb-[clamp(20px,4.5vh,40px)] pl-12 last:pb-0" style={delay(160 + index * 100)}>
                  <span aria-hidden className={`git-dot absolute left-[5px] top-[6px] h-[18px] w-[18px] rounded-full ring-[5px] ring-paper ${color.dot}`} />
                  <article className="group relative">
                    <p className="flex flex-wrap items-center gap-x-3 gap-y-1 font-code text-[14px] font-bold">
                      {item.publishedAt && <span className="text-muted">{formatDate(item.publishedAt)}</span>}
                      <span className={color.label}>{item.category}</span>
                      {head && <span className="rounded-md bg-apc-gold px-2 py-0.5 text-ink">HEAD → main</span>}
                    </p>
                    <h3
                      className={`mt-2 font-display font-bold leading-[1.1] transition-colors group-hover:text-apc-red ${
                        head ? 'text-[clamp(28px,3vw,44px)]' : 'text-[clamp(21px,1.9vw,28px)]'
                      }`}
                    >
                      <Link className="after:absolute after:inset-0 after:content-['']" to={`/news/${item.slug}`}>
                        {item.title}
                      </Link>
                      <span aria-hidden className="git-arrow ml-2 inline-block text-apc-red">
                        →
                      </span>
                    </h3>
                    {head && <p className="mt-3 max-w-[56ch] text-[18px] leading-relaxed">{item.summary}</p>}
                  </article>
                </li>
              )
            })}
        </ol>
      </div>
    </section>
  )
}

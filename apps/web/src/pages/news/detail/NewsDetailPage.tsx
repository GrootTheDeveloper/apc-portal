import { Link, useParams } from 'react-router-dom'

import { AsyncState } from '../../../components/AsyncState'
import { Breadcrumb } from '../../../components/Breadcrumb'
import { PageHero } from '../../../components/PageHero'
import { useMockApi } from '../../../hooks/useMockApi'
import { formatDate } from '../../../lib/format'
import { NotFound } from '../../NotFound'
import { getNewsDetail, type NewsItem } from '../list/mock'

/** Trang chi tiết tin tức */
export function NewsDetailPage() {
  const { slug } = useParams<{ slug: string }>()

  const { data: item, loading, error, reload } = useMockApi<NewsItem | null>(
    () => (slug ? getNewsDetail(slug) : Promise.resolve(null)),
    [slug],
  )

  if (!slug) {
    return <NotFound />
  }

  // Nếu không tải và không có lỗi nhưng không tìm thấy bài viết
  if (!loading && !error && item === null) {
    return <NotFound />
  }

  return (
    <main>
      <AsyncState loading={loading} error={error} empty={false} onRetry={reload}>
        {item && (
          <article>
            <PageHero
              tone="gold"
              top={
                <Breadcrumb
                  items={[
                    { label: 'trang chủ', to: '/' },
                    { label: 'tin tức', to: '/news' },
                    { label: item.title },
                  ]}
                />
              }
              compact
              comment={item.category.toLowerCase()}
              title={item.title}
              lede={item.excerpt}
            >
              <div className="mt-8 flex items-center gap-3">
                <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-full text-[13px] font-extrabold ${item.author.avatarClass}`}>
                  {item.author.initials}
                </span>
                <span className="text-[15px] leading-tight">
                  <b className="block">{item.author.name}</b>
                  <span className="font-code text-[13px] font-bold opacity-75">
                    {item.author.role} · {formatDate(item.publishedAt)}
                  </span>
                </span>
              </div>
            </PageHero>

            <section className="px-4 py-[clamp(40px,7vh,80px)] md:px-8">
              <div className="mx-auto w-full max-w-[760px]">
                {item.coverUrl && (
                  <div data-rv className="photo mb-10 aspect-[16/9] bg-soft">
                    <img alt="" className="h-full" src={item.coverUrl} />
                  </div>
                )}
                <div className="flex flex-col gap-5 text-[18px] leading-relaxed">
                  {item.content.split('\n\n').map((paragraph, index) => (
                    <p key={index}>{paragraph}</p>
                  ))}
                </div>
                <div className="mt-12 border-t-2 border-ink pt-6">
                  <Link to="/news" className="inline-flex min-h-12 items-center text-[17px] font-extrabold text-apc-red underline decoration-2 underline-offset-4">
                    ← Về danh sách tin tức
                  </Link>
                </div>
              </div>
            </section>
          </article>
        )}
      </AsyncState>
    </main>
  )
}

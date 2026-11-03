import { Link, useLocation, useParams } from 'react-router-dom'

import { AsyncState } from '../../../components/AsyncState'
import { Breadcrumb } from '../../../components/Breadcrumb'
import { PageHero } from '../../../components/PageHero'
import { Seo } from '../../../components/Seo'
import { useApi } from '../../../hooks/useApi'
import type { NewsDetailItem } from '../../../lib/content'
import { formatDate } from '../../../lib/format'
import { NotFound } from '../../NotFound'

/** Trang chi tiết tin tức */
export function NewsDetailPage() {
  const { slug } = useParams<{ slug: string }>()
  const location = useLocation()
  const backTo = (location.state as { from?: string } | null)?.from ?? '/news'
  const { data: item, loading, error, reload } = useApi<NewsDetailItem>(slug ? `/public/news/${slug}` : null)

  // Bài không tồn tại, nháp, lưu trữ hay nội bộ đều trả 404 (docs/02 §12)
  if (!slug || error?.status === 404) {
    return <NotFound />
  }

  return (
    <main>
      <AsyncState loading={loading} error={error} empty={false} onRetry={reload}>
        {item && (
          <article>
            {/* metaTitle/metaDescription để trống thì dùng tiêu đề/tóm tắt */}
            <Seo
              title={item.metaTitle || item.title}
              description={item.metaDescription || item.summary}
              path={`/news/${slug}`}
              imageUrl={item.thumbnailUrl}
            />
            <PageHero
              tone="gold"
              top={
                <Breadcrumb
                  items={[
                    { label: 'trang chủ', to: '/' },
                    { label: 'tin tức', to: backTo },
                    { label: item.title },
                  ]}
                />
              }
              compact
              comment={item.category.toLowerCase()}
              title={item.title}
              lede={item.summary}
            >
              {item.publishedAt && <p className="mt-6 font-code text-[14px] font-bold opacity-75">{formatDate(item.publishedAt)}</p>}
            </PageHero>

            <section className="px-4 py-[clamp(40px,7vh,80px)] md:px-8">
              <div className="mx-auto w-full max-w-[760px]">
                {item.thumbnailUrl && (
                  <div data-rv className="photo mb-10 aspect-[16/9] bg-soft">
                    <img alt="" className="h-full" src={item.thumbnailUrl} />
                  </div>
                )}
                {/* Tách đoạn theo dòng trống, giữ xuống dòng trong đoạn */}
                <div className="flex flex-col gap-5 text-[18px] leading-relaxed">
                  {item.content.split('\n\n').map((paragraph, index) => (
                    <p key={index} className="whitespace-pre-line">
                      {paragraph}
                    </p>
                  ))}
                </div>
                <div className="mt-12 border-t-2 border-ink pt-6">
                  <Link to={backTo} className="inline-flex min-h-12 items-center text-[17px] font-extrabold text-apc-red underline decoration-2 underline-offset-4">
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

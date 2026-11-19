import { Link, useParams } from 'react-router-dom'

import { AsyncState } from '../../../../components/AsyncState'
import { Breadcrumb } from '../../../../components/Breadcrumb'
import { Seo } from '../../../../components/Seo'
import { useApi } from '../../../../hooks/useApi'
import { newsCategoryStyle } from '../../../../lib/content'
import { formatDate } from '../../../../lib/format'
import { NotFound } from '../../../NotFound'
import { fileSrc, type PortalAnnouncementDetail } from '../types'

/** Chi tiết thông báo nội bộ trong portal (C5). Bài không thuộc phạm vi người dùng thì API trả 404 (docs/02 §12). */
export function PortalAnnouncementDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { data: item, loading, error, reload } = useApi<PortalAnnouncementDetail>(
    id ? `/portal/announcements/${id}` : null,
  )

  if (!id || error?.status === 404) {
    return <NotFound compact home="/portal/announcements" />
  }

  const thumbnail = fileSrc(item?.thumbnailUrl ?? null)

  return (
    <main>
      <AsyncState loading={loading} error={error} empty={false} onRetry={reload}>
        {item && (
          <article>
            <Seo title={item.title} robots="noindex, nofollow" path={`/portal/announcements/${id}`} />
            <Breadcrumb
              items={[
                { label: 'Portal', to: '/portal' },
                { label: 'thông báo', to: '/portal/announcements' },
                { label: item.title },
              ]}
            />
            <p className="mt-6 flex flex-wrap items-center gap-3 font-code text-[14px] font-bold">
              <span className={`rounded-md px-2 py-1 ${newsCategoryStyle(item.category).field}`}>{item.category}</span>
              {item.publishedAt && <span className="text-muted">{formatDate(item.publishedAt)}</span>}
            </p>
            <h1 className="mt-3 font-display text-[clamp(30px,3.6vw,48px)] font-extrabold leading-none tracking-[-0.03em]">
              {item.title}
            </h1>
            <p className="mt-5 max-w-[68ch] text-[18px] leading-relaxed text-muted">{item.summary}</p>

            <section className="mt-10 max-w-[760px]">
              {thumbnail && (
                <div data-rv className="photo aspect-[16/9] bg-soft">
                  <img alt="" className="h-full" src={thumbnail} />
                </div>
              )}
              {/* Tách đoạn theo dòng trống; giữ nguyên văn bản, không render HTML (chống XSS). */}
              <div className="mt-10 flex flex-col gap-5 text-[18px] leading-relaxed">
                {item.content.split('\n\n').map((paragraph, index) => (
                  <p key={index} className="whitespace-pre-line">
                    {paragraph}
                  </p>
                ))}
              </div>
              <div className="mt-12 border-t-2 border-ink pt-6">
                <Link
                  to="/portal/announcements"
                  className="inline-flex min-h-12 items-center text-[17px] font-extrabold text-apc-red underline decoration-2 underline-offset-4"
                >
                  ← Quay lại danh sách thông báo
                </Link>
              </div>
            </section>
          </article>
        )}
      </AsyncState>
    </main>
  )
}

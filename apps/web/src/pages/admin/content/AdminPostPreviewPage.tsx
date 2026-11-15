import { Link, useParams } from 'react-router-dom'

import { AsyncState } from '../../../components/AsyncState'
import { buttonClass } from '../../../components/buttonClass'
import { PageHero } from '../../../components/PageHero'
import { Seo } from '../../../components/Seo'
import { useApi } from '../../../hooks/useApi'
import { formatDate } from '../../../lib/format'
import { type AdminPostDetail, STATUS_LABEL, fileSrc, statusBadgeClass } from './postTypes'

/**
 * PAGE-MGT-CMS-04 — xem trước bài viết (C3): dựng lại đúng bố cục trang tin công khai
 * (`pages/news/detail/NewsDetailPage.tsx`) nhưng cần đăng nhập và gắn `noindex, nofollow` (Sitemap §16).
 */
export function AdminPostPreviewPage() {
  const { id } = useParams<{ id: string }>()
  const post = useApi<AdminPostDetail>(id ? `/admin/content/posts/${id}` : null)
  const detail = post.data
  const thumbnail = detail ? fileSrc(detail.thumbnailUrl) : null

  const note = !detail
    ? 'Đang tải bản xem trước…'
    : detail.status === 'ARCHIVED'
      ? 'Bài đã lưu trữ: không còn hiển thị ở bất kỳ đâu. Đây là bản xem trước dành cho người quản trị.'
      : detail.status === 'DRAFT'
        ? `Bạn đang xem trước bản nháp${detail.scope === 'INTERNAL' ? ' nội bộ' : ''} — bài chưa công bố nên khách không thấy được.`
        : detail.scope === 'INTERNAL'
          ? 'Bạn đang xem trước thông báo nội bộ — chỉ thành viên đăng nhập thấy trong portal, không hiện trên website.'
          : 'Bạn đang xem trước tin công khai. Đây là trang quản trị, không phải /news.'

  return (
    <main>
      <div className="sticky top-0 z-30 flex flex-wrap items-center justify-between gap-3 border-b-2 border-ink bg-apc-gold-pale px-5 py-3">
        <p className="flex min-w-0 flex-col gap-1 text-[15px] font-bold text-ink">
          <span className="font-code text-[13px] font-bold uppercase text-apc-red">
            <span aria-hidden>{'// '}</span>chế độ xem trước
          </span>
          {note}
          <span className="font-body text-[14px] font-semibold text-muted">
            Trang này gắn thẻ noindex nên công cụ tìm kiếm không lập chỉ mục.
          </span>
        </p>
        <span className="flex shrink-0 flex-wrap items-center gap-3">
          {detail && <span className={statusBadgeClass(detail.status)}>{STATUS_LABEL[detail.status]}</span>}
          <Link to={`/admin/content/posts/${id}`} className={buttonClass('outline')}>
            Sửa bài
          </Link>
          <Link to="/admin/content/posts" className={buttonClass('light')}>
            Về danh sách
          </Link>
        </span>
      </div>

      <AsyncState
        loading={post.loading}
        error={post.error}
        empty={!detail}
        emptyText="Không tìm thấy bài viết để xem trước."
        onRetry={post.reload}
      >
        {detail && (
          <article>
            {/* metaTitle/metaDescription để trống thì dùng tiêu đề/tóm tắt, giống trang công khai */}
            <Seo
              title={detail.metaTitle || detail.title}
              description={detail.metaDescription || detail.summary}
              path={`/admin/content/posts/${detail.id}/preview`}
              imageUrl={thumbnail}
              robots="noindex, nofollow"
            />
            <PageHero
              tone="gold"
              compact
              comment={detail.category.toLowerCase()}
              title={detail.title}
              lede={detail.summary}
            >
              <p className="mt-6 font-code text-[14px] font-bold opacity-75">
                {detail.publishedAt ? formatDate(detail.publishedAt) : 'chưa công bố'}
              </p>
            </PageHero>

            <section className="py-[clamp(40px,7vh,80px)]">
              <div className="mx-auto w-full max-w-[760px]">
                {thumbnail && (
                  <div data-rv className="photo mb-10 aspect-[16/9] bg-soft">
                    <img alt="" className="h-full" src={thumbnail} />
                  </div>
                )}
                {/* Tách đoạn theo dòng trống, giữ xuống dòng trong đoạn; văn bản thuần nên không render HTML */}
                <div className="flex flex-col gap-5 text-[18px] leading-relaxed">
                  {detail.content.split('\n\n').map((paragraph, index) => (
                    <p key={index} className="whitespace-pre-line">
                      {paragraph}
                    </p>
                  ))}
                </div>
              </div>
            </section>
          </article>
        )}
      </AsyncState>
    </main>
  )
}

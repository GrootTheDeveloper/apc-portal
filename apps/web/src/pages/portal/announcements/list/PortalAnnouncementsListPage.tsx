import { Link, useSearchParams } from 'react-router-dom'

import { AsyncState } from '../../../../components/AsyncState'
import { Pagination } from '../../../../components/Pagination'
import { Seo } from '../../../../components/Seo'
import { useApi } from '../../../../hooks/useApi'
import type { Page } from '../../../../lib/api'
import { newsCategoryStyle } from '../../../../lib/content'
import { formatDate } from '../../../../lib/format'
import { fileSrc, type PortalAnnouncementItem } from '../types'

const PAGE_SIZE = 12

/** PAGE-MEM-06 — danh sách thông báo nội bộ thành viên được xem (C5): chỉ bài PUBLISHED + INTERNAL khớp đối tượng nhận. */
export function PortalAnnouncementsListPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const page = Math.max(1, Number(searchParams.get('page')) || 1)

  const updateParams = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(searchParams)
    for (const [key, value] of Object.entries(changes)) {
      if (value === null || value === '') next.delete(key)
      else next.set(key, value)
    }
    setSearchParams(next)
  }

  const query = new URLSearchParams()
  query.set('page', String(page))
  query.set('pageSize', String(PAGE_SIZE))
  const announcements = useApi<Page<PortalAnnouncementItem>>(`/portal/announcements?${query}`)

  const items = announcements.data?.items ?? []
  const total = announcements.data?.total ?? 0
  const listEmpty = !announcements.loading && !announcements.error && items.length === 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const firstItem = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const lastItem = Math.min(total, page * PAGE_SIZE)

  return (
    <main>
      <Seo title="Thông báo nội bộ — APC Portal" robots="noindex, nofollow" path="/portal/announcements" />
      <p className="font-code text-[16px] font-bold text-muted">
        <span aria-hidden>{'// '}</span>thông báo
      </p>
      <h1 className="mt-3 font-display text-[clamp(32px,4vw,56px)] font-extrabold leading-none tracking-[-0.03em]">
        Thông báo nội bộ
      </h1>
      <p className="mt-4 max-w-[60ch] text-[18px] leading-relaxed text-muted">
        Thông báo dành cho thành viên CLB: toàn CLB, ban của bạn hoặc vai trò của bạn.
      </p>

      <section className="mt-10">
        <AsyncState
          loading={announcements.loading}
          error={announcements.error}
          empty={listEmpty}
          emptyText={page > 1 && total > 0 ? 'Trang này không có thông báo.' : 'Chưa có thông báo nào.'}
          onRetry={announcements.reload}
        >
          <>
            <p className="font-code text-[14px] font-bold text-muted">
              {'// '}hiện {firstItem}–{lastItem} / {total} thông báo
            </p>
            <div data-rv className="mt-6 flex flex-col gap-6">
              {items.map((item) => {
                const style = newsCategoryStyle(item.category)
                const thumbnail = fileSrc(item.thumbnailUrl)
                return (
                  <article key={item.id} className="flex flex-col gap-6 rounded-[20px] bg-soft p-6 sm:flex-row sm:items-center sm:p-8">
                    {thumbnail && (
                      <div className="photo aspect-[4/3] w-full max-w-[200px] shrink-0 sm:w-[200px]">
                        <img alt="" className="h-full" src={thumbnail} />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-3 font-code text-[13px] font-bold">
                        <span className={`rounded-md px-2 py-1 ${style.field}`}>{item.category}</span>
                        {item.publishedAt && <span className="text-muted">{formatDate(item.publishedAt)}</span>}
                      </p>
                      <h2 className="mt-3 font-display text-[clamp(20px,2.2vw,28px)] font-extrabold leading-tight tracking-[-0.02em]">
                        {item.title}
                      </h2>
                      <p className="mt-2 line-clamp-2 max-w-[70ch] text-[16px] leading-relaxed text-muted">{item.summary}</p>
                      <Link
                        to={`/portal/announcements/${item.id}`}
                        className="mt-3 inline-flex min-h-12 items-center text-[16px] font-extrabold text-apc-red underline decoration-2 underline-offset-4"
                      >
                        Xem chi tiết
                      </Link>
                    </div>
                  </article>
                )
              })}
            </div>
            {total > PAGE_SIZE && (
              <div className="mt-16">
                <Pagination
                  currentPage={page}
                  totalPages={totalPages}
                  onPageChange={(nextPage) => updateParams({ page: nextPage <= 1 ? null : String(nextPage) })}
                />
              </div>
            )}
          </>
        </AsyncState>
      </section>
    </main>
  )
}

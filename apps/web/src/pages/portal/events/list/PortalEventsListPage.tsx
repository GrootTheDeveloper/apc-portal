import { useLocation, useSearchParams } from 'react-router-dom'

import { AsyncState } from '../../../../components/AsyncState'
import { Button } from '../../../../components/Button'
import { EventCard } from '../../../../components/EventCard'
import { Pagination } from '../../../../components/Pagination'
import { pillClass } from '../../../../components/buttonClass'
import { useApi } from '../../../../hooks/useApi'
import type { Page } from '../../../../lib/api'
import { currentMonthKey } from '../../../../lib/vnTime'
import { EventCalendar } from '../../../events/list/EventCalendar'
import { EVENT_TYPES } from '../../../events/types'
import type { PortalEventListItem } from '../types'

const PAGE_SIZE = 9

const VIEWS = [
  { key: 'list', label: 'Danh sách' },
  { key: 'calendar', label: 'Lịch tháng' },
] as const

/**
 * PAGE-MEM-04 — danh sách và lịch sự kiện cho thành viên (E5): gồm cả sự kiện nội bộ người đó được xem
 * (toàn CLB và ban mình). Hai chế độ xem, bộ lọc, phân trang và tháng đều lưu trên URL như trang công khai.
 */
export function PortalEventsListPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const location = useLocation()

  const view = searchParams.get('view') === 'calendar' ? 'calendar' : 'list'
  const type = searchParams.get('type') ?? ''
  const page = Math.max(1, Number(searchParams.get('page')) || 1)
  const month = searchParams.get('month') ?? currentMonthKey()
  const from = `${location.pathname}${location.search}`

  const updateParams = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(searchParams)
    for (const [key, value] of Object.entries(changes)) {
      if (value === null || value === '') next.delete(key)
      else next.set(key, value)
    }
    setSearchParams(next)
  }

  // Chế độ lịch lấy cả tháng hiện tại (?month=), chế độ danh sách lấy từng trang (?page=, ?type=).
  const query = new URLSearchParams()
  if (view === 'calendar') {
    query.set('month', month)
    query.set('pageSize', '100')
  } else {
    query.set('page', String(page))
    query.set('pageSize', String(PAGE_SIZE))
    if (type) query.set('type', type)
  }
  const events = useApi<Page<PortalEventListItem>>(`/portal/events?${query}`)

  const items = events.data?.items ?? []
  const total = events.data?.total ?? 0
  const isFiltered = type !== ''
  const listEmpty = !events.loading && !events.error && items.length === 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const firstItem = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const lastItem = Math.min(total, page * PAGE_SIZE)

  const filters = [{ label: 'Tất cả', value: '' }, ...EVENT_TYPES.map((eventType) => ({ label: eventType, value: eventType }))]

  return (
    <main>
      <p className="font-code text-[16px] font-bold text-muted">
        <span aria-hidden>{'// '}</span>sự kiện
      </p>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-6">
        <h1 className="font-display text-[clamp(32px,4vw,56px)] font-extrabold leading-none tracking-[-0.03em]">
          Sự kiện của CLB
        </h1>
        <div role="group" aria-label="Chế độ xem" className="flex gap-3">
          {VIEWS.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              aria-pressed={view === key}
              onClick={() => updateParams({ view: key === 'list' ? null : key, page: null })}
              className={view === key ? pillClass(true) : pillClass(false)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <p className="mt-4 max-w-[60ch] text-[18px] leading-relaxed text-muted">
        Workshop, training và các hoạt động của CLB, gồm cả sự kiện nội bộ ban bạn. Đăng ký tham gia ngay tại trang
        sự kiện.
      </p>

      <section className="mt-10">
        <div role="group" aria-label="Lọc theo loại sự kiện" className="flex flex-wrap gap-2">
          {filters.map((filter) => (
            <button
              key={filter.label}
              type="button"
              aria-pressed={type === filter.value}
              onClick={() => updateParams({ type: filter.value || null, page: null })}
              className={pillClass(type === filter.value)}
            >
              {filter.label}
            </button>
          ))}
        </div>

        {view === 'calendar' ? (
          <AsyncState loading={events.loading} error={events.error} empty={false} onRetry={events.reload}>
            {listEmpty && (
              <p className="mt-8 font-code text-[14px] font-bold text-muted">
                {'// '}không có sự kiện nào{isFiltered ? ' khớp bộ lọc' : ''} trong tháng này
              </p>
            )}
            <div className="mt-8">
              <EventCalendar
                monthKey={month}
                events={items}
                onMonthChange={(nextMonth) => updateParams({ month: nextMonth })}
                to={(event) => `/portal/events/${event.id}`}
              />
            </div>
          </AsyncState>
        ) : (
          <AsyncState
            loading={events.loading}
            error={events.error}
            empty={listEmpty && !isFiltered}
            emptyText="Chưa có sự kiện nào."
            onRetry={events.reload}
          >
            {listEmpty && isFiltered ? (
              <div className="flex flex-col items-center gap-5 py-20 text-center">
                <p className="font-display text-[clamp(22px,2.4vw,30px)] font-bold text-muted">Không có sự kiện nào khớp bộ lọc.</p>
                <Button variant="outline" onClick={() => updateParams({ type: null, page: null })}>
                  Xóa bộ lọc
                </Button>
              </div>
            ) : (
              <>
                <p className="mt-8 font-code text-[14px] font-bold text-muted">
                  {'// '}hiện {firstItem}–{lastItem} / {total} sự kiện
                </p>
                <div className="mt-6 grid gap-x-8 gap-y-14 sm:grid-cols-2 lg:grid-cols-3">
                  {items.map((event) => (
                    <EventCard
                      key={event.id}
                      slug={event.slug}
                      title={event.title}
                      eventType={event.eventType}
                      startAt={event.startAt}
                      endAt={event.endAt}
                      location={event.location}
                      onlineUrl={event.onlineUrl}
                      coverImageUrl={event.coverImageUrl}
                      status={event.status}
                      to={`/portal/events/${event.id}`}
                      linkState={{ from }}
                    />
                  ))}
                </div>
                <div className="mt-16">
                  <Pagination
                    currentPage={page}
                    totalPages={totalPages}
                    onPageChange={(nextPage) => updateParams({ page: nextPage <= 1 ? null : String(nextPage) })}
                  />
                </div>
              </>
            )}
          </AsyncState>
        )}
      </section>
    </main>
  )
}

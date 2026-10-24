import { useLocation, useSearchParams } from 'react-router-dom'

import { EventCard } from '../../../components/EventCard'
import { AsyncState } from '../../../components/AsyncState'
import { Button } from '../../../components/Button'
import { Eyebrow } from '../../../components/Eyebrow'
import { Pagination } from '../../../components/Pagination'
import { useMockApi } from '../../../hooks/useMockApi'
import { DEFAULT_MONTH_KEY, EVENT_TYPES, listEvents } from '../mock'
import { EventCalendar } from './EventCalendar'

const PAGE_SIZE = 9

const VIEWS = [
  { key: 'list', label: 'Danh sách', icon: 'view_list' },
  { key: 'calendar', label: 'Lịch tháng', icon: 'calendar_month' },
] as const

/** PAGE-PUB-05 — danh sách và lịch sự kiện công khai. Bộ lọc, chế độ xem, trang đều lưu trên URL (Sitemap §15.1). */
export function EventsListPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const location = useLocation()

  const view = searchParams.get('view') === 'calendar' ? 'calendar' : 'list'
  const type = searchParams.get('type') ?? ''
  const page = Math.max(1, Number(searchParams.get('page')) || 1)
  const month = searchParams.get('month') ?? DEFAULT_MONTH_KEY
  const from = `${location.pathname}${location.search}`

  const updateParams = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(searchParams)
    for (const [key, value] of Object.entries(changes)) {
      if (value === null || value === '') next.delete(key)
      else next.set(key, value)
    }
    setSearchParams(next)
  }

  const events = useMockApi(
    () =>
      listEvents({
        page: view === 'calendar' ? 1 : page,
        pageSize: view === 'calendar' ? 100 : PAGE_SIZE,
        type: type || null,
        month: view === 'calendar' ? month : null,
      }),
    [view, page, type, month],
  )

  const items = events.data?.items ?? []
  const total = events.data?.total ?? 0
  const isFiltered = type !== ''
  const listEmpty = !events.loading && !events.error && items.length === 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const firstItem = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const lastItem = Math.min(total, page * PAGE_SIZE)

  return (
    <main className="mx-auto w-full max-w-container-max px-gutter py-12 md:py-16">
      <header className="mb-8 border-b border-outline-variant/20 pb-6">
        <Eyebrow className="text-on-surface-variant mb-2">LỊCH TRÌNH</Eyebrow>
        <h1 className="text-3xl font-bold text-on-surface md:text-4xl">Sự kiện</h1>
        <p className="mt-3 text-on-surface-variant">Workshop, training và các cuộc thi của CLB — xem theo danh sách hoặc lịch tháng.</p>
      </header>

      <div className="mb-8 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="inline-flex w-max rounded-apc border border-outline-variant/40 bg-surface-container-low p-1">
          {VIEWS.map(({ key, label, icon }) => (
            <button
              key={key}
              type="button"
              aria-pressed={view === key}
              onClick={() => updateParams({ view: key === 'list' ? null : key, page: null })}
              className={`inline-flex items-center gap-1.5 rounded-apc px-4 py-2 text-sm font-medium transition-colors ${
                view === key ? 'bg-apc-red text-white shadow-sm' : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              <span className="material-symbols-outlined text-base">{icon}</span> {label}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-sm text-on-surface-variant">
          Loại
          <select
            value={type}
            onChange={(changeEvent) => updateParams({ type: changeEvent.target.value || null, page: null })}
            className="rounded-apc border border-outline-variant/40 bg-white px-4 py-2 text-sm text-on-surface"
          >
            <option value="">Tất cả loại</option>
            {EVENT_TYPES.map((eventType) => (
              <option key={eventType} value={eventType}>
                {eventType}
              </option>
            ))}
          </select>
        </label>
      </div>

      {view === 'calendar' ? (
        <AsyncState loading={events.loading} error={events.error} empty={false} onRetry={events.reload}>
          {listEmpty && <p className="mb-6 text-center text-on-surface-variant">Không có sự kiện nào{isFiltered ? ' khớp bộ lọc' : ''} trong tháng này.</p>}
          <EventCalendar monthKey={month} events={items} onMonthChange={(nextMonth) => updateParams({ month: nextMonth })} />
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
            <div className="flex flex-col items-center gap-4 py-16 text-center">
              <p className="text-on-surface-variant">Không có sự kiện nào khớp bộ lọc.</p>
              <Button variant="outline" className="px-6 py-2" onClick={() => updateParams({ type: null, page: null })}>
                Xóa bộ lọc
              </Button>
            </div>
          ) : (
            <>
              <p className="mb-4 text-sm text-on-surface-variant">
                Hiện {firstItem}–{lastItem} trong tổng số {total} sự kiện
              </p>
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((event) => (
                  <EventCard key={event.slug} {...event} linkState={{ from }} />
                ))}
              </div>
              <div className="mt-10 flex justify-center">
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
    </main>
  )
}

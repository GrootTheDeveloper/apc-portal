import { useLocation, useSearchParams } from 'react-router-dom'

import { EventCard } from '../../../components/EventCard'
import { AsyncState } from '../../../components/AsyncState'
import { Button } from '../../../components/Button'
import { pillClass } from '../../../components/buttonClass'
import { PageHero } from '../../../components/PageHero'
import { Pagination } from '../../../components/Pagination'
import { useMockApi } from '../../../hooks/useMockApi'
import { DEFAULT_MONTH_KEY, EVENT_TYPES, listEvents } from '../mock'
import { EventCalendar } from './EventCalendar'

const PAGE_SIZE = 9

const VIEWS = [
  { key: 'list', label: 'Danh sách' },
  { key: 'calendar', label: 'Lịch tháng' },
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

  const filters = [{ label: 'Tất cả', value: '' }, ...EVENT_TYPES.map((eventType) => ({ label: eventType, value: eventType }))]

  return (
    <main>
      <PageHero
        tone="blue"
        comment="lịch trình"
        title="Sự kiện"
        lede="Workshop, training và các cuộc thi của CLB. Xem theo danh sách hoặc lịch tháng."
        aside={
          <div role="group" aria-label="Chế độ xem" className="inline-flex rounded-2xl bg-paper/15 p-1.5">
            {VIEWS.map(({ key, label }) => (
              <button
                key={key}
                type="button"
                aria-pressed={view === key}
                onClick={() => updateParams({ view: key === 'list' ? null : key, page: null })}
                className={`min-h-11 rounded-xl px-5 text-[15px] font-extrabold transition-colors ${
                  view === key ? 'bg-paper text-ink' : 'text-paper hover:bg-paper/15'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        }
      />

      <section className="px-4 py-[clamp(40px,7vh,80px)] md:px-8">
        <div className="mx-auto w-full max-w-container-max">
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
                <EventCalendar monthKey={month} events={items} onMonthChange={(nextMonth) => updateParams({ month: nextMonth })} />
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
                      <EventCard key={event.slug} {...event} linkState={{ from }} />
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
        </div>
      </section>
    </main>
  )
}

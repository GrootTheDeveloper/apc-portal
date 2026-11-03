import { Link, useParams } from 'react-router-dom'

import { AsyncState } from '../../../components/AsyncState'
import { buttonClass } from '../../../components/buttonClass'
import { useApi } from '../../../hooks/useApi'
import { ADMIN_EVENT_STATUS_LABELS } from './types'
import { AdminEventDetailContent } from './AdminEventDetailPage'
import type { AdminEvent } from './types'

/**
 * PAGE-ADM-EVT-04 — xem trước sự kiện cho quản trị. DRAFT không bao giờ lộ qua API công khai,
 * nên trang này dựng từ dữ liệu quản trị (GET /admin/events/:id) thay vì trang công khai theo slug.
 */
export function AdminEventPreviewPage() {
  const { id } = useParams<{ id: string }>()
  const { data: event, loading, error, reload } = useApi<AdminEvent>(id ? `/admin/events/${id}` : null)

  return (
    <div className="min-h-screen">
      {/* Banner chế độ xem trước, đè lên trên cùng như trang xem trước đợt tuyển. */}
      <div className="sticky top-0 z-30 flex flex-wrap items-center justify-between gap-3 border-b-2 border-ink bg-soft px-6 py-3">
        <div className="flex items-center gap-3 text-sm font-bold text-ink">
          <span className="font-code text-xs uppercase text-apc-blue">{'// xem trước'}</span>
          <span>Chế độ xem trước sự kiện (Admin Preview)</span>
          {event && (
            <span className="rounded-md bg-ink px-2.5 py-0.5 font-code text-xs text-paper">
              Trạng thái thực: {ADMIN_EVENT_STATUS_LABELS[event.status].label}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <Link to={event ? `/admin/events/${event.id}` : '/admin/events'} className={buttonClass('primary')}>
            ← Quay lại quản lý
          </Link>
        </div>
      </div>

      <div className="mx-auto w-full">
        <AsyncState
          loading={loading}
          error={error}
          empty={!event}
          emptyText="Không tìm thấy sự kiện để xem trước."
          onRetry={reload}
        >
          {event && <AdminEventDetailContent event={event} />}
        </AsyncState>
      </div>
    </div>
  )
}

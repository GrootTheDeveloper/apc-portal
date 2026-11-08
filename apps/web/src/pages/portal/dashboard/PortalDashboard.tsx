import { Link } from 'react-router-dom'

import { AsyncState } from '../../../components/AsyncState'
import { buttonClass } from '../../../components/buttonClass'
import { useApi } from '../../../hooks/useApi'
import { useAuth } from '../../../hooks/useAuth'
import { formatDate } from '../../../lib/format'

type PublicEventsResponse = {
  items: Array<{
    id: string
    title: string
    slug: string
    eventType: string
    startAt: string
    endAt: string
    location?: string | null
    onlineUrl?: string | null
  }>
  total: number
}

type ActivityResponse = {
  items: Array<{
    id: string
    registrationCode: string
    status: 'REGISTERED' | 'CANCELLED'
    attendanceStatus: 'NOT_MARKED' | 'PRESENT' | 'EXCUSED' | 'ABSENT'
    registeredAt: string
    cancelledAt: string | null
    event: {
      id: string
      title: string
      slug: string
      startAt: string
      endAt: string
      location?: string | null
      onlineUrl?: string | null
    }
  }>
  total: number
}

const ATTENDANCE_BADGES: Record<string, { label: string; className: string }> = {
  PRESENT: { label: 'Có mặt', className: 'bg-apc-blue-pale text-apc-blue' },
  EXCUSED: { label: 'Có phép', className: 'bg-muted/10 text-muted' },
  ABSENT: { label: 'Vắng mặt', className: 'bg-apc-red/10 text-apc-red' },
  NOT_MARKED: { label: 'Chưa điểm danh', className: 'bg-paper shadow-[inset_0_0_0_1px_#081F3D] text-ink' },
}

export function PortalDashboard() {
  const { user } = useAuth()

  // STATE-12: Mỗi khối gọi API riêng, lỗi khối nào hiện nút Thử lại ở khối đó
  const eventsApi = useApi<PublicEventsResponse>('/public/events?upcoming=1&pageSize=4')
  const activityApi = useApi<ActivityResponse>('/portal/me/activity?page=1&pageSize=4')

  return (
    <main>
      <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-center">
        <div>
          <span className="font-code text-xs font-bold uppercase tracking-wider text-muted">
            Trang thành viên
          </span>
          <h1 className="mt-2 font-display text-[clamp(28px,3.5vw,48px)] font-extrabold leading-tight tracking-[-0.03em] text-ink">
            Xin chào, {user?.fullName ?? 'Thành viên'}!
          </h1>
          <p className="mt-2 text-[17px] leading-relaxed text-muted">
            Quản lý hồ sơ, theo dõi hoạt động sự kiện và vai trò của bạn tại APC Portal.
          </p>
        </div>
        <div>
          <Link to="/portal/profile" className={buttonClass('outline')}>
            Chỉnh sửa hồ sơ
          </Link>
        </div>
      </div>

      {/* Lối tắt nhanh */}
      <section aria-label="Lối tắt nhanh" className="mt-8 grid gap-4 sm:grid-cols-3">
        <Link
          to="/portal/profile"
          className="flex flex-col gap-1 rounded-2xl bg-paper p-5 shadow-[inset_0_0_0_2px_#081F3D,0_4px_0_#081F3D] transition-[transform,color] duration-150 hover:-translate-y-0.5 hover:text-apc-red active:translate-y-1 active:shadow-[inset_0_0_0_2px_#081F3D,0_0_0_#081F3D]"
        >
          <span className="font-display text-lg font-bold">Hồ sơ cá nhân</span>
          <span className="text-sm text-muted">Xem và cập nhật thông tin cá nhân</span>
        </Link>
        <Link
          to="/portal/activity-history"
          className="flex flex-col gap-1 rounded-2xl bg-paper p-5 shadow-[inset_0_0_0_2px_#081F3D,0_4px_0_#081F3D] transition-[transform,color] duration-150 hover:-translate-y-0.5 hover:text-apc-red active:translate-y-1 active:shadow-[inset_0_0_0_2px_#081F3D,0_0_0_#081F3D]"
        >
          <span className="font-display text-lg font-bold">Lịch sử hoạt động</span>
          <span className="text-sm text-muted">Sự kiện đã tham gia và điểm danh</span>
        </Link>
        <Link
          to="/portal/account/roles"
          className="flex flex-col gap-1 rounded-2xl bg-paper p-5 shadow-[inset_0_0_0_2px_#081F3D,0_4px_0_#081F3D] transition-[transform,color] duration-150 hover:-translate-y-0.5 hover:text-apc-red active:translate-y-1 active:shadow-[inset_0_0_0_2px_#081F3D,0_0_0_#081F3D]"
        >
          <span className="font-display text-lg font-bold">Vai trò & Phạm vi</span>
          <span className="text-sm text-muted">Xem quyền hạn trong nhiệm kỳ</span>
        </Link>
      </section>

      {/* Hai khối dữ liệu riêng biệt: Sự kiện sắp tới & Đăng ký của tôi (STATE-12) */}
      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        {/* Khối Sự kiện sắp tới */}
        <section
          aria-labelledby="events-heading"
          className="rounded-2xl bg-paper p-6 shadow-[inset_0_0_0_2px_#081F3D]"
        >
          <div className="flex items-center justify-between border-b-2 border-ink/10 pb-4">
            <h2 id="events-heading" className="font-display text-xl font-bold text-ink">
              Sự kiện sắp tới
            </h2>
            <Link to="/portal/events" className="text-sm font-bold text-apc-blue hover:underline">
              Xem tất cả →
            </Link>
          </div>

          <div className="mt-4">
            <AsyncState
              loading={eventsApi.loading}
              error={eventsApi.error}
              empty={!eventsApi.data || eventsApi.data.items.length === 0}
              emptyText="Hiện chưa có sự kiện nào sắp diễn ra."
              onRetry={eventsApi.reload}
            >
              {eventsApi.data && (
                <ul className="divide-y divide-ink/10">
                  {eventsApi.data.items.map((event) => (
                    <li key={event.id} className="py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-bold text-ink">{event.title}</p>
                          <p className="mt-1 text-sm text-muted">
                            {formatDate(event.startAt)} • {event.location || event.onlineUrl || 'Chưa cập nhật địa điểm'}
                          </p>
                        </div>
                        <span className="shrink-0 rounded-full bg-soft px-3 py-1 font-code text-xs font-bold text-ink">
                          {event.eventType}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </AsyncState>
          </div>
        </section>

        {/* Khối Đăng ký của tôi */}
        <section
          aria-labelledby="activity-heading"
          className="rounded-2xl bg-paper p-6 shadow-[inset_0_0_0_2px_#081F3D]"
        >
          <div className="flex items-center justify-between border-b-2 border-ink/10 pb-4">
            <h2 id="activity-heading" className="font-display text-xl font-bold text-ink">
              Đăng ký gần đây của tôi
            </h2>
            <Link
              to="/portal/activity-history"
              className="text-sm font-bold text-apc-blue hover:underline"
            >
              Xem tất cả →
            </Link>
          </div>

          <div className="mt-4">
            <AsyncState
              loading={activityApi.loading}
              error={activityApi.error}
              empty={!activityApi.data || activityApi.data.items.length === 0}
              emptyText="Bạn chưa đăng ký tham gia sự kiện nào."
              onRetry={activityApi.reload}
            >
              {activityApi.data && (
                <ul className="divide-y divide-ink/10">
                  {activityApi.data.items.map((item) => {
                    const badge =
                      item.status === 'CANCELLED'
                        ? { label: 'Đã hủy', className: 'bg-apc-red/10 text-apc-red' }
                        : ATTENDANCE_BADGES[item.attendanceStatus] ?? {
                            label: item.attendanceStatus,
                            className: 'bg-soft text-ink',
                          }

                    return (
                      <li key={item.id} className="py-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-bold text-ink">{item.event.title}</p>
                            <p className="mt-1 text-sm text-muted">
                              Đăng ký: {formatDate(item.registeredAt)}
                            </p>
                          </div>
                          <span
                            className={`shrink-0 rounded-full px-3 py-1 font-code text-xs font-bold ${badge.className}`}
                          >
                            {badge.label}
                          </span>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </AsyncState>
          </div>
        </section>
      </div>
    </main>
  )
}

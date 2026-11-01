import { AsyncState } from '../../../components/AsyncState'
import { Eyebrow } from '../../../components/Eyebrow'
import { useApi } from '../../../hooks/useApi'
import { formatDate } from '../../../lib/format'
import { PortalNav } from '../PortalNav'

type ActivityItem = {
  id: string
  eventTitle: string
  eventDate?: string
  registeredAt: string
  attendanceStatus?: 'ATTENDED' | 'ABSENT' | 'EXCUSED' | 'NOT_RECORDED'
  attended?: boolean
  notes?: string
}

type ActivityResponse = {
  items: ActivityItem[]
  total: number
  page: number
  pageSize: number
}

const ATTENDANCE_BADGES: Record<string, { label: string; className: string }> = {
  ATTENDED: { label: 'Đã điểm danh', className: 'bg-green-100 text-green-800' },
  ABSENT: { label: 'Vắng mặt', className: 'bg-red-100 text-red-800' },
  EXCUSED: { label: 'Vắng có phép', className: 'bg-yellow-100 text-yellow-800' },
  NOT_RECORDED: { label: 'Chưa điểm danh', className: 'bg-surface-container-high text-on-surface-variant' },
}

export function ActivityHistoryPage() {
  const { data, loading, error, reload } = useApi<ActivityResponse>('/portal/me/activity')

  return (
    <main className="mx-auto max-w-container-max px-gutter py-8">
      <PortalNav
        breadcrumbs={[
          { label: 'Trang chủ', to: '/' },
          { label: 'Portal', to: '/portal' },
          { label: 'Lịch sử hoạt động', to: '/portal/activity-history' },
        ]}
      />

      <div className="mb-6">
        <Eyebrow>Hoạt động của tôi</Eyebrow>
        <h1 className="mt-2 text-2xl font-bold text-on-surface sm:text-3xl">Lịch sử hoạt động & Điểm danh</h1>
        <p className="mt-1 text-sm text-on-surface-variant">
          Theo dõi toàn bộ các sự kiện, workshop và buổi sinh hoạt bạn đã đăng ký tham gia cùng kết quả điểm danh.
        </p>
      </div>

      <div className="rounded-apc border border-outline-variant bg-surface-container-lowest p-6">
        <AsyncState
          loading={loading}
          error={error}
          empty={!data || data.items.length === 0}
          emptyText="Bạn chưa đăng ký tham gia sự kiện nào."
          onRetry={reload}
        >
          {data && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-outline-variant text-xs uppercase text-on-surface-variant">
                  <tr>
                    <th scope="col" className="pb-3 font-semibold">
                      Tên sự kiện
                    </th>
                    <th scope="col" className="pb-3 font-semibold">
                      Ngày đăng ký
                    </th>
                    <th scope="col" className="pb-3 font-semibold">
                      Thời gian diễn ra
                    </th>
                    <th scope="col" className="pb-3 font-semibold">
                      Trạng thái điểm danh
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant">
                  {data.items.map((item) => {
                    const statusKey = item.attendanceStatus ?? (item.attended ? 'ATTENDED' : 'NOT_RECORDED')
                    const badge = ATTENDANCE_BADGES[statusKey] ?? {
                      label: statusKey,
                      className: 'bg-surface-container-high text-on-surface-variant',
                    }

                    return (
                      <tr key={item.id} className="hover:bg-surface-container-low/50">
                        <td className="py-4 font-medium text-on-surface">{item.eventTitle}</td>
                        <td className="py-4 text-on-surface-variant">{formatDate(item.registeredAt)}</td>
                        <td className="py-4 text-on-surface-variant">
                          {item.eventDate ? formatDate(item.eventDate) : '—'}
                        </td>
                        <td className="py-4">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${badge.className}`}
                          >
                            {badge.label}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </AsyncState>
      </div>
    </main>
  )
}

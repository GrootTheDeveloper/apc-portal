import { useState } from 'react'

import { AsyncState } from '../../../components/AsyncState'
import { Pagination } from '../../../components/Pagination'
import { useApi } from '../../../hooks/useApi'
import { formatDate } from '../../../lib/format'

type ActivityItem = {
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
}

type ActivityResponse = {
  items: ActivityItem[]
  total: number
  page: number
  pageSize: number
}

const ATTENDANCE_BADGES: Record<string, { label: string; className: string }> = {
  PRESENT: { label: 'Có mặt', className: 'bg-apc-blue-pale text-apc-blue' },
  EXCUSED: { label: 'Có phép', className: 'bg-muted/10 text-muted' },
  ABSENT: { label: 'Vắng mặt', className: 'bg-apc-red/10 text-apc-red' },
  NOT_MARKED: { label: 'Chưa điểm danh', className: 'bg-paper shadow-[inset_0_0_0_1px_#081F3D] text-ink' },
}

export function ActivityHistoryPage() {
  const [page, setPage] = useState(1)
  const pageSize = 10
  const { data, loading, error, reload } = useApi<ActivityResponse>(
    `/portal/me/activity?page=${page}&pageSize=${pageSize}`,
  )

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1

  return (
    <main>
      <div>
        <span className="font-code text-xs font-bold uppercase tracking-wider text-muted">
          Hoạt động của tôi
        </span>
        <h1 className="mt-2 font-display text-[clamp(28px,3.5vw,48px)] font-extrabold leading-tight tracking-[-0.03em] text-ink">
          Lịch sử hoạt động & Điểm danh
        </h1>
        <p className="mt-2 text-[17px] leading-relaxed text-muted">
          Theo dõi toàn bộ các sự kiện, workshop và buổi sinh hoạt bạn đã đăng ký tham gia cùng kết quả điểm danh.
        </p>
      </div>

      <div className="mt-8 rounded-2xl bg-paper p-6 shadow-[inset_0_0_0_2px_#081F3D]">
        <AsyncState
          loading={loading}
          error={error}
          empty={!data || data.items.length === 0}
          emptyText="Bạn chưa đăng ký tham gia sự kiện nào."
          onRetry={reload}
        >
          {data && (
            <div className="flex flex-col gap-6">
              <div className="overflow-x-auto">
                <table className="w-full text-left font-body text-sm">
                  <thead className="border-b-2 border-ink text-xs uppercase tracking-wider text-muted">
                    <tr>
                      <th scope="col" className="pb-3 font-code font-bold">
                        Tên sự kiện
                      </th>
                      <th scope="col" className="pb-3 font-code font-bold">
                        Ngày đăng ký
                      </th>
                      <th scope="col" className="pb-3 font-code font-bold">
                        Thời gian diễn ra
                      </th>
                      <th scope="col" className="pb-3 font-code font-bold">
                        Trạng thái điểm danh
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink/10">
                    {data.items.map((item) => {
                      const isCancelled = item.status === 'CANCELLED'
                      const badge = isCancelled
                        ? { label: 'Đã hủy đăng ký', className: 'bg-apc-red/10 text-apc-red line-through' }
                        : ATTENDANCE_BADGES[item.attendanceStatus] ?? {
                            label: item.attendanceStatus,
                            className: 'bg-soft text-ink',
                          }

                      return (
                        <tr key={item.id} className="transition-colors hover:bg-soft/40">
                          <td className="py-4 pr-4">
                            <p className="font-bold text-ink">{item.event.title}</p>
                            <p className="mt-1 font-code text-xs text-muted">
                              Mã đăng ký: {item.registrationCode}
                            </p>
                          </td>
                          <td className="py-4 pr-4 text-muted">{formatDate(item.registeredAt)}</td>
                          <td className="py-4 pr-4 text-muted">
                            {formatDate(item.event.startAt)}
                            {item.event.location ? ` • ${item.event.location}` : ''}
                          </td>
                          <td className="py-4">
                            <span
                              className={`inline-flex rounded-full px-3 py-1 font-code text-xs font-bold ${badge.className}`}
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

              {/* Phân trang */}
              {totalPages > 1 && (
                <div className="pt-4">
                  <Pagination
                    currentPage={page}
                    totalPages={totalPages}
                    onPageChange={(newPage) => setPage(newPage)}
                  />
                </div>
              )}
            </div>
          )}
        </AsyncState>
      </div>
    </main>
  )
}

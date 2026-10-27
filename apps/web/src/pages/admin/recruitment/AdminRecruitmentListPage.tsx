import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AsyncState } from '../../../components/AsyncState'
import { Button } from '../../../components/Button'
import { Eyebrow } from '../../../components/Eyebrow'
import { useApi } from '../../../hooks/useApi'
import { useAuth } from '../../../hooks/useAuth'
import type { Page } from '../../../lib/api'
import { hasRole } from '../../../lib/auth'
import { formatDateTime } from '../../../lib/format'
import type { RecruitmentRound, RecruitmentRoundStatus } from '../../recruitment/types'

const STATUS_LABELS: Record<RecruitmentRoundStatus, { label: string; color: string }> = {
  DRAFT: { label: 'Bản nháp', color: 'bg-surface-container-high text-on-surface-variant' },
  OPEN: { label: 'Đang mở', color: 'bg-emerald-50 text-emerald-700 font-semibold' },
  CLOSED: { label: 'Đã đóng', color: 'bg-amber-50 text-amber-700' },
  ARCHIVED: { label: 'Lưu trữ', color: 'bg-surface-container text-on-surface-variant/60' },
}

export function AdminRecruitmentListPage() {
  const { user } = useAuth()
  const isBoard = hasRole(user, 'BOARD')
  const [statusFilter, setStatusFilter] = useState<string>('ALL')

  const { data, loading, error, reload } = useApi<Page<RecruitmentRound>>('/admin/recruitment')
  const rounds = data?.items ?? []

  const filteredRounds = statusFilter === 'ALL'
    ? rounds
    : rounds.filter((r) => r.status === statusFilter)

  return (
    <main className="mx-auto max-w-container-max px-gutter py-10 md:py-14">
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="mb-4 flex items-center gap-2 text-sm text-on-surface-variant">
        <Link to="/admin" className="hover:text-apc-red transition-colors">Quản trị</Link>
        <span>/</span>
        <span className="text-on-surface font-medium">Tuyển thành viên</span>
      </nav>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-outline-variant/60 pb-6">
        <div>
          <Eyebrow>Quản lý tuyển sinh</Eyebrow>
          <h1 className="mt-2 text-2xl md:text-3xl font-extrabold text-on-surface">Đợt tuyển thành viên</h1>
        </div>

        {isBoard && (
          <Link to="/admin/recruitment/new">
            <Button variant="primary" className="shadow-sm">
              <span className="material-symbols-outlined text-lg">add</span>
              Tạo đợt tuyển mới
            </Button>
          </Link>
        )}
      </div>

      {/* Bộ lọc trạng thái */}
      <div className="mt-6 flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-on-surface-variant mr-2">Lọc theo trạng thái:</span>
        {['ALL', 'DRAFT', 'OPEN', 'CLOSED', 'ARCHIVED'].map((st) => (
          <button
            key={st}
            onClick={() => setStatusFilter(st)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              statusFilter === st
                ? 'bg-apc-red text-white'
                : 'bg-surface-container hover:bg-surface-container-high text-on-surface'
            }`}
          >
            {st === 'ALL' ? 'Tất cả' : STATUS_LABELS[st as RecruitmentRoundStatus].label}
          </button>
        ))}
      </div>

      {/* Danh sách */}
      <div className="mt-8">
        <AsyncState
          loading={loading}
          error={error}
          empty={filteredRounds.length === 0}
          onRetry={reload}
          emptyText="Không có đợt tuyển nào phù hợp."
        >
          <div className="overflow-x-auto rounded-apc border border-outline-variant bg-surface-container-lowest shadow-sm">
            <table className="w-full text-left text-sm text-on-surface">
              <thead className="border-b border-outline-variant bg-surface-container text-xs font-semibold uppercase text-on-surface-variant">
                <tr>
                  <th className="px-6 py-4">Tên đợt tuyển</th>
                  <th className="px-6 py-4">Trạng thái</th>
                  <th className="px-6 py-4">Thời gian nhận đơn</th>
                  <th className="px-6 py-4">Số hồ sơ</th>
                  <th className="px-6 py-4 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/60">
                {filteredRounds.map((round) => (
                  <tr key={round.id} className="hover:bg-surface-container-low transition-colors">
                    <td className="px-6 py-4">
                      <Link
                        to={`/admin/recruitment/${round.id}`}
                        className="font-bold text-on-surface hover:text-apc-red transition-colors"
                      >
                        {round.title}
                      </Link>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {round.departments.map((d) => (
                          <span key={d.id} className="rounded bg-surface-container px-1.5 py-0.5 text-[11px] text-on-surface-variant">
                            {d.name.split('(')[0].trim()}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-block rounded-full px-2.5 py-1 text-xs ${STATUS_LABELS[round.status].color}`}>
                        {STATUS_LABELS[round.status].label}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-xs text-on-surface-variant">
                      <div>{formatDateTime(round.opensAt)}</div>
                      <div className="text-outline-variant">đến</div>
                      <div>{formatDateTime(round.closesAt)}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-semibold">{round._count?.applications ?? 0}</span> hồ sơ
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                      <Link
                        to={`/admin/recruitment/${round.id}`}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-apc-blue hover:underline"
                      >
                        Chi tiết
                      </Link>
                      {isBoard && (
                        <Link
                          to={`/admin/recruitment/${round.id}/edit`}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-on-surface hover:text-apc-red"
                        >
                          Sửa
                        </Link>
                      )}
                      <Link
                        to={`/admin/recruitment/${round.id}/preview`}
                        className="inline-flex items-center gap-1 text-xs text-on-surface-variant hover:text-on-surface"
                      >
                        Xem trước
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </AsyncState>
      </div>
    </main>
  )
}
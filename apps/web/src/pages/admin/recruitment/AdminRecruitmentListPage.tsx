import { Link, useSearchParams } from 'react-router-dom'
import { AsyncState } from '../../../components/AsyncState'
import { Breadcrumb } from '../../../components/Breadcrumb'
import { buttonClass, pillClass } from '../../../components/buttonClass'
import { Eyebrow } from '../../../components/Eyebrow'
import { Pagination } from '../../../components/Pagination'
import { useApi } from '../../../hooks/useApi'
import { useAuth } from '../../../hooks/useAuth'
import type { Page } from '../../../lib/api'
import { hasRole } from '../../../lib/auth'
import { formatDateTime } from '../../../lib/format'
import type { RecruitmentRound, RecruitmentRoundStatus } from '../../recruitment/types'

const STATUS_LABELS: Record<RecruitmentRoundStatus, { label: string; className: string }> = {
  DRAFT: { label: 'Bản nháp', className: 'bg-soft text-muted' },
  OPEN: { label: 'Đang mở', className: 'bg-ink text-paper font-bold' },
  CLOSED: { label: 'Đã đóng', className: 'bg-soft text-ink' },
  ARCHIVED: { label: 'Lưu trữ', className: 'bg-soft text-muted opacity-60' },
}

const FILTER_TABS: { value: string; label: string }[] = [
  { value: 'ALL', label: 'Tất cả' },
  { value: 'DRAFT', label: 'Bản nháp' },
  { value: 'OPEN', label: 'Đang mở' },
  { value: 'CLOSED', label: 'Đã đóng' },
  { value: 'ARCHIVED', label: 'Lưu trữ' },
]

export function AdminRecruitmentListPage() {
  const { user } = useAuth()
  const isBoard = hasRole(user, 'BOARD')

  const [searchParams, setSearchParams] = useSearchParams()
  const page = Number(searchParams.get('page') || '1')
  const statusParam = searchParams.get('status') || 'ALL'

  const apiPath = `/admin/recruitment?page=${page}&pageSize=20${
    statusParam !== 'ALL' ? `&status=${statusParam}` : ''
  }`
  const { data, loading, error, reload } = useApi<Page<RecruitmentRound>>(apiPath)

  function handleFilterChange(newStatus: string) {
    const next = new URLSearchParams(searchParams)
    if (newStatus === 'ALL') {
      next.delete('status')
    } else {
      next.set('status', newStatus)
    }
    next.set('page', '1')
    setSearchParams(next)
  }

  function handlePageChange(newPage: number) {
    const next = new URLSearchParams(searchParams)
    next.set('page', String(newPage))
    setSearchParams(next)
  }

  const rounds = data?.items ?? []

  return (
    <main className="mx-auto max-w-container-max px-gutter py-10 md:py-14">
      <Breadcrumb
        items={[
          { label: 'quản trị', to: '/admin' },
          { label: 'tuyển thành viên' },
        ]}
      />

      <div className="mt-4 flex flex-col justify-between gap-4 border-b-2 border-ink pb-6 sm:flex-row sm:items-center">
        <div>
          <Eyebrow className="text-apc-blue">quản lý tuyển sinh</Eyebrow>
          <h1 className="mt-2 font-display text-3xl font-extrabold text-ink md:text-4xl">
            Đợt tuyển thành viên
          </h1>
        </div>

        {isBoard && (
          <Link to="/admin/recruitment/new" className={buttonClass('primary')}>
            + Tạo đợt tuyển mới
          </Link>
        )}
      </div>

      {/* Bộ lọc trạng thái dùng pillClass */}
      <div className="mt-6 flex flex-wrap items-center gap-2">
        <span className="mr-2 font-code text-xs font-bold uppercase text-muted">Lọc trạng thái:</span>
        {FILTER_TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => handleFilterChange(tab.value)}
            className={pillClass(statusParam === tab.value)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="mt-8">
        <AsyncState
          loading={loading}
          error={error}
          empty={rounds.length === 0}
          emptyText="Chưa có đợt tuyển nào phù hợp với bộ lọc."
          onRetry={reload}
        >
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left font-body text-sm text-ink">
              <thead>
                <tr className="border-b-2 border-ink font-display text-sm font-bold text-ink">
                  <th className="py-3 pr-4">Đợt tuyển</th>
                  <th className="px-4 py-3">Trạng thái</th>
                  <th className="px-4 py-3">Ban tuyển</th>
                  <th className="px-4 py-3">Thời gian nhận đơn</th>
                  <th className="px-4 py-3 text-right">Số hồ sơ</th>
                  <th className="py-3 pl-4 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y border-b border-ink/20">
                {rounds.map((round) => {
                  const badge = STATUS_LABELS[round.status]
                  return (
                    <tr key={round.id} className="transition hover:bg-soft">
                      <td className="py-4 pr-4">
                        <Link
                          to={`/admin/recruitment/${round.id}`}
                          className="font-display font-extrabold text-ink transition hover:text-apc-red"
                        >
                          {round.title}
                        </Link>
                        <p className="font-code text-xs text-muted">/{round.slug}</p>
                      </td>
                      <td className="px-4 py-4">
                        <span className={`inline-block rounded-md px-2.5 py-1 font-code text-xs ${badge.className}`}>
                          {badge.label}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex flex-wrap gap-1">
                          {round.departments.map((d) => (
                            <span key={d.id} className="rounded bg-soft px-2 py-0.5 text-xs text-ink font-semibold">
                              {d.name}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-xs text-muted">
                        <div>Mở: {formatDateTime(round.opensAt)}</div>
                        <div>Đóng: {formatDateTime(round.closesAt)}</div>
                      </td>
                      <td className="px-4 py-4 text-right font-display font-bold text-ink">
                        {round._count?.applications ?? 0}
                      </td>
                      <td className="py-4 pl-4 text-right">
                        <Link
                          to={`/admin/recruitment/${round.id}`}
                          className="font-bold text-apc-blue hover:underline"
                        >
                          Chi tiết →
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Phân trang */}
          {data && data.total > 20 && (
            <div className="mt-8 flex justify-center">
              <Pagination
                currentPage={page}
                totalPages={Math.ceil(data.total / 20)}
                onPageChange={handlePageChange}
              />
            </div>
          )}
        </AsyncState>
      </div>
    </main>
  )
}
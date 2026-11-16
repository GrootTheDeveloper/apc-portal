import { useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'

import { AsyncState } from '../../../../components/AsyncState'
import { Breadcrumb } from '../../../../components/Breadcrumb'
import { buttonClass, pillClass } from '../../../../components/buttonClass'
import { ExportStatus, type ExportStatusValue } from '../../../../components/ExportStatus'
import { inputClass } from '../../../../components/formClass'
import { PageHero } from '../../../../components/PageHero'
import { Pagination } from '../../../../components/Pagination'
import { useApi } from '../../../../hooks/useApi'
import { useAuth } from '../../../../hooks/useAuth'
import { api, ApiError, type Page } from '../../../../lib/api'
import { hasRole } from '../../../../lib/auth'
import { formatDateTime } from '../../../../lib/format'
import type {
  ApplicationListItem,
  ApplicationStatus,
  RecruitmentRound,
} from '../../../recruitment/types'

const STATUS_CONFIG: Record<
  ApplicationStatus,
  { label: string; badgeClass: string }
> = {
  NEW: { label: 'Mới nộp', badgeClass: 'bg-soft text-ink font-bold' },
  REVIEWING: { label: 'Đang xét', badgeClass: 'bg-apc-gold text-ink font-bold' },
  INTERVIEW: { label: 'Mời phỏng vấn', badgeClass: 'bg-apc-blue text-paper font-bold' },
  ACCEPTED: { label: 'Đã chấp nhận', badgeClass: 'bg-emerald-600 text-paper font-bold' },
  REJECTED: { label: 'Không chấp nhận', badgeClass: 'bg-apc-red text-paper font-bold' },
  WITHDRAWN: { label: 'Đã rút', badgeClass: 'bg-soft text-muted font-bold' },
}

const STATUS_TABS: { value: string; label: string }[] = [
  { value: 'ALL', label: 'Tất cả' },
  { value: 'NEW', label: 'Mới' },
  { value: 'REVIEWING', label: 'Đang xét' },
  { value: 'INTERVIEW', label: 'Phỏng vấn' },
  { value: 'ACCEPTED', label: 'Chấp nhận' },
  { value: 'REJECTED', label: 'Không chấp nhận' },
  { value: 'WITHDRAWN', label: 'Đã rút' },
]

export function AdminApplicationListPage() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const isBoard = hasRole(user, 'BOARD')

  const [searchParams, setSearchParams] = useSearchParams()
  const page = Number(searchParams.get('page') || '1')
  const statusParam = searchParams.get('status') || 'ALL'
  const departmentIdParam = searchParams.get('departmentId') || ''
  const searchParam = searchParams.get('search') || ''

  const [searchInput, setSearchInput] = useState(searchParam)
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)
  const [exportResult, setExportResult] = useState<{
    id: string
    status: ExportStatusValue
    filename: string
    expiresAt: string
    rowCount: number
  } | null>(null)

  // Tải thông tin đợt tuyển
  const { data: round } = useApi<RecruitmentRound>(
    id ? `/admin/recruitment/${id}` : null,
  )

  // Tìm kiếm danh sách hồ sơ: gửi qua body POST /admin/recruitment/:id/applications/search (OPS-11)
  const apiPath = id ? `/admin/recruitment/${id}/applications/search` : null
  const searchOptions = useMemo(() => ({
    method: 'POST' as const,
    body: {
      page,
      pageSize: 20,
      status: statusParam !== 'ALL' ? statusParam : undefined,
      departmentId: departmentIdParam || undefined,
      search: searchParam || undefined,
    },
  }), [page, statusParam, departmentIdParam, searchParam])

  const { data, loading, error, reload } = useApi<Page<ApplicationListItem>>(apiPath, searchOptions)

  function updateQuery(updates: Record<string, string | null>) {
    const next = new URLSearchParams(searchParams)
    for (const [key, val] of Object.entries(updates)) {
      if (val === null || val === '' || val === 'ALL') {
        next.delete(key)
      } else {
        next.set(key, val)
      }
    }
    next.set('page', '1')
    setSearchParams(next)
  }

  function handleStatusChange(newStatus: string) {
    updateQuery({ status: newStatus })
  }

  function handleDepartmentChange(deptId: string) {
    updateQuery({ departmentId: deptId })
  }

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault()
    updateQuery({ search: searchInput.trim() })
  }

  function handlePageChange(newPage: number) {
    const next = new URLSearchParams(searchParams)
    next.set('page', String(newPage))
    setSearchParams(next)
  }

  async function handleExportCsv() {
    if (!id || !round) return
    setExporting(true)
    setExportError(null)

    try {
      const payload: Record<string, string> = {}
      if (statusParam !== 'ALL') payload.status = statusParam
      if (departmentIdParam) payload.departmentId = departmentIdParam
      if (searchParam) payload.search = searchParam

      const result = await api<{
        id: string
        status: ExportStatusValue
        filename: string
        expiresAt: string
        rowCount: number
      }>(
        `/admin/recruitment/${id}/applications/export`,
        {
          method: 'POST',
          body: payload,
        },
      )

      setExportResult(result)

      // Kích hoạt tải về tự động qua route tải bảo vệ D6 (RP-17)
      const a = document.createElement('a')
      a.href = `/api/portal/exports/${encodeURIComponent(result.id)}/download`
      a.download = result.filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
    } catch (err) {
      if (err instanceof ApiError) {
        setExportError(err.message)
      } else {
        setExportError('Không thể xuất file CSV. Vui lòng thử lại.')
      }
    } finally {
      setExporting(false)
    }
  }

  const applications = data?.items ?? []
  const departments = round?.departments ?? []

  return (
    <div>
      <PageHero
        tone="blue"
        comment="quản trị / tuyển thành viên / danh sách hồ sơ"
        title="Hồ sơ ứng tuyển"
        lede={round ? `Đợt tuyển: ${round.title}` : 'Đang tải đợt tuyển...'}
        top={
          <Breadcrumb
            items={[
              { label: 'quản trị', to: '/admin' },
              { label: 'tuyển thành viên', to: '/admin/recruitment' },
              { label: round?.title ?? 'đợt tuyển', to: id ? `/admin/recruitment/${id}` : '/admin/recruitment' },
              { label: 'hồ sơ ứng tuyển' },
            ]}
          />
        }
        aside={
          <div className="flex flex-wrap items-center gap-3">
            {id && (
              <Link to={`/admin/recruitment/${id}`} className={buttonClass('outline')}>
                &larr; Chi tiết đợt
              </Link>
            )}
            <button
              type="button"
              onClick={handleExportCsv}
              disabled={exporting || loading}
              className={buttonClass('light')}
            >
              {exporting ? 'Đang xuất CSV...' : 'Xuất danh sách CSV'}
            </button>
          </div>
        }
      />

      <main className="mx-auto max-w-container-max px-gutter py-10 md:py-14">
        {exportError && (
          <div className="mb-6 rounded-xl border-2 border-apc-red bg-apc-red-pale/50 p-4 font-bold text-apc-red">
            {exportError}
          </div>
        )}

        {exportResult && (
          <div className="mb-6">
            <ExportStatus
              id={exportResult.id}
              status={exportResult.status}
              filename={exportResult.filename}
              expiresAt={exportResult.expiresAt}
            />
          </div>
        )}

        {/* Khu vực lọc & Tìm kiếm */}
        <div className="rounded-[20px] bg-soft p-6">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            {/* Tabs trạng thái */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-code text-xs font-bold uppercase text-muted">Trạng thái:</span>
              {STATUS_TABS.map((tab) => (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => handleStatusChange(tab.value)}
                  className={pillClass(statusParam === tab.value)}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Dropdown lọc ban (cho BOARD) & Form tìm kiếm */}
            <div className="flex flex-wrap items-center gap-3">
              {isBoard && departments.length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="font-code text-xs font-bold uppercase text-muted">Ban:</span>
                  <select
                    value={departmentIdParam}
                    onChange={(e) => handleDepartmentChange(e.target.value)}
                    className="rounded-xl border-2 border-ink bg-paper px-3 py-2 text-sm font-semibold text-ink focus:outline-none focus:ring-2 focus:ring-apc-blue"
                  >
                    <option value="">Tất cả ban</option>
                    {departments.map((dept) => (
                      <option key={dept.id} value={dept.id}>
                        {dept.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <form onSubmit={handleSearchSubmit} className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Tìm họ tên, email, MSSV..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  className={`${inputClass} w-64 text-sm`}
                />
                <button type="submit" className={buttonClass('outline')}>
                  Tìm
                </button>
                {searchParam && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchInput('')
                      updateQuery({ search: null })
                    }}
                    className="text-xs font-bold text-muted hover:text-ink hover:underline"
                  >
                    Xóa tìm
                  </button>
                )}
              </form>
            </div>
          </div>
        </div>

        {/* Nội dung danh sách ứng viên */}
        <div className="mt-8">
          <AsyncState
            loading={loading}
            error={error}
            empty={applications.length === 0}
            emptyText="Không tìm thấy hồ sơ ứng tuyển nào phù hợp với bộ lọc."
            onRetry={reload}
          >
            <div className="overflow-x-auto rounded-[20px] border-2 border-ink bg-paper">
              <table className="w-full text-left text-sm text-ink">
                <thead className="border-b-2 border-ink bg-soft font-code text-xs font-bold uppercase text-muted">
                  <tr>
                    <th className="px-6 py-4">Mã hồ sơ</th>
                    <th className="px-6 py-4">Ứng viên</th>
                    <th className="px-6 py-4">Ban mong muốn</th>
                    <th className="px-6 py-4">Trạng thái</th>
                    <th className="px-6 py-4">Ngày nộp</th>
                    <th className="px-6 py-4">Người duyệt</th>
                    <th className="px-6 py-4 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink/10">
                  {applications.map((app) => {
                    const statusInfo = STATUS_CONFIG[app.status] ?? {
                      label: app.status,
                      badgeClass: 'bg-soft text-ink font-bold',
                    }
                    return (
                      <tr
                        key={app.id}
                        data-rv
                        className="transition-colors hover:bg-soft/60"
                      >
                        <td className="px-6 py-4 font-mono font-bold text-ink">
                          {app.profileCode}
                        </td>
                        <td className="px-6 py-4">
                          <div className="font-bold text-ink">{app.applicantName}</div>
                          <div className="text-xs text-muted">{app.applicantEmail}</div>
                          <div className="font-mono text-xs text-muted">MSSV: {app.studentId}</div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="inline-block rounded-md bg-soft px-2.5 py-1 text-xs font-bold text-ink">
                            {app.desiredDepartment?.name ?? 'Chưa chọn'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`inline-block rounded-full px-3 py-1 text-xs ${statusInfo.badgeClass}`}
                          >
                            {statusInfo.label}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-xs text-muted">
                          {formatDateTime(app.submittedAt)}
                        </td>
                        <td className="px-6 py-4 text-xs">
                          {app.reviewedBy ? (
                            <span className="font-semibold text-ink">{app.reviewedBy.fullName}</span>
                          ) : (
                            <span className="text-muted">—</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <Link
                            to={`/admin/recruitment/${id}/applications/${app.id}`}
                            className="font-bold text-apc-blue hover:underline"
                          >
                            Chi tiết &rarr;
                          </Link>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Phân trang */}
            {data && data.total > data.pageSize && (
              <div className="mt-8 flex justify-center">
                <Pagination
                  currentPage={data.page}
                  totalPages={Math.ceil(data.total / data.pageSize)}
                  onPageChange={handlePageChange}
                />
              </div>
            )}
          </AsyncState>
        </div>
      </main>
    </div>
  )
}

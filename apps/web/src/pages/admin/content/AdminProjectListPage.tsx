import { Link, useSearchParams } from 'react-router-dom'

import { AsyncState } from '../../../components/AsyncState.js'
import { Button } from '../../../components/Button.js'
import { buttonClass } from '../../../components/buttonClass.js'
import { inputClass, labelClass } from '../../../components/formClass.js'
import { Pagination } from '../../../components/Pagination.js'
import { useApi } from '../../../hooks/useApi.js'
import { useAuth } from '../../../hooks/useAuth.js'
import type { Page } from '../../../lib/api.js'
import { hasRole } from '../../../lib/auth.js'
import { formatDateTime } from '../../../lib/format.js'
import type { AboutData } from '../../about/types.js'
import { departmentLabel } from './postTypes.js'
import {
  type AdminProjectRow,
  type ProjectStatus,
  type ProjectType,
  PROJECT_STATUS_LABEL,
  PROJECT_TYPE_LABEL,
  projectStatusBadgeClass,
  projectTypeBadgeClass,
} from './projectTypes.js'

const PAGE_SIZE = 20
const STATUSES = Object.keys(PROJECT_STATUS_LABEL) as ProjectStatus[]
const TYPES = Object.keys(PROJECT_TYPE_LABEL) as ProjectType[]

// Bộ lọc nằm trên URL (status, type, departmentId, page) để tải lại trang hay chia sẻ link vẫn giữ nguyên kết quả;
// khớp query mà `adminProjectListQuery` chấp nhận.

function FilterSelect({
  id,
  label,
  value,
  options,
  onChange,
}: {
  id: string
  label: string
  value: string
  options: { value: string; label: string }[]
  onChange: (value: string) => void
}) {
  return (
    <label className={labelClass} htmlFor={id}>
      {label}
      <select id={id} className={inputClass} value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">Tất cả</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  )
}

/** PAGE-MGT-PRJ-01 — danh sách dự án quản trị (C4): lọc trạng thái, loại và (chỉ BOARD) ban; phân trang. */
export function AdminProjectListPage() {
  const { user } = useAuth()
  const board = hasRole(user, 'BOARD')
  const [searchParams, setSearchParams] = useSearchParams()
  const page = Math.max(1, Number(searchParams.get('page')) || 1)
  const status = searchParams.get('status') ?? ''
  const type = searchParams.get('type') ?? ''
  const departmentId = searchParams.get('departmentId') ?? ''

  // Danh sách ban lấy từ API công khai để bộ lọc ban của BOARD có đủ ban.
  const about = useApi<AboutData>('/public/about')
  const departments = about.data?.departments ?? []

  const query = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) })
  if (status) query.set('status', status)
  if (type) query.set('type', type)
  if (departmentId) query.set('departmentId', departmentId)
  const projects = useApi<Page<AdminProjectRow>>(`/admin/content/projects?${query}`)

  function update(changes: Record<string, string>) {
    const next = new URLSearchParams(searchParams)
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value)
      else next.delete(key)
    }
    // Đổi bộ lọc thì về trang 1; chỉ giữ trang khi chính nút phân trang đổi nó.
    if (!('page' in changes)) next.delete('page')
    setSearchParams(next)
  }

  const filtered = !!status || !!type || !!departmentId
  const items = projects.data?.items ?? []
  const totalPages = Math.ceil((projects.data?.total ?? 0) / PAGE_SIZE)

  return (
    <main className="flex flex-col gap-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-[clamp(32px,4vw,56px)] font-extrabold leading-none tracking-[-0.03em]">
            Dự án và sản phẩm
          </h1>
          <p className="mt-3 max-w-[70ch] text-[17px] text-muted">
            {board
              ? 'Soạn, xem trước, công bố, gỡ và lưu trữ dự án và sản phẩm của toàn CLB.'
              : 'Soạn và sửa dự án ở trạng thái Ẩn của ban; công bố, gỡ và lưu trữ do Ban Chủ nhiệm thực hiện.'}
          </p>
        </div>
        <Link to="/admin/content/projects/new" className={buttonClass('primary')}>
          + Thêm dự án
        </Link>
      </div>

      <div className={board ? 'grid gap-4 sm:grid-cols-2 lg:grid-cols-3' : 'grid gap-4 sm:grid-cols-2'}>
        <FilterSelect
          id="project-status"
          label="trạng thái"
          value={status}
          options={STATUSES.map((value) => ({ value, label: PROJECT_STATUS_LABEL[value] }))}
          onChange={(value) => update({ status: value })}
        />
        <FilterSelect
          id="project-type"
          label="loại"
          value={type}
          options={TYPES.map((value) => ({ value, label: PROJECT_TYPE_LABEL[value] }))}
          onChange={(value) => update({ type: value })}
        />
        {board && (
          <FilterSelect
            id="project-department"
            label="ban"
            value={departmentId}
            options={departments.map((department) => ({ value: department.id, label: department.name }))}
            onChange={(value) => update({ departmentId: value })}
          />
        )}
      </div>

      <AsyncState
        loading={projects.loading}
        error={projects.error}
        empty={items.length === 0}
        emptyText={filtered ? 'Không có dự án khớp bộ lọc.' : 'Chưa có dự án nào.'}
        emptyAction={
          !filtered ? (
            <Link to="/admin/content/projects/new" className={buttonClass('primary')}>
              + Thêm dự án đầu tiên
            </Link>
          ) : undefined
        }
        onRetry={projects.reload}
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[880px] border-collapse text-left text-[16px] text-ink">
            <caption className="sr-only">Danh sách dự án, sắp theo ngày tạo mới nhất</caption>
            <thead>
              <tr className="border-b-2 border-ink font-code text-[13px] font-bold uppercase text-muted">
                <th scope="col" className="py-3 pr-4">
                  Dự án
                </th>
                <th scope="col" className="px-4 py-3">
                  Trạng thái
                </th>
                <th scope="col" className="px-4 py-3">
                  Ban
                </th>
                <th scope="col" className="px-4 py-3">
                  Cập nhật
                </th>
                <th scope="col" className="py-3 pl-4 text-right">
                  Thao tác
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink/10">
              {items.map((project) => (
                <tr key={project.id} className="align-top transition-colors hover:bg-soft">
                  <td className="py-4 pr-4">
                    <Link
                      to={`/admin/content/projects/${project.id}`}
                      className="font-display text-[19px] font-extrabold leading-snug transition-colors hover:text-apc-red"
                    >
                      {project.title}
                    </Link>
                    <span className="mt-1 block truncate font-code text-[13px] text-muted">/{project.slug}</span>
                    <span className="mt-2 block">
                      <span className={projectTypeBadgeClass(project.type)}>{PROJECT_TYPE_LABEL[project.type]}</span>
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <span className={projectStatusBadgeClass(project.status)}>
                      {PROJECT_STATUS_LABEL[project.status]}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-[15px]">{departmentLabel(departments, project.departmentId)}</td>
                  <td className="px-4 py-4 text-[15px] text-muted">
                    <span className="block">{formatDateTime(project.updatedAt)}</span>
                    {project.publishedAt ? (
                      <span className="block font-code text-[13px]">công bố {formatDateTime(project.publishedAt)}</span>
                    ) : null}
                  </td>
                  <td className="py-4 pl-4 text-right">
                    <span className="inline-flex flex-wrap justify-end gap-x-4 gap-y-1 font-body text-[15px] font-extrabold">
                      <Link
                        to={`/admin/content/projects/${project.id}`}
                        className="text-apc-blue underline decoration-2 underline-offset-4 hover:text-apc-red"
                      >
                        Sửa
                      </Link>
                      <Link
                        to={`/admin/content/projects/${project.id}/preview`}
                        className="text-apc-blue underline decoration-2 underline-offset-4 hover:text-apc-red"
                      >
                        Xem trước
                      </Link>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </AsyncState>

      {filtered && items.length === 0 && (
        <div>
          <Button variant="outline" onClick={() => setSearchParams(new URLSearchParams())}>
            Xóa bộ lọc
          </Button>
        </div>
      )}

      <Pagination currentPage={page} totalPages={totalPages} onPageChange={(next) => update({ page: String(next) })} />

      {!board && (
        <p className="rounded-2xl bg-soft px-5 py-4 text-[15px] text-muted">
          Bạn chỉ thấy dự án thuộc ban mình quản lý. Dự án toàn CLB (không thuộc ban nào) chỉ Ban Chủ nhiệm xem và
          công bố được.
        </p>
      )}
    </main>
  )
}

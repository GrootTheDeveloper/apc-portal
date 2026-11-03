import { Link, useSearchParams } from 'react-router-dom'

import { AsyncState } from '../../../components/AsyncState'
import { Button } from '../../../components/Button'
import { buttonClass } from '../../../components/buttonClass'
import { inputClass, labelClass } from '../../../components/formClass'
import { Pagination } from '../../../components/Pagination'
import { useApi } from '../../../hooks/useApi'
import { useAuth } from '../../../hooks/useAuth'
import type { Page } from '../../../lib/api'
import { hasRole } from '../../../lib/auth'
import { NEWS_CATEGORIES } from '../../../lib/content'
import { formatDateTime } from '../../../lib/format'
import type { AboutData } from '../../about/types'
import {
  type AdminPostRow,
  type ContentScope,
  type ContentStatus,
  SCOPE_LABEL,
  STATUS_LABEL,
  departmentLabel,
  scopeBadgeClass,
  statusBadgeClass,
} from './postTypes'

const PAGE_SIZE = 20
const STATUSES = Object.keys(STATUS_LABEL) as ContentStatus[]
const SCOPES = Object.keys(SCOPE_LABEL) as ContentScope[]

// Bộ lọc nằm trên URL (status, scope, category, departmentId, page) để tải lại trang hay chia sẻ link vẫn giữ
// nguyên kết quả; khớp query mà `adminPostListQuery` chấp nhận.

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

/** PAGE-MGT-POST-01 — danh sách bài viết quản trị (C3): lọc trạng thái, phạm vi, chuyên mục, ban; phân trang. */
export function AdminPostListPage() {
  const { user } = useAuth()
  const board = hasRole(user, 'BOARD')
  const [searchParams, setSearchParams] = useSearchParams()
  const page = Math.max(1, Number(searchParams.get('page')) || 1)
  const status = searchParams.get('status') ?? ''
  const scope = searchParams.get('scope') ?? ''
  const category = searchParams.get('category') ?? ''
  const departmentId = searchParams.get('departmentId') ?? ''

  // Danh sách ban lấy từ API công khai để quản lý ban cũng lọc được (route /admin/accounts/departments chỉ BOARD).
  const about = useApi<AboutData>('/public/about')
  const departments = about.data?.departments ?? []

  const query = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) })
  if (status) query.set('status', status)
  if (scope) query.set('scope', scope)
  if (category) query.set('category', category)
  if (departmentId) query.set('departmentId', departmentId)
  const posts = useApi<Page<AdminPostRow>>(`/admin/content/posts?${query}`)

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

  const filtered = !!status || !!scope || !!category || !!departmentId
  const items = posts.data?.items ?? []
  const totalPages = Math.ceil((posts.data?.total ?? 0) / PAGE_SIZE)

  return (
    <main className="flex flex-col gap-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-[clamp(32px,4vw,56px)] font-extrabold leading-none tracking-[-0.03em]">
            Bài viết và thông báo
          </h1>
          <p className="mt-3 max-w-[70ch] text-[17px] text-muted">
            {board
              ? 'Soạn, xem trước, công bố, gỡ và lưu trữ tin công khai lẫn thông báo nội bộ.'
              : 'Soạn và xem trước bản nháp của ban; công bố thông báo nội bộ của ban. Tin công khai do Ban Chủ nhiệm công bố.'}
          </p>
        </div>
        <Link to="/admin/content/posts/new" className={buttonClass('primary')}>
          + Viết bài mới
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <FilterSelect
          id="post-status"
          label="trạng thái"
          value={status}
          options={STATUSES.map((value) => ({ value, label: STATUS_LABEL[value] }))}
          onChange={(value) => update({ status: value })}
        />
        <FilterSelect
          id="post-scope"
          label="phạm vi"
          value={scope}
          options={SCOPES.map((value) => ({ value, label: SCOPE_LABEL[value] }))}
          onChange={(value) => update({ scope: value })}
        />
        <FilterSelect
          id="post-category"
          label="chuyên mục"
          value={category}
          options={NEWS_CATEGORIES.map((value) => ({ value, label: value }))}
          onChange={(value) => update({ category: value })}
        />
        <FilterSelect
          id="post-department"
          label="ban"
          value={departmentId}
          options={departments.map((department) => ({ value: department.id, label: department.name }))}
          onChange={(value) => update({ departmentId: value })}
        />
      </div>

      <AsyncState
        loading={posts.loading}
        error={posts.error}
        empty={items.length === 0}
        emptyText={filtered ? 'Không có bài viết khớp bộ lọc.' : 'Chưa có bài viết nào.'}
        onRetry={posts.reload}
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[880px] border-collapse text-left text-[16px] text-ink">
            <caption className="sr-only">Danh sách bài viết, sắp theo ngày tạo mới nhất</caption>
            <thead>
              <tr className="border-b-2 border-ink font-code text-[13px] font-bold uppercase text-muted">
                <th scope="col" className="py-3 pr-4">
                  Bài viết
                </th>
                <th scope="col" className="px-4 py-3">
                  Trạng thái
                </th>
                <th scope="col" className="px-4 py-3">
                  Phạm vi
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
              {items.map((post) => (
                <tr key={post.id} className="align-top transition-colors hover:bg-soft">
                  <td className="py-4 pr-4">
                    <Link
                      to={`/admin/content/posts/${post.id}`}
                      className="font-display text-[19px] font-extrabold leading-snug transition-colors hover:text-apc-red"
                    >
                      {post.title}
                    </Link>
                    <span className="mt-1 block truncate font-code text-[13px] text-muted">/{post.slug}</span>
                    <span className="mt-1 block font-code text-[13px] text-muted">{post.category}</span>
                  </td>
                  <td className="px-4 py-4">
                    <span className={statusBadgeClass(post.status)}>{STATUS_LABEL[post.status]}</span>
                  </td>
                  <td className="px-4 py-4">
                    <span className={scopeBadgeClass(post.scope)}>{SCOPE_LABEL[post.scope]}</span>
                  </td>
                  <td className="px-4 py-4 text-[15px]">{departmentLabel(departments, post.departmentId)}</td>
                  <td className="px-4 py-4 text-[15px] text-muted">
                    <span className="block">{formatDateTime(post.updatedAt)}</span>
                    {post.publishedAt ? (
                      <span className="block font-code text-[13px]">công bố {formatDateTime(post.publishedAt)}</span>
                    ) : null}
                  </td>
                  <td className="py-4 pl-4 text-right">
                    <span className="inline-flex flex-wrap justify-end gap-x-4 gap-y-1 font-body text-[15px] font-extrabold">
                      <Link to={`/admin/content/posts/${post.id}`} className="text-apc-blue underline decoration-2 underline-offset-4 hover:text-apc-red">
                        Sửa
                      </Link>
                      <Link
                        to={`/admin/content/posts/${post.id}/preview`}
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
          Bạn chỉ thấy bài thuộc ban mình quản lý. Bài toàn CLB (không thuộc ban nào) chỉ Ban Chủ nhiệm xem và công bố được.
        </p>
      )}
    </main>
  )
}

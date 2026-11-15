import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

import { AsyncState } from '../../../../components/AsyncState'
import { Button } from '../../../../components/Button'
import { buttonClass } from '../../../../components/buttonClass'
import { inputClass, labelClass } from '../../../../components/formClass'
import { PageHero } from '../../../../components/PageHero'
import { Pagination } from '../../../../components/Pagination'
import { useApi } from '../../../../hooks/useApi'
import { useAuth } from '../../../../hooks/useAuth'
import type { Page } from '../../../../lib/api'
import { hasRole } from '../../../../lib/auth'
import { formatDate } from '../../../../lib/format'
import {
  ACCOUNT_STATUS_LABEL,
  MEMBER_STATUS_LABEL,
  type MemberListItem,
  type MemberStatus,
  ROLE_LABEL,
  type RoleName,
} from '../members.types'

const PAGE_SIZE = 20

export function AdminMemberListPage() {
  const { user } = useAuth()
  const isBoard = hasRole(user, 'BOARD')
  const [searchParams, setSearchParams] = useSearchParams()

  const page = Math.max(1, Number.parseInt(searchParams.get('page') ?? '1', 10) || 1)
  const q = searchParams.get('q') ?? ''
  const departmentId = searchParams.get('departmentId') ?? ''
  const role = (searchParams.get('role') ?? '') as RoleName | ''
  const status = (searchParams.get('status') ?? '') as MemberStatus | ''

  const [searchDraft, setSearchDraft] = useState(q)

  // Tải danh sách ban cho dropdown lọc
  const departmentsApi = useApi<{ id: string; name: string }[]>(isBoard ? '/admin/accounts/departments' : null)

  const queryParams = new URLSearchParams()
  queryParams.set('page', String(page))
  queryParams.set('pageSize', String(PAGE_SIZE))
  if (q) queryParams.set('q', q)
  if (departmentId) queryParams.set('departmentId', departmentId)
  if (role) queryParams.set('role', role)
  if (status) queryParams.set('status', status)

  const membersApi = useApi<Page<MemberListItem>>(`/admin/members?${queryParams.toString()}`)

  function updateQuery(updates: Record<string, string | null>) {
    const next = new URLSearchParams(searchParams)
    for (const [key, val] of Object.entries(updates)) {
      if (val === null || val === '') {
        next.delete(key)
      } else {
        next.set(key, val)
      }
    }
    // Đổi bộ lọc thì reset về trang 1
    if (!('page' in updates)) {
      next.delete('page')
    }
    setSearchParams(next)
  }

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault()
    updateQuery({ q: searchDraft.trim() || null })
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <PageHero
          comment="quản trị thành viên"
          title="Danh sách thành viên"
          lede="Xem, tìm kiếm, lọc và quản lý thông tin thành viên câu lạc bộ APC."
        />

        {/* Nút Xuất CSV cho D5 — CHỈ HIỂN THỊ VỚI BOARD */}
        {isBoard && (
          <div className="flex-shrink-0">
            {/* Chừa chỗ nút Xuất CSV cho D5 (Phạm Đăng Hoàng Thiên) */}
            <Button
              variant="outline"
              onClick={() => {
                alert('Tính năng Xuất CSV sẽ được tích hợp bởi việc D5.')
              }}
              title="Xuất danh sách thành viên ra file CSV (D5)"
            >
              <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Xuất CSV
            </Button>
          </div>
        )}
      </div>

      {/* Bộ lọc */}
      <div className="bg-white p-4 rounded-lg border border-neutral-200 space-y-4">
        <form onSubmit={handleSearchSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className={labelClass}>Tìm kiếm</label>
            <div className="flex gap-2">
              <input
                type="text"
                className={inputClass}
                placeholder="Họ tên, MSSV, email..."
                value={searchDraft}
                onChange={(e) => setSearchDraft(e.target.value)}
              />
              <Button type="submit" variant="primary">
                Tìm
              </Button>
            </div>
          </div>

          {/* Ban chuyên môn: BOARD được chọn mọi ban, Quản lý ban bị giới hạn ban của mình */}
          {isBoard ? (
            <div>
              <label className={labelClass}>Ban chuyên môn</label>
              <select
                className={inputClass}
                value={departmentId}
                onChange={(e) => updateQuery({ departmentId: e.target.value || null })}
              >
                <option value="">Tất cả các ban</option>
                {departmentsApi.data?.map((dept) => (
                  <option key={dept.id} value={dept.id}>
                    {dept.name}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div>
              <label className={labelClass}>Phạm vi</label>
              <input
                type="text"
                className={inputClass}
                value="Trong ban quản lý"
                disabled
              />
            </div>
          )}

          <div>
            <label className={labelClass}>Trạng thái thành viên</label>
            <select
              className={inputClass}
              value={status}
              onChange={(e) => updateQuery({ status: e.target.value || null })}
            >
              <option value="">Tất cả trạng thái</option>
              <option value="ACTIVE">{MEMBER_STATUS_LABEL.ACTIVE}</option>
              <option value="PAUSED">{MEMBER_STATUS_LABEL.PAUSED}</option>
              <option value="LEFT">{MEMBER_STATUS_LABEL.LEFT}</option>
            </select>
          </div>

          <div>
            <label className={labelClass}>Vai trò</label>
            <select
              className={inputClass}
              value={role}
              onChange={(e) => updateQuery({ role: e.target.value || null })}
            >
              <option value="">Tất cả vai trò</option>
              <option value="MEMBER">{ROLE_LABEL.MEMBER}</option>
              <option value="DEPARTMENT_MANAGER">{ROLE_LABEL.DEPARTMENT_MANAGER}</option>
              <option value="BOARD">{ROLE_LABEL.BOARD}</option>
              <option value="TECH_ADMIN">{ROLE_LABEL.TECH_ADMIN}</option>
            </select>
          </div>
        </form>
      </div>

      {/* Danh sách thành viên */}
      <AsyncState
        loading={membersApi.loading}
        error={membersApi.error}
        empty={!membersApi.data || membersApi.data.items.length === 0}
        emptyText="Không tìm thấy thành viên nào phù hợp với bộ lọc hiện tại."
        onRetry={membersApi.reload}
      >
        {membersApi.data && (
          <div className="space-y-4">
            <div className="overflow-x-auto bg-white rounded-lg border border-neutral-200">
              <table className="min-w-full divide-y divide-neutral-200 text-sm">
                <thead className="bg-neutral-50 text-neutral-600 font-medium text-left">
                  <tr>
                    <th className="px-4 py-3">Họ và tên</th>
                    <th className="px-4 py-3">MSSV</th>
                    <th className="px-4 py-3">Ban</th>
                    <th className="px-4 py-3">Vai trò</th>
                    <th className="px-4 py-3">Trạng thái</th>
                    <th className="px-4 py-3">Tài khoản</th>
                    <th className="px-4 py-3">Ngày tham gia</th>
                    <th className="px-4 py-3 text-right">Chi tiết</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200">
                  {membersApi.data.items.map((member: MemberListItem) => (
                    <tr key={member.id} className="hover:bg-neutral-50 transition-colors">
                      <td className="px-4 py-3 font-medium text-neutral-900">
                        <div className="flex items-center gap-2">
                          {member.avatarUrl ? (
                            <img
                              src={member.avatarUrl}
                              alt={member.fullName}
                              className="w-8 h-8 rounded-full object-cover bg-neutral-100"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-neutral-200 flex items-center justify-center font-bold text-xs text-neutral-600">
                              {member.fullName.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div>
                            <div>{member.fullName}</div>
                            <div className="text-xs text-neutral-500 font-normal">{member.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-neutral-700 font-mono text-xs">
                        {member.studentId || '—'}
                      </td>
                      <td className="px-4 py-3 text-neutral-700">
                        {member.department?.name || 'Chưa gán'}
                      </td>
                      <td className="px-4 py-3 text-neutral-700">
                        <div className="flex flex-wrap gap-1">
                          {member.roles.map((r, idx) => (
                            <span
                              key={idx}
                              className="inline-block px-2 py-0.5 text-xs rounded bg-neutral-100 text-neutral-700"
                            >
                              {ROLE_LABEL[r.role]}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-block px-2 py-0.5 text-xs font-medium rounded ${
                            member.memberStatus === 'ACTIVE'
                              ? 'bg-emerald-100 text-emerald-800'
                              : member.memberStatus === 'PAUSED'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-neutral-200 text-neutral-700'
                          }`}
                        >
                          {MEMBER_STATUS_LABEL[member.memberStatus]}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-block px-2 py-0.5 text-xs font-medium rounded ${
                            member.accountStatus === 'ACTIVE'
                              ? 'bg-emerald-100 text-emerald-800'
                              : member.accountStatus === 'PENDING_ACTIVATION'
                                ? 'bg-blue-100 text-blue-800'
                                : member.accountStatus === 'LOCKED'
                                  ? 'bg-rose-100 text-rose-800'
                                  : 'bg-neutral-200 text-neutral-700'
                          }`}
                        >
                          {ACCOUNT_STATUS_LABEL[member.accountStatus]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-neutral-500 text-xs">
                        {formatDate(member.createdAt)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          to={`/admin/members/${member.id}`}
                          className={buttonClass('outline', 'text-xs !min-h-8 !px-3 !py-1')}
                        >
                          Xem
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <Pagination
              currentPage={membersApi.data.page}
              totalPages={Math.ceil(membersApi.data.total / membersApi.data.pageSize)}
              onPageChange={(p) => updateQuery({ page: String(p) })}
            />
          </div>
        )}
      </AsyncState>
    </div>
  )
}

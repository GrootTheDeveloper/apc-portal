import { type FormEvent, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { AsyncState } from '../../../../components/AsyncState'
import { Breadcrumb } from '../../../../components/Breadcrumb'
import { Button } from '../../../../components/Button'
import { ConfirmDialog } from '../../../../components/ConfirmDialog'
import { inputClass, labelClass } from '../../../../components/formClass'
import { useApi } from '../../../../hooks/useApi'
import { useAuth } from '../../../../hooks/useAuth'
import { api, ApiError } from '../../../../lib/api'
import { hasRole } from '../../../../lib/auth'
import { formatDate, formatDateTime } from '../../../../lib/format'
import { fieldErrors } from '../../../../lib/formErrors'
import {
  ACCOUNT_STATUS_LABEL,
  ATTENDANCE_STATUS_LABEL,
  type MemberDetail,
  MEMBER_STATUS_LABEL,
  type MemberStatus,
  ROLE_LABEL,
} from '../members.types'

type TabKey = 'profile' | 'organization' | 'activity'

function MemberEditForm({
  detail,
  departments,
  onReload,
}: {
  detail: MemberDetail
  departments: { id: string; name: string }[]
  onReload: () => void
}) {
  const [formDraft, setFormDraft] = useState({
    studentId: detail.profile.studentId ?? '',
    email: detail.profile.email,
    departmentId: detail.organization.department?.id ?? '',
    memberStatus: detail.organization.memberStatus,
    reason: '',
  })

  const [pending, setPending] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [fieldIssueMap, setFieldIssueMap] = useState<Record<string, string[]>>({})
  const [confirmLeftOpen, setConfirmLeftOpen] = useState(false)

  function resetForm() {
    setFormDraft({
      studentId: detail.profile.studentId ?? '',
      email: detail.profile.email,
      departmentId: detail.organization.department?.id ?? '',
      memberStatus: detail.organization.memberStatus,
      reason: '',
    })
    setErrorMessage(null)
    setSuccessMessage(null)
    setFieldIssueMap({})
  }

  async function executeSave(payload: {
    studentId?: string | null
    email?: string
    departmentId?: string | null
    memberStatus?: MemberStatus
    reason: string
  }) {
    setPending(true)
    setErrorMessage(null)
    setSuccessMessage(null)
    setFieldIssueMap({})

    try {
      await api(`/admin/members/${detail.profile.id}`, {
        method: 'PATCH',
        body: { ...payload, updatedAt: detail.profile.updatedAt },
      })
      setSuccessMessage('Cập nhật thông tin thành viên thành công.')
      onReload()
    } catch (caught) {
      if (caught instanceof ApiError) {
        if (caught.status === 409) {
          setErrorMessage(caught.message || 'Xung đột dữ liệu. Vui lòng thử lại.')
        } else if (caught.status === 422) {
          setErrorMessage('Vui lòng kiểm tra lại thông tin nhập vào.')
          setFieldIssueMap(fieldErrors(caught))
        } else {
          setErrorMessage(caught.message || 'Có lỗi xảy ra khi lưu.')
        }
      } else {
        setErrorMessage('Không thể kết nối đến máy chủ.')
      }
    } finally {
      setPending(false)
    }
  }

  function handleFormSubmit(e: FormEvent) {
    e.preventDefault()

    // QĐ-3: Nếu chọn chuyển sang LEFT, yêu cầu mở modal xác nhận mạnh
    if (formDraft.memberStatus === 'LEFT') {
      setConfirmLeftOpen(true)
      return
    }

    executeSave({
      studentId: formDraft.studentId.trim() || null,
      email: formDraft.email.trim() || undefined,
      departmentId: formDraft.departmentId || null,
      memberStatus: formDraft.memberStatus,
      reason: formDraft.reason.trim(),
    })
  }

  return (
    <div className="bg-white p-6 rounded-lg border border-neutral-200">
      <h2 className="text-lg font-semibold text-neutral-900 mb-4">
        Cập nhật ban, trạng thái và thông tin quản lý (BOARD)
      </h2>

      {errorMessage && (
        <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-800 text-sm rounded">
          {errorMessage}
        </div>
      )}

      {successMessage && (
        <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm rounded">
          {successMessage}
        </div>
      )}

      <form onSubmit={handleFormSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Mã số sinh viên (MSSV)</label>
            <input
              type="text"
              className={inputClass}
              value={formDraft.studentId}
              onChange={(e) => setFormDraft({ ...formDraft, studentId: e.target.value })}
              placeholder="SV123456"
              disabled={pending}
            />
            {fieldIssueMap.studentId && (
              <p className="text-xs text-rose-600 mt-1">{fieldIssueMap.studentId[0]}</p>
            )}
          </div>

          <div>
            <label className={labelClass}>Email tài khoản (đối chiếu & thông báo)</label>
            <input
              type="email"
              className={inputClass}
              value={formDraft.email}
              onChange={(e) => setFormDraft({ ...formDraft, email: e.target.value })}
              required
              disabled={pending}
            />
            {fieldIssueMap.email && (
              <p className="text-xs text-rose-600 mt-1">{fieldIssueMap.email[0]}</p>
            )}
          </div>

          <div>
            <label className={labelClass}>Ban chuyên môn</label>
            <select
              className={inputClass}
              value={formDraft.departmentId}
              onChange={(e) => setFormDraft({ ...formDraft, departmentId: e.target.value })}
              disabled={pending}
            >
              <option value="">Chưa gán ban</option>
              {departments.map((dept) => (
                <option key={dept.id} value={dept.id}>
                  {dept.name}
                </option>
              ))}
            </select>
            <p className="text-xs text-neutral-500 mt-1">
              Chú ý: Đổi sang ban khác sẽ tự động thu hồi vai trò Quản lý ban cũ nếu có (RP-08).
            </p>
          </div>

          <div>
            <label className={labelClass}>Trạng thái thành viên</label>
            <select
              className={inputClass}
              value={formDraft.memberStatus}
              onChange={(e) =>
                setFormDraft({
                  ...formDraft,
                  memberStatus: e.target.value as MemberStatus,
                })
              }
              disabled={pending || detail.organization.memberStatus === 'LEFT'}
            >
              {detail.organization.memberStatus === 'LEFT' ? (
                <option value="LEFT">Ngừng tham gia (Không thể đổi lại)</option>
              ) : (
                <>
                  <option value="ACTIVE">{MEMBER_STATUS_LABEL.ACTIVE}</option>
                  <option value="PAUSED">{MEMBER_STATUS_LABEL.PAUSED}</option>
                  <option value="LEFT">{MEMBER_STATUS_LABEL.LEFT}</option>
                </>
              )}
            </select>
            {detail.organization.memberStatus === 'LEFT' && (
              <p className="text-xs text-neutral-500 mt-1">
                Thành viên đã ngừng tham gia không thể kích hoạt lại.
              </p>
            )}
          </div>
        </div>

        <div>
          <label className={labelClass}>
            Lý do thay đổi <span className="text-rose-500">*</span>
          </label>
          <textarea
            className={inputClass}
            rows={3}
            placeholder="Nhập lý do thực hiện thao tác (bắt buộc để ghi audit log)..."
            value={formDraft.reason}
            onChange={(e) => setFormDraft({ ...formDraft, reason: e.target.value })}
            required
            disabled={pending}
          />
          {fieldIssueMap.reason && (
            <p className="text-xs text-rose-600 mt-1">{fieldIssueMap.reason[0]}</p>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={resetForm} disabled={pending}>
            Khôi phục
          </Button>
          <Button type="submit" variant="primary" disabled={pending}>
            {pending ? 'Đang lưu...' : 'Lưu thay đổi'}
          </Button>
        </div>
      </form>

      {/* Modal xác nhận mạnh khi chuyển sang Ngừng tham gia (QĐ-3, RP-09) */}
      <ConfirmDialog
        open={confirmLeftOpen}
        title="Xác nhận chuyển sang Ngừng tham gia"
        description={
          <div className="space-y-2 text-sm text-neutral-700">
            <p className="font-semibold text-rose-700">
              Cảnh báo: Hành động này có tính chất vĩnh viễn và không thể hoàn tác!
            </p>
            <p>
              Khi thành viên chuyển sang <strong>Ngừng tham gia</strong>:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Tài khoản sẽ lập tức chuyển sang trạng thái <strong>Ngừng hoạt động (INACTIVE)</strong>.</li>
              <li>Toàn bộ phiên đăng nhập trên mọi thiết bị sẽ bị thu hồi ngay lập tức (đăng xuất).</li>
              <li>Mọi vai trò quản lý và đặc quyền của người này sẽ bị thu hồi vĩnh viễn (`REVOKED`).</li>
              <li>Hồ sơ lịch sử tham gia sự kiện vẫn được giữ lại.</li>
            </ul>
          </div>
        }
        confirmLabel="Xác nhận Ngừng tham gia"
        danger
        reason="required"
        onConfirm={async ({ reason }) => {
          await executeSave({
            studentId: formDraft.studentId.trim() || null,
            email: formDraft.email.trim() || undefined,
            departmentId: formDraft.departmentId || null,
            memberStatus: 'LEFT',
            reason,
          })
          setConfirmLeftOpen(false)
        }}
        onClose={() => setConfirmLeftOpen(false)}
      />
    </div>
  )
}

export function AdminMemberDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const isBoard = hasRole(user, 'BOARD')

  const [activeTab, setActiveTab] = useState<TabKey>('profile')
  const memberApi = useApi<MemberDetail>(id ? `/admin/members/${id}` : null)
  const departmentsApi = useApi<{ id: string; name: string }[]>(isBoard ? '/admin/accounts/departments' : null)

  const detail = memberApi.data

  return (
    <div className="space-y-6">
      <Breadcrumb
        items={[
          { label: 'Quản trị', to: '/admin' },
          { label: 'Thành viên', to: '/admin/members' },
          { label: 'Chi tiết thành viên' },
        ]}
      />

      <AsyncState
        loading={memberApi.loading}
        error={memberApi.error}
        empty={!detail}
        emptyText="Không tìm thấy thông tin thành viên."
        onRetry={memberApi.reload}
      >
        {detail && (
          <div className="space-y-6">
            {/* Header chi tiết */}
            <div className="bg-white p-6 rounded-lg border border-neutral-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                {detail.profile.avatarUrl ? (
                  <img
                    src={detail.profile.avatarUrl}
                    alt={detail.profile.fullName}
                    className="w-16 h-16 rounded-full object-cover bg-neutral-100"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-neutral-200 flex items-center justify-center font-bold text-xl text-neutral-600">
                    {detail.profile.fullName.charAt(0).toUpperCase()}
                  </div>
                )}
                <div>
                  <h1 className="text-xl font-bold text-neutral-900">{detail.profile.fullName}</h1>
                  <div className="text-sm text-neutral-500 font-mono">
                    MSSV: {detail.profile.studentId || 'Chưa cập nhật'}
                  </div>
                  <div className="flex flex-wrap gap-2 mt-2">
                    <span
                      className={`inline-block px-2.5 py-0.5 text-xs font-medium rounded ${
                        detail.organization.memberStatus === 'ACTIVE'
                          ? 'bg-emerald-100 text-emerald-800'
                          : detail.organization.memberStatus === 'PAUSED'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-neutral-200 text-neutral-700'
                      }`}
                    >
                      {MEMBER_STATUS_LABEL[detail.organization.memberStatus]}
                    </span>
                    <span className="inline-block px-2.5 py-0.5 text-xs font-medium rounded bg-neutral-100 text-neutral-800">
                      {detail.organization.department?.name || 'Chưa vào ban'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Link
                  to="/admin/members"
                  className="text-sm text-neutral-600 hover:text-neutral-900 px-3 py-1.5 rounded border border-neutral-300"
                >
                  ← Quay lại danh sách
                </Link>
              </div>
            </div>

            {/* Tabs navigation */}
            <div className="border-b border-neutral-200 flex gap-4">
              <button
                type="button"
                className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'profile'
                    ? 'border-neutral-900 text-neutral-900'
                    : 'border-transparent text-neutral-500 hover:text-neutral-700'
                }`}
                onClick={() => setActiveTab('profile')}
              >
                Hồ sơ quản lý
              </button>
              <button
                type="button"
                className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'organization'
                    ? 'border-neutral-900 text-neutral-900'
                    : 'border-transparent text-neutral-500 hover:text-neutral-700'
                }`}
                onClick={() => setActiveTab('organization')}
              >
                Ban và trạng thái
              </button>
              <button
                type="button"
                className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'activity'
                    ? 'border-neutral-900 text-neutral-900'
                    : 'border-transparent text-neutral-500 hover:text-neutral-700'
                }`}
                onClick={() => setActiveTab('activity')}
              >
                Lịch sử hoạt động
              </button>
            </div>

            {/* Tab 1: Hồ sơ quản lý */}
            {activeTab === 'profile' && (
              <div className="bg-white p-6 rounded-lg border border-neutral-200">
                <h2 className="text-lg font-semibold text-neutral-900 mb-4">Thông tin cá nhân & tài khoản</h2>
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 text-sm">
                  <div>
                    <dt className="text-neutral-500">Họ và tên</dt>
                    <dd className="font-medium text-neutral-900 mt-1">{detail.profile.fullName}</dd>
                  </div>
                  <div>
                    <dt className="text-neutral-500">Mã số sinh viên (MSSV)</dt>
                    <dd className="font-medium text-neutral-900 mt-1">{detail.profile.studentId || '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-neutral-500">Email tài khoản (nhận thông báo hệ thống)</dt>
                    <dd className="font-medium text-neutral-900 mt-1">{detail.profile.email}</dd>
                  </div>
                  <div>
                    <dt className="text-neutral-500">Email liên hệ (thành viên tự cập nhật)</dt>
                    <dd className="font-medium text-neutral-900 mt-1">{detail.profile.contactEmail || '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-neutral-500">Khoa / Ngành</dt>
                    <dd className="font-medium text-neutral-900 mt-1">
                      {[detail.profile.faculty, detail.profile.major].filter(Boolean).join(' - ') || '—'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-neutral-500">Niên khóa</dt>
                    <dd className="font-medium text-neutral-900 mt-1">{detail.profile.cohort || '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-neutral-500">Số điện thoại</dt>
                    <dd className="font-medium text-neutral-900 mt-1">{detail.profile.phoneNumber || '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-neutral-500">Trạng thái tài khoản</dt>
                    <dd className="font-medium text-neutral-900 mt-1">
                      {ACCOUNT_STATUS_LABEL[detail.profile.accountStatus]}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-neutral-500">Ngày tạo hồ sơ</dt>
                    <dd className="font-medium text-neutral-900 mt-1">{formatDate(detail.profile.createdAt)}</dd>
                  </div>
                  {detail.profile.deactivatedAt && (
                    <div>
                      <dt className="text-neutral-500">Ngày ngừng hoạt động</dt>
                      <dd className="font-medium text-neutral-900 mt-1">
                        {formatDateTime(detail.profile.deactivatedAt)}
                      </dd>
                    </div>
                  )}
                </dl>

                <div className="mt-6 pt-6 border-t border-neutral-200">
                  <h3 className="text-sm font-semibold text-neutral-900 mb-2">Kỹ năng</h3>
                  <p className="text-sm text-neutral-700">
                    {Array.isArray(detail.profile.skills)
                      ? detail.profile.skills.join(', ')
                      : typeof detail.profile.skills === 'string'
                        ? detail.profile.skills
                        : 'Chưa cập nhật'}
                  </p>
                </div>

                <div className="mt-4">
                  <h3 className="text-sm font-semibold text-neutral-900 mb-2">Lĩnh vực quan tâm</h3>
                  <p className="text-sm text-neutral-700">
                    {Array.isArray(detail.profile.interestAreas)
                      ? detail.profile.interestAreas.join(', ')
                      : typeof detail.profile.interestAreas === 'string'
                        ? detail.profile.interestAreas
                        : 'Chưa cập nhật'}
                  </p>
                </div>
              </div>
            )}

            {/* Tab 2: Ban và trạng thái */}
            {activeTab === 'organization' && (
              <div className="space-y-6">
                {/* Danh sách vai trò hiện tại */}
                <div className="bg-white p-6 rounded-lg border border-neutral-200">
                  <h2 className="text-lg font-semibold text-neutral-900 mb-4">Các vai trò hiện tại</h2>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-neutral-200 text-sm">
                      <thead className="bg-neutral-50 text-neutral-600 font-medium text-left">
                        <tr>
                          <th className="px-4 py-2.5">Vai trò</th>
                          <th className="px-4 py-2.5">Ban</th>
                          <th className="px-4 py-2.5">Trạng thái</th>
                          <th className="px-4 py-2.5">Ngày bắt đầu</th>
                          <th className="px-4 py-2.5">Ngày hết hạn</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-200">
                        {detail.organization.roles.map((r) => (
                          <tr key={r.id}>
                            <td className="px-4 py-2.5 font-medium text-neutral-900">{ROLE_LABEL[r.role]}</td>
                            <td className="px-4 py-2.5 text-neutral-700">{r.department?.name || '—'}</td>
                            <td className="px-4 py-2.5">
                              <span className="inline-block px-2 py-0.5 text-xs rounded bg-neutral-100 text-neutral-800">
                                {r.status}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 text-neutral-500 text-xs">
                              {formatDate(r.startsAt)}
                            </td>
                            <td className="px-4 py-2.5 text-neutral-500 text-xs">
                              {r.expiresAt ? formatDate(r.expiresAt) : 'Vô thời hạn'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Form chỉnh sửa: CHỈ BOARD MỚI ĐƯỢC PHÉP SỬA */}
                {isBoard ? (
                  <MemberEditForm
                    key={detail.profile.id}
                    detail={detail}
                    departments={departmentsApi.data ?? []}
                    onReload={memberApi.reload}
                  />
                ) : (
                  <div className="bg-neutral-50 p-4 rounded border border-neutral-200 text-sm text-neutral-600">
                    Chỉ Ban Chủ nhiệm (`BOARD`) mới có quyền chỉnh sửa ban, MSSV, email tài khoản và trạng thái thành viên.
                  </div>
                )}
              </div>
            )}

            {/* Tab 3: Lịch sử hoạt động */}
            {activeTab === 'activity' && (
              <div className="bg-white p-6 rounded-lg border border-neutral-200">
                <h2 className="text-lg font-semibold text-neutral-900 mb-4">Lịch sử sự kiện & Điểm danh</h2>
                {detail.activity.eventRegistrations.length === 0 ? (
                  <p className="text-sm text-neutral-500">Thành viên chưa đăng ký tham gia sự kiện nào.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-neutral-200 text-sm">
                      <thead className="bg-neutral-50 text-neutral-600 font-medium text-left">
                        <tr>
                          <th className="px-4 py-2.5">Sự kiện</th>
                          <th className="px-4 py-2.5">Thời gian</th>
                          <th className="px-4 py-2.5">Địa điểm</th>
                          <th className="px-4 py-2.5">Đăng ký</th>
                          <th className="px-4 py-2.5">Điểm danh</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-200">
                        {detail.activity.eventRegistrations.map((reg) => (
                          <tr key={reg.id}>
                            <td className="px-4 py-2.5 font-medium text-neutral-900">
                              {reg.event.title}
                            </td>
                            <td className="px-4 py-2.5 text-neutral-500 text-xs">
                              {formatDateTime(reg.event.startAt)}
                            </td>
                            <td className="px-4 py-2.5 text-neutral-700">
                              {reg.event.location || 'Online'}
                            </td>
                            <td className="px-4 py-2.5">
                              <span className="inline-block px-2 py-0.5 text-xs rounded bg-neutral-100 text-neutral-800">
                                {reg.status}
                              </span>
                            </td>
                            <td className="px-4 py-2.5">
                              <span
                                className={`inline-block px-2 py-0.5 text-xs font-medium rounded ${
                                  reg.attendanceStatus === 'PRESENT'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : reg.attendanceStatus === 'EXCUSED'
                                      ? 'bg-blue-100 text-blue-800'
                                      : reg.attendanceStatus === 'ABSENT'
                                        ? 'bg-rose-100 text-rose-800'
                                        : 'bg-neutral-100 text-neutral-700'
                                }`}
                              >
                                {ATTENDANCE_STATUS_LABEL[reg.attendanceStatus]}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </AsyncState>
    </div>
  )
}

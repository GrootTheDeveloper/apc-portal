import { useState } from 'react'

import { AsyncState } from '../../../components/AsyncState'
import { Button } from '../../../components/Button'
import { Eyebrow } from '../../../components/Eyebrow'
import { useApi } from '../../../hooks/useApi'
import { api, ApiError } from '../../../lib/api'
import { PortalNav } from '../PortalNav'

type ProfileData = {
  id: string
  username: string
  fullName: string
  email: string
  contactEmail: string | null
  avatarUrl: string | null
  studentId: string | null
  faculty: string | null
  major: string | null
  cohort: string | null
  phoneNumber: string | null
  skills: string[]
  interestAreas: string[]
  departmentId: string | null
  department: { id: string; name: string; code: string } | null
  memberStatus: 'ACTIVE' | 'PAUSED' | 'LEFT'
  updatedAt: string
  editableFields: readonly string[]
}

const MEMBER_STATUS_LABELS: Record<string, { label: string; className: string }> = {
  ACTIVE: { label: 'Đang hoạt động', className: 'bg-green-100 text-green-800' },
  PAUSED: { label: 'Tạm ngưng', className: 'bg-yellow-100 text-yellow-800' },
  LEFT: { label: 'Ngừng tham gia', className: 'bg-red-100 text-red-800' },
}

export function ProfilePage() {
  const { data: profile, loading, error, reload } = useApi<ProfileData>('/portal/me/profile')

  return (
    <main className="mx-auto max-w-container-max px-gutter py-8">
      <PortalNav
        breadcrumbs={[
          { label: 'Trang chủ', to: '/' },
          { label: 'Portal', to: '/portal' },
          { label: 'Hồ sơ của tôi', to: '/portal/profile' },
        ]}
      />

      <div className="mb-6">
        <Eyebrow>Hồ sơ cá nhân</Eyebrow>
        <h1 className="mt-2 text-2xl font-bold text-on-surface sm:text-3xl">Hồ sơ thành viên</h1>
        <p className="mt-1 text-sm text-on-surface-variant">
          Xem thông tin thành viên của bạn. Bạn có thể tự cập nhật email liên hệ, ảnh đại diện, kỹ năng và lĩnh vực
          quan tâm.
        </p>
      </div>

      <AsyncState loading={loading} error={error} empty={!profile} onRetry={reload}>
        {profile && <ProfileEditor profile={profile} onUpdated={reload} />}
      </AsyncState>
    </main>
  )
}

function ProfileEditor({ profile, onUpdated }: { profile: ProfileData; onUpdated: () => void }) {
  const [avatarUrl, setAvatarUrl] = useState(profile.avatarUrl ?? '')
  const [contactEmail, setContactEmail] = useState(profile.contactEmail ?? '')
  const [skillsText, setSkillsText] = useState(profile.skills.join(', '))
  const [interestAreasText, setInterestAreasText] = useState(profile.interestAreas.join(', '))

  const [saving, setSaving] = useState(false)
  const [conflictError, setConflictError] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setConflictError(null)
    setErrorMessage(null)
    setSuccessMessage(null)

    const skills = skillsText
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    const interestAreas = interestAreasText
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)

    try {
      await api<ProfileData>('/portal/me/profile', {
        method: 'PATCH',
        body: {
          avatarUrl: avatarUrl.trim() || null,
          contactEmail: contactEmail.trim() || null,
          skills,
          interestAreas,
          updatedAt: profile.updatedAt, // STATE-09: Kiểm tra xung đột phiên bản
        },
      })
      setSuccessMessage('Cập nhật hồ sơ thành công!')
      onUpdated()
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        if (err.status === 409) {
          // STATE-09: Xung đột phiên bản
          setConflictError(err.message)
        } else {
          setErrorMessage(err.message)
        }
      } else {
        setErrorMessage('Không thể lưu thông tin. Vui lòng thử lại.')
      }
    } finally {
      setSaving(false)
    }
  }

  const statusInfo = MEMBER_STATUS_LABELS[profile.memberStatus] ?? {
    label: profile.memberStatus,
    className: 'bg-surface-container-high text-on-surface-variant',
  }

  return (
    <div className="grid gap-8 lg:grid-cols-3">
      {/* Cột trái: Tóm tắt thông tin & Ảnh đại diện */}
      <div className="space-y-6">
        <div className="rounded-apc border border-outline-variant bg-surface-container-lowest p-6 text-center">
          <div className="mx-auto mb-4 h-28 w-28 overflow-hidden rounded-full border-2 border-outline-variant bg-surface-container-low">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={profile.fullName}
                className="h-full w-full object-cover"
                onError={(e) => {
                  ;(e.target as HTMLImageElement).src =
                    'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%2359413c"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>'
                }}
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-3xl font-bold text-apc-blue">
                {profile.fullName.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          <h2 className="text-xl font-bold text-on-surface">{profile.fullName}</h2>
          <p className="text-xs text-on-surface-variant font-mono mt-1">@{profile.username}</p>

          <div className="mt-3 flex justify-center">
            <span className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${statusInfo.className}`}>
              {statusInfo.label}
            </span>
          </div>

          <div className="mt-6 border-t border-outline-variant pt-4 text-left space-y-2 text-sm">
            <div>
              <span className="text-xs text-on-surface-variant">Ban chuyên môn</span>
              <p className="font-medium text-on-surface">{profile.department?.name ?? 'Chưa phân ban'}</p>
            </div>
            <div>
              <span className="text-xs text-on-surface-variant">Mã số sinh viên (MSSV)</span>
              <p className="font-medium text-on-surface">{profile.studentId ?? '—'}</p>
            </div>
            <div>
              <span className="text-xs text-on-surface-variant">Khoa / Ngành</span>
              <p className="font-medium text-on-surface">
                {profile.faculty ?? '—'} / {profile.major ?? '—'}
              </p>
            </div>
            <div>
              <span className="text-xs text-on-surface-variant">Niên khóa</span>
              <p className="font-medium text-on-surface">{profile.cohort ?? '—'}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Cột phải: Form cập nhật các trường được phép sửa */}
      <div className="lg:col-span-2">
        <form
          onSubmit={handleSubmit}
          className="rounded-apc border border-outline-variant bg-surface-container-lowest p-6 space-y-6"
        >
          {conflictError && (
            <div role="alert" className="rounded-apc border border-error bg-error-container/20 p-4 text-sm text-error">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">Phát hiện xung đột phiên bản (409)</p>
                  <p className="mt-1">{conflictError}</p>
                </div>
                <Button type="button" variant="outline" className="px-3 py-1 text-xs" onClick={onUpdated}>
                  Tải lại dữ liệu mới
                </Button>
              </div>
            </div>
          )}

          {errorMessage && (
            <div role="alert" className="rounded-apc border border-error bg-error-container/20 p-4 text-sm text-error">
              {errorMessage}
            </div>
          )}

          {successMessage && (
            <div
              role="status"
              className="rounded-apc border border-green-300 bg-green-50 p-4 text-sm text-green-800"
            >
              {successMessage}
            </div>
          )}

          <div>
            <h3 className="text-base font-semibold text-on-surface">Thông tin tài khoản (Chỉ đọc)</h3>
            <p className="text-xs text-on-surface-variant">
              Các trường này được Ban Chủ nhiệm quản lý. Nếu cần chỉnh sửa, vui lòng liên hệ Ban Chủ nhiệm.
            </p>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-medium text-on-surface-variant">Họ và tên</label>
                <input
                  type="text"
                  readOnly
                  disabled
                  value={profile.fullName}
                  className="mt-1 w-full rounded-apc border border-outline-variant bg-surface-container-low px-4 py-2.5 text-sm text-on-surface opacity-75 cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-on-surface-variant">Email tài khoản</label>
                <input
                  type="email"
                  readOnly
                  disabled
                  value={profile.email}
                  className="mt-1 w-full rounded-apc border border-outline-variant bg-surface-container-low px-4 py-2.5 text-sm text-on-surface opacity-75 cursor-not-allowed"
                />
                <p className="mt-1 text-[11px] text-on-surface-variant">Dùng để nhận email hệ thống & bảo mật</p>
              </div>
            </div>
          </div>

          <div className="border-t border-outline-variant pt-6">
            <h3 className="text-base font-semibold text-on-surface">Thông tin cá nhân (Có thể chỉnh sửa)</h3>
            <p className="text-xs text-on-surface-variant">
              Bạn có thể cập nhật ảnh đại diện, email liên hệ nội bộ, kỹ năng và lĩnh vực quan tâm.
            </p>

            <div className="mt-4 space-y-4">
              <div>
                <label htmlFor="avatarUrl" className="block text-xs font-medium text-on-surface">
                  Đường dẫn ảnh đại diện (Avatar URL)
                </label>
                <input
                  id="avatarUrl"
                  type="url"
                  placeholder="https://example.com/avatar.jpg"
                  value={avatarUrl}
                  onChange={(e) => setAvatarUrl(e.target.value)}
                  className="mt-1 w-full rounded-apc border border-outline-variant bg-surface px-4 py-2.5 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-apc-blue"
                />
                <p className="mt-1 text-[11px] text-on-surface-variant">
                  Nhập đường dẫn ảnh trực tiếp hoặc ảnh hợp lệ đã được quét an toàn.
                </p>
              </div>

              <div>
                <label htmlFor="contactEmail" className="block text-xs font-medium text-on-surface">
                  Email liên hệ
                </label>
                <input
                  id="contactEmail"
                  type="email"
                  placeholder="email.lien.he@example.com"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  className="mt-1 w-full rounded-apc border border-outline-variant bg-surface px-4 py-2.5 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-apc-blue"
                />
                <p className="mt-1 text-[11px] text-on-surface-variant">
                  Hiển thị trong hồ sơ quản lý để trưởng ban liên hệ với bạn. Không thay đổi email đăng nhập.
                </p>
              </div>

              <div>
                <label htmlFor="skills" className="block text-xs font-medium text-on-surface">
                  Kỹ năng (cách nhau bởi dấu phẩy)
                </label>
                <input
                  id="skills"
                  type="text"
                  placeholder="TypeScript, React, Python, UI/UX..."
                  value={skillsText}
                  onChange={(e) => setSkillsText(e.target.value)}
                  className="mt-1 w-full rounded-apc border border-outline-variant bg-surface px-4 py-2.5 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-apc-blue"
                />
              </div>

              <div>
                <label htmlFor="interestAreas" className="block text-xs font-medium text-on-surface">
                  Lĩnh vực quan tâm (cách nhau bởi dấu phẩy)
                </label>
                <input
                  id="interestAreas"
                  type="text"
                  placeholder="Web Development, Machine Learning, Open Source..."
                  value={interestAreasText}
                  onChange={(e) => setInterestAreasText(e.target.value)}
                  className="mt-1 w-full rounded-apc border border-outline-variant bg-surface px-4 py-2.5 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-apc-blue"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 border-t border-outline-variant pt-4">
            <Button
              type="button"
              variant="outline"
              className="px-6 py-2.5 text-sm"
              onClick={() => {
                setAvatarUrl(profile.avatarUrl ?? '')
                setContactEmail(profile.contactEmail ?? '')
                setSkillsText(profile.skills.join(', '))
                setInterestAreasText(profile.interestAreas.join(', '))
                setConflictError(null)
                setErrorMessage(null)
                setSuccessMessage(null)
              }}
              disabled={saving}
            >
              Đặt lại
            </Button>
            <Button type="submit" variant="primary" className="px-6 py-2.5 text-sm" disabled={saving}>
              {saving ? 'Đang lưu…' : 'Lưu thay đổi'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

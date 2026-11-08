import { useState } from 'react'

import { AsyncState } from '../../../components/AsyncState'
import { Button } from '../../../components/Button'
import { FileUpload } from '../../../components/FileUpload'
import { inputClass, labelClass } from '../../../components/formClass'
import { useApi } from '../../../hooks/useApi'
import { api, ApiError } from '../../../lib/api'
import { formatDate } from '../../../lib/format'

type RoleItem = {
  id: string
  role: string
  department?: { id: string; name: string; code: string } | null
  status: string
  startsAt: string
  expiresAt: string | null
  isBaseRole: boolean
}

type ProfileData = {
  id: string
  username: string
  fullName: string
  email: string
  contactEmail: string | null
  avatarUrl: string | null
  avatarProcessing: boolean
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
  roles: RoleItem[]
  updatedAt: string
  editableFields: readonly string[]
}

const MEMBER_STATUS_LABELS: Record<string, { label: string; className: string }> = {
  ACTIVE: { label: 'Đang hoạt động', className: 'bg-apc-blue-pale text-apc-blue' },
  PAUSED: { label: 'Tạm ngưng', className: 'bg-muted/10 text-muted' },
  LEFT: { label: 'Ngừng tham gia', className: 'bg-apc-red/10 text-apc-red' },
}

export function ProfilePage() {
  const { data: fetchedProfile, loading, error, reload } = useApi<ProfileData>('/portal/me/profile')
  const [overrideProfile, setOverrideProfile] = useState<ProfileData | null>(null)
  const profile = overrideProfile ?? fetchedProfile

  const handleReload = () => {
    setOverrideProfile(null)
    reload()
  }

  return (
    <main>
      <div>
        <span className="font-code text-xs font-bold uppercase tracking-wider text-muted">
          Hồ sơ cá nhân
        </span>
        <h1 className="mt-2 font-display text-[clamp(28px,3.5vw,48px)] font-extrabold leading-tight tracking-[-0.03em] text-ink">
          Hồ sơ thành viên
        </h1>
        <p className="mt-2 text-[17px] leading-relaxed text-muted">
          Xem thông tin thành viên của bạn. Bạn có thể tự cập nhật email liên hệ, ảnh đại diện, kỹ năng và lĩnh vực quan tâm.
        </p>
      </div>

      <div className="mt-8">
        <AsyncState loading={loading} error={error} empty={!profile} onRetry={handleReload}>
          {profile && (
            <ProfileEditor
              key={profile.updatedAt}
              profile={profile}
              onProfileUpdated={(updated) => setOverrideProfile(updated)}
              onReloadRequired={handleReload}
            />
          )}
        </AsyncState>
      </div>
    </main>
  )
}

function ProfileEditor({
  profile,
  onProfileUpdated,
  onReloadRequired,
}: {
  profile: ProfileData
  onProfileUpdated: (updated: ProfileData) => void
  onReloadRequired: () => void
}) {
  const [avatarFileId, setAvatarFileId] = useState<string | null | undefined>(undefined)
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(profile.avatarUrl)
  const [contactEmail, setContactEmail] = useState(profile.contactEmail ?? '')
  const [skillsText, setSkillsText] = useState(profile.skills.join(', '))
  const [interestAreasText, setInterestAreasText] = useState(profile.interestAreas.join(', '))

  const [saving, setSaving] = useState(false)
  const [conflictError, setConflictError] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const handleAvatarUploaded = (fileId: string) => {
    setAvatarFileId(fileId)
    // Tạm thời hiển thị preview qua endpoint API file nội bộ
    setAvatarPreviewUrl(`/api/portal/files/${fileId}`)
    setSuccessMessage(null)
  }

  const handleRemoveAvatar = () => {
    setAvatarFileId(null)
    setAvatarPreviewUrl(null)
  }

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

    const payload: {
      avatarFileId?: string | null
      contactEmail: string | null
      skills: string[]
      interestAreas: string[]
      updatedAt: string
    } = {
      contactEmail: contactEmail.trim() || null,
      skills,
      interestAreas,
      updatedAt: profile.updatedAt, // STATE-09: Kiểm tra xung đột phiên bản
    }

    if (avatarFileId !== undefined) {
      payload.avatarFileId = avatarFileId
    }

    try {
      const updated = await api<ProfileData>('/portal/me/profile', {
        method: 'PATCH',
        body: payload,
      })
      onProfileUpdated(updated)
      setAvatarFileId(undefined)
      setSuccessMessage('Cập nhật hồ sơ thành công!')
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        if (err.status === 409) {
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
    className: 'bg-soft text-ink',
  }

  return (
    <div className="grid gap-8 lg:grid-cols-3">
      {/* Cột trái: Tóm tắt thông tin & Ảnh đại diện */}
      <div className="space-y-6">
        <div className="rounded-2xl bg-paper p-6 text-center shadow-[inset_0_0_0_2px_#081F3D]">
          <div className="mx-auto mb-4 h-28 w-28 overflow-hidden rounded-full shadow-[inset_0_0_0_2px_#081F3D]">
            {avatarPreviewUrl ? (
              <img
                src={avatarPreviewUrl}
                alt={profile.fullName}
                className="h-full w-full object-cover"
                onError={(e) => {
                  ;(e.target as HTMLImageElement).src =
                    'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23081F3D"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>'
                }}
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-soft font-display text-2xl font-bold text-ink">
                {profile.fullName.slice(0, 1)}
              </div>
            )}
          </div>

          <h2 className="font-display text-xl font-bold text-ink">{profile.fullName}</h2>
          <p className="font-code text-xs text-muted">@{profile.username}</p>

          <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
            <span className={`rounded-full px-3 py-1 font-code text-xs font-bold ${statusInfo.className}`}>
              {statusInfo.label}
            </span>
            {profile.department && (
              <span className="rounded-full bg-soft px-3 py-1 font-code text-xs font-bold text-ink">
                {profile.department.name}
              </span>
            )}
          </div>

          {profile.avatarProcessing && (
            <div className="mt-4 rounded-xl bg-apc-blue-pale p-3 text-left font-code text-xs text-apc-blue">
              Ảnh đại diện đang được quét an toàn mã độc và sẽ cập nhật tự động sau khi hoàn tất.
            </div>
          )}

          <div className="mt-6 border-t-2 border-ink/10 pt-4 text-left font-code text-xs text-muted">
            <p>
              Cập nhật lần cuối: <span className="font-bold text-ink">{formatDate(profile.updatedAt)}</span>
            </p>
          </div>
        </div>
      </div>

      {/* Cột phải: Form chỉnh sửa */}
      <div className="lg:col-span-2">
        <form
          onSubmit={handleSubmit}
          className="space-y-6 rounded-2xl bg-paper p-6 shadow-[inset_0_0_0_2px_#081F3D]"
        >
          {successMessage && (
            <div
              role="alert"
              className="rounded-xl bg-apc-blue-pale p-4 font-body text-sm font-bold text-apc-blue"
            >
              {successMessage}
            </div>
          )}

          {conflictError && (
            <div
              role="alert"
              className="flex flex-col gap-3 rounded-xl bg-apc-red/10 p-4 font-body text-sm text-apc-red"
            >
              <p className="font-bold">{conflictError}</p>
              <Button
                type="button"
                variant="outline"
                onClick={onReloadRequired}
                className="self-start text-xs font-bold"
              >
                Tải lại dữ liệu mới nhất
              </Button>
            </div>
          )}

          {errorMessage && (
            <div
              role="alert"
              className="rounded-xl bg-apc-red/10 p-4 font-body text-sm font-bold text-apc-red"
            >
              {errorMessage}
            </div>
          )}

          {/* Nhóm trường chỉ đọc */}
          <div>
            <h3 className="font-display text-lg font-bold text-ink">Thông tin tài khoản (Chỉ đọc)</h3>
            <p className="mt-1 text-sm text-muted">
              Các trường này do Ban Chủ nhiệm quản lý. Nếu cần chỉnh sửa, vui lòng gửi yêu cầu đến Ban Chủ nhiệm.
            </p>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="field-fullName" className={labelClass}>
                  Họ và tên
                </label>
                <input
                  id="field-fullName"
                  type="text"
                  readOnly
                  disabled
                  value={profile.fullName}
                  className={`${inputClass} cursor-not-allowed opacity-60`}
                />
              </div>

              <div>
                <label htmlFor="field-email" className={labelClass}>
                  Email tài khoản
                </label>
                <input
                  id="field-email"
                  type="email"
                  readOnly
                  disabled
                  value={profile.email}
                  className={`${inputClass} cursor-not-allowed opacity-60`}
                />
                <span className="mt-1 block font-code text-xs text-muted">Dùng cho đăng nhập & bảo mật</span>
              </div>

              <div>
                <label htmlFor="field-studentId" className={labelClass}>
                  Mã số sinh viên (MSSV)
                </label>
                <input
                  id="field-studentId"
                  type="text"
                  readOnly
                  disabled
                  value={profile.studentId ?? '—'}
                  className={`${inputClass} cursor-not-allowed opacity-60`}
                />
              </div>

              <div>
                <label htmlFor="field-department" className={labelClass}>
                  Ban chuyên môn
                </label>
                <input
                  id="field-department"
                  type="text"
                  readOnly
                  disabled
                  value={profile.department?.name ?? '—'}
                  className={`${inputClass} cursor-not-allowed opacity-60`}
                />
              </div>

              <div>
                <label htmlFor="field-faculty" className={labelClass}>
                  Khoa / Ngành
                </label>
                <input
                  id="field-faculty"
                  type="text"
                  readOnly
                  disabled
                  value={
                    [profile.faculty, profile.major].filter(Boolean).join(' • ') || '—'
                  }
                  className={`${inputClass} cursor-not-allowed opacity-60`}
                />
              </div>

              <div>
                <label htmlFor="field-cohort" className={labelClass}>
                  Niên khóa
                </label>
                <input
                  id="field-cohort"
                  type="text"
                  readOnly
                  disabled
                  value={profile.cohort ?? '—'}
                  className={`${inputClass} cursor-not-allowed opacity-60`}
                />
              </div>
            </div>
          </div>

          {/* Nhóm trường được phép chỉnh sửa */}
          <div className="border-t-2 border-ink/10 pt-6">
            <h3 className="font-display text-lg font-bold text-ink">Thông tin cá nhân (Có thể chỉnh sửa)</h3>
            <p className="mt-1 text-sm text-muted">
              Bạn có thể cập nhật ảnh đại diện (qua hệ thống kiểm tra an toàn), email liên hệ, kỹ năng và lĩnh vực quan tâm.
            </p>

            <div className="mt-4 space-y-5">
              <div>
                <label className={labelClass}>
                  Ảnh đại diện
                </label>
                <div className="mt-2 flex flex-wrap items-center gap-4">
                  <FileUpload
                    purpose="AVATAR"
                    label="Tải ảnh mới (JPG, PNG, WebP)"
                    onUploaded={handleAvatarUploaded}
                  />
                  {avatarPreviewUrl && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleRemoveAvatar}
                      className="text-xs"
                    >
                      Xóa ảnh hiện tại
                    </Button>
                  )}
                </div>
                <span className="mt-1 block font-code text-xs text-muted">
                  Tệp ảnh được quét an toàn mã độc trước khi áp dụng chính thức (D2).
                </span>
              </div>

              <div>
                <label htmlFor="field-contactEmail" className={labelClass}>
                  Email liên hệ
                </label>
                <input
                  id="field-contactEmail"
                  type="email"
                  maxLength={254}
                  placeholder="name@example.com"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  className={inputClass}
                />
                <span className="mt-1 block font-code text-xs text-muted">
                  Email dùng để nhận thông tin liên lạc nội bộ từ ban chuyên môn.
                </span>
              </div>

              <div>
                <label htmlFor="field-skills" className={labelClass}>
                  Kỹ năng chuyên môn
                </label>
                <input
                  id="field-skills"
                  type="text"
                  placeholder="vd: React, TypeScript, Python, Figma (phân cách bằng dấu phẩy)"
                  value={skillsText}
                  onChange={(e) => setSkillsText(e.target.value)}
                  className={inputClass}
                />
                <span className="mt-1 block font-code text-xs text-muted">
                  Tối đa 20 kỹ năng, mỗi kỹ năng tối đa 50 ký tự.
                </span>
              </div>

              <div>
                <label htmlFor="field-interestAreas" className={labelClass}>
                  Lĩnh vực quan tâm
                </label>
                <input
                  id="field-interestAreas"
                  type="text"
                  placeholder="vd: Web Development, Trí tuệ nhân tạo, Thiết kế UI/UX"
                  value={interestAreasText}
                  onChange={(e) => setInterestAreasText(e.target.value)}
                  className={inputClass}
                />
                <span className="mt-1 block font-code text-xs text-muted">
                  Tối đa 20 lĩnh vực quan tâm, mỗi lĩnh vực tối đa 50 ký tự.
                </span>
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-4">
            <Button type="submit" disabled={saving}>
              {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

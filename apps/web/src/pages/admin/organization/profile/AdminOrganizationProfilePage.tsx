import { type FormEvent, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { AsyncState } from '../../../../components/AsyncState'
import { Button } from '../../../../components/Button'
import { buttonClass } from '../../../../components/buttonClass'
import { inputClass, labelClass } from '../../../../components/formClass'
import { PageHero } from '../../../../components/PageHero'
import { useApi } from '../../../../hooks/useApi'
import { api, ApiError } from '../../../../lib/api'
import type { OfficialLink, OrganizationProfile } from '../types'

export function AdminOrganizationProfilePage() {
  const { data, loading, error, reload } = useApi<OrganizationProfile>('/admin/organization/profile')

  return (
    <div className="min-h-screen bg-soft pb-16">
      <PageHero
        comment="cấu hình tổ chức"
        title="Thông tin APC"
        lede="Quản lý thông tin giới thiệu câu lạc bộ, liên kết chính thức và ngày kết thúc nhiệm kỳ Ban Chủ nhiệm."
      />

      <div className="mx-auto mt-8 max-w-container-max px-4 md:px-8">
        <AsyncState loading={loading} error={error} empty={!data} onRetry={reload}>
          {data && <ProfileForm initial={data} />}
        </AsyncState>
      </div>
    </div>
  )
}

function ProfileForm({ initial }: { initial: OrganizationProfile }) {
  const navigate = useNavigate()

  const [name, setName] = useState(initial.name)
  const [description, setDescription] = useState(initial.description)
  const [mission, setMission] = useState(initial.mission)
  const [contactEmail, setContactEmail] = useState(initial.contactEmail)
  const [fanpage, setFanpage] = useState(initial.fanpage)
  const [officialLinks, setOfficialLinks] = useState<OfficialLink[]>(initial.officialLinks ?? [])
  const [termEndsAtDate, setTermEndsAtDate] = useState(
    initial.termEndsAt ? initial.termEndsAt.slice(0, 10) : '',
  )

  const [saving, setSaving] = useState(false)
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  function handleAddLink() {
    setOfficialLinks((links) => [...links, { label: '', url: '' }])
  }

  function handleUpdateLink(index: number, key: keyof OfficialLink, value: string) {
    setOfficialLinks((links) => {
      const updated = [...links]
      const current = updated[index]
      if (current) {
        updated[index] = { ...current, [key]: value }
      }
      return updated
    })
  }

  function handleRemoveLink(index: number) {
    setOfficialLinks((links) => links.filter((_, i) => i !== index))
  }

  function handlePreview() {
    const previewData = {
      name,
      description,
      mission,
      contactEmail,
      fanpage,
      officialLinks: officialLinks.filter((l) => l.label && l.url),
    }
    navigate('/about', { state: { preview: previewData } })
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setStatusMessage(null)

    try {
      const termEndsAt = termEndsAtDate ? new Date(`${termEndsAtDate}T00:00:00.000Z`).toISOString() : null
      await api('/admin/organization/profile', {
        method: 'PUT',
        body: {
          name,
          description,
          mission,
          contactEmail,
          fanpage,
          officialLinks: officialLinks.filter((l) => l.label.trim() && l.url.trim()),
          termEndsAt,
        },
      })
      setStatusMessage({ type: 'success', text: 'Cập nhật thông tin APC thành công.' })
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Không thể lưu thông tin. Vui lòng kiểm tra lại.'
      setStatusMessage({ type: 'error', text: message })
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="rounded-2xl border-2 border-ink bg-paper p-6 md:p-8" onSubmit={handleSubmit}>
      {statusMessage && (
        <div
          className={`mb-6 rounded-xl border-2 p-4 font-bold ${
            statusMessage.type === 'success'
              ? 'border-ink bg-apc-gold text-ink'
              : 'border-apc-red bg-apc-red/10 text-apc-red'
          }`}
        >
          {statusMessage.text}
        </div>
      )}

      <div className="space-y-6">
        <label className={labelClass}>
          <span>
            Tên câu lạc bộ <span className="text-apc-red">*</span>
          </span>
          <input
            className={inputClass}
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>

        <label className={labelClass}>
          <span>
            Mô tả giới thiệu <span className="text-apc-red">*</span>
          </span>
          <textarea
            className={`${inputClass} min-h-[100px]`}
            required
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>

        <label className={labelClass}>
          <span>
            Sứ mệnh <span className="text-apc-red">*</span>
          </span>
          <textarea
            className={`${inputClass} min-h-[100px]`}
            required
            rows={3}
            value={mission}
            onChange={(e) => setMission(e.target.value)}
          />
        </label>

        <div className="grid gap-6 md:grid-cols-2">
          <label className={labelClass}>
            <span>
              Email liên hệ công khai <span className="text-apc-red">*</span>
            </span>
            <input
              className={inputClass}
              required
              type="email"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
            />
          </label>

          <label className={labelClass}>
            <span>
              Fanpage chính thức <span className="text-apc-red">*</span>
            </span>
            <input
              className={inputClass}
              placeholder="https://facebook.com/..."
              required
              type="url"
              value={fanpage}
              onChange={(e) => setFanpage(e.target.value)}
            />
          </label>
        </div>

        <div className="border-t-2 border-ink pt-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="font-display text-xl font-bold">Liên kết chính thức</h3>
              <p className="font-code text-sm text-ink/70">
                Các liên kết như UMTOJ, website trường (chỉ nhận URL http/https).
              </p>
            </div>
            <Button type="button" variant="outline" onClick={handleAddLink}>
              + Thêm liên kết
            </Button>
          </div>

          {officialLinks.length === 0 ? (
            <p className="rounded-xl border-2 border-dashed border-ink/40 p-4 text-center font-code text-sm">
              Chưa có liên kết nào. Bấm &quot;Thêm liên kết&quot; để bổ sung.
            </p>
          ) : (
            <div className="space-y-3">
              {officialLinks.map((link, idx) => (
                <div key={idx} className="flex flex-wrap items-center gap-3">
                  <input
                    className={`${inputClass} flex-1 min-w-[160px]`}
                    placeholder="Tên liên kết (vd: UMT Online Judge)"
                    value={link.label}
                    onChange={(e) => handleUpdateLink(idx, 'label', e.target.value)}
                  />
                  <input
                    className={`${inputClass} flex-[2] min-w-[240px]`}
                    placeholder="https://..."
                    type="url"
                    value={link.url}
                    onChange={(e) => handleUpdateLink(idx, 'url', e.target.value)}
                  />
                  <button
                    className="rounded-xl border-2 border-ink px-3 py-3 font-bold text-apc-red hover:bg-apc-red hover:text-paper"
                    type="button"
                    onClick={() => handleRemoveLink(idx)}
                  >
                    Xóa
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="border-t-2 border-ink pt-6">
          <label className={labelClass}>
            <span>Ngày kết thúc nhiệm kỳ Ban Chủ nhiệm (termEndsAt)</span>
            <p className="font-sans text-sm font-normal text-ink/75">
              Dùng để giới hạn thời hạn vai trò đặc quyền (RP-03, QĐ-6). Tuyệt đối không để lộ ra API công khai.
            </p>
            <input
              className={`${inputClass} max-w-xs`}
              type="date"
              value={termEndsAtDate}
              onChange={(e) => setTermEndsAtDate(e.target.value)}
            />
          </label>
        </div>
      </div>

      <div className="mt-8 flex flex-wrap items-center justify-end gap-4 border-t-2 border-ink pt-6">
        <button
          className={buttonClass('outline')}
          type="button"
          onClick={handlePreview}
        >
          Xem trước trang Về APC
        </button>
        <Button disabled={saving} type="submit" variant="primary">
          {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
        </Button>
      </div>
    </form>
  )
}

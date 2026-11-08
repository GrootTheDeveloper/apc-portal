import { type FormEvent, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { AsyncState } from '../../../../components/AsyncState'
import { Button } from '../../../../components/Button'
import { buttonClass } from '../../../../components/buttonClass'
import { inputClass, labelClass } from '../../../../components/formClass'
import { PageHero } from '../../../../components/PageHero'
import { useApi } from '../../../../hooks/useApi'
import { api, ApiError } from '../../../../lib/api'
import type { ActiveMember, AdminDepartment } from '../types'

export function AdminDepartmentEditPage() {
  const { id } = useParams<{ id: string }>()
  const isNew = !id || id === 'new'

  const { data, loading, error, reload } = useApi<AdminDepartment>(
    isNew ? null : `/admin/organization/departments/${id}`,
  )

  return (
    <div className="min-h-screen bg-soft pb-16">
      <PageHero
        comment="cấu hình tổ chức"
        title={isNew ? 'Tạo Ban chuyên môn mới' : `Ban: ${data?.name ?? ''}`}
        lede={
          isNew
            ? 'Thêm ban chuyên môn mới cho câu lạc bộ. Tạo xong hệ thống sẽ chuyển đến trang chỉnh sửa.'
            : 'Chỉnh sửa thông tin ban chuyên môn, đầu mối liên hệ và trạng thái hoạt động.'
        }
        top={
          <Link
            className="inline-flex items-center text-sm font-bold text-apc-gold-soft hover:underline"
            to="/admin/organization/departments"
          >
            ← Danh sách Ban chuyên môn
          </Link>
        }
      />

      <div className="mx-auto mt-8 max-w-container-max px-4 md:px-8">
        {isNew ? (
          <DepartmentForm isNew={true} />
        ) : (
          <AsyncState loading={loading} error={error} empty={!data} onRetry={reload}>
            {data && <DepartmentForm initial={data} isNew={false} reload={reload} />}
          </AsyncState>
        )}
      </div>
    </div>
  )
}

function DepartmentForm({
  initial,
  isNew,
  reload,
}: {
  initial?: AdminDepartment
  isNew: boolean
  reload?: () => void
}) {
  const navigate = useNavigate()

  const [name, setName] = useState(initial?.name ?? '')
  const [code, setCode] = useState(initial?.code ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [contactPoint, setContactPoint] = useState(initial?.contactPoint ?? '')
  const [status, setStatus] = useState<'ACTIVE' | 'ARCHIVED'>(initial?.status ?? 'ACTIVE')

  const [saving, setSaving] = useState(false)
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [conflictMembers, setConflictMembers] = useState<ActiveMember[] | null>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setStatusMessage(null)
    setConflictMembers(null)

    try {
      if (isNew) {
        const created = await api<AdminDepartment>('/admin/organization/departments', {
          method: 'POST',
          body: {
            name,
            code: code.trim() ? code.trim() : undefined,
            description: description.trim() ? description.trim() : null,
            contactPoint: contactPoint.trim() ? contactPoint.trim() : null,
          },
        })
        // FLOW-24 & Sitemap §8.8: Tạo xong chuyển đến trang sửa của ban vừa tạo
        navigate(`/admin/organization/departments/${created.id}`, { replace: true })
      } else {
        await api<AdminDepartment>(`/admin/organization/departments/${initial?.id}`, {
          method: 'PATCH',
          body: {
            name,
            description: description.trim() ? description.trim() : null,
            contactPoint: contactPoint.trim() ? contactPoint.trim() : null,
            status,
          },
        })
        setStatusMessage({ type: 'success', text: 'Cập nhật ban chuyên môn thành công.' })
        reload?.()
      }
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 409 && Array.isArray(err.data?.members)) {
          // FLOW-24: Lưu trữ ban còn thành viên active trả 409 kèm danh sách thành viên cần chuyển
          setConflictMembers(err.data.members as ActiveMember[])
          setStatusMessage({
            type: 'error',
            text: err.message || 'Không thể lưu trữ ban còn thành viên đang hoạt động.',
          })
        } else {
          setStatusMessage({ type: 'error', text: err.message })
        }
      } else {
        setStatusMessage({ type: 'error', text: 'Đã có lỗi xảy ra. Vui lòng thử lại.' })
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[2fr_1fr]">
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

        {conflictMembers && conflictMembers.length > 0 && (
          <div className="mb-6 rounded-xl border-2 border-apc-red bg-paper p-5">
            <h4 className="font-display text-lg font-bold text-apc-red">
              Danh sách thành viên cần chuyển ban ({conflictMembers.length})
            </h4>
            <p className="mt-1 font-sans text-sm text-ink/80">
              Theo quy định FLOW-24 và ORG-03, bạn cần chuyển ban hoặc cập nhật trạng thái cho các thành viên sau trước khi
              có thể lưu trữ ban này:
            </p>
            <ul className="mt-3 divide-y divide-ink/20 font-code text-sm">
              {conflictMembers.map((m) => (
                <li key={m.id} className="flex items-center justify-between py-2">
                  <div>
                    <span className="font-bold text-ink">{m.fullName}</span>
                    {m.studentId && <span className="ml-2 text-ink/60">({m.studentId})</span>}
                  </div>
                  <span className="text-ink/70">{m.email}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="space-y-6">
          <label className={labelClass}>
            <span>
              Tên ban chuyên môn <span className="text-apc-red">*</span>
            </span>
            <input
              className={inputClass}
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>

          <label className={labelClass}>
            <span>Mã định danh (code)</span>
            <p className="font-sans text-xs font-normal text-ink/70">
              Dùng cho URL và tham chiếu. Để trống hệ thống sẽ tự sinh từ tên ban.
            </p>
            <input
              className={`${inputClass} disabled:opacity-60`}
              disabled={!isNew}
              placeholder={isNew ? 'vd: ban-ky-thuat' : ''}
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
          </label>

          <label className={labelClass}>
            <span>Mô tả nhiệm vụ ban</span>
            <textarea
              className={`${inputClass} min-h-[100px]`}
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>

          <label className={labelClass}>
            <span>Đầu mối liên hệ chung của ban</span>
            <p className="font-sans text-xs font-normal text-ink/70">
              Kênh liên hệ chung: email ban, fanpage hoặc chức danh (ORG-02, BR-20). Không dùng thông tin cá nhân.
            </p>
            <input
              className={inputClass}
              placeholder="vd: Email ban: kythuat@umt.edu.vn"
              value={contactPoint}
              onChange={(e) => setContactPoint(e.target.value)}
            />
          </label>

          {!isNew && (
            <label className={labelClass}>
              <span>Trạng thái hoạt động</span>
              <select
                className={inputClass}
                value={status}
                onChange={(e) => setStatus(e.target.value as 'ACTIVE' | 'ARCHIVED')}
              >
                <option value="ACTIVE">Đang hoạt động (ACTIVE)</option>
                <option value="ARCHIVED">Lưu trữ (ARCHIVED)</option>
              </select>
            </label>
          )}
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-end gap-4 border-t-2 border-ink pt-6">
          <Link className={buttonClass('outline')} to="/admin/organization/departments">
            Hủy
          </Link>
          <Button disabled={saving} type="submit" variant="primary">
            {saving ? 'Đang lưu...' : isNew ? 'Tạo ban chuyên môn' : 'Lưu thay đổi'}
          </Button>
        </div>
      </form>

      {!isNew && initial && (
        <div className="space-y-6">
          <div className="rounded-2xl border-2 border-ink bg-paper p-6">
            <h3 className="font-display text-lg font-bold">Thông tin quản lý</h3>
            <div className="mt-4 space-y-3 font-code text-sm">
              <div className="flex justify-between">
                <span className="text-ink/60">Trạng thái:</span>
                <span
                  className={`rounded-full px-2.5 py-0.5 font-code text-xs font-bold ${
                    initial.status === 'ACTIVE' ? 'bg-apc-blue/10 text-apc-blue' : 'bg-soft text-muted'
                  }`}
                >
                  {initial.status === 'ACTIVE' ? 'Đang hoạt động' : 'Lưu trữ'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink/60">Thứ tự hiển thị:</span>
                <span className="font-bold">{initial.order}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink/60">Thành viên hoạt động:</span>
                <span className="font-bold">{initial.activeMembers?.length ?? 0}</span>
              </div>
            </div>
          </div>

          {initial.activeMembers && initial.activeMembers.length > 0 && (
            <div className="rounded-2xl border-2 border-ink bg-paper p-6">
              <h3 className="font-display text-lg font-bold">Thành viên trong ban ({initial.activeMembers.length})</h3>
              <ul className="mt-3 divide-y divide-ink/20 font-sans text-sm">
                {initial.activeMembers.map((member) => (
                  <li key={member.id} className="py-2.5">
                    <p className="font-bold text-ink">{member.fullName}</p>
                    <p className="font-code text-xs text-ink/60">
                      {member.studentId ?? '—'} · {member.email}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

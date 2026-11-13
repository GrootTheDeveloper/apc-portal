import { type FormEvent, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { Button } from '../../../components/Button.js'
import { buttonClass } from '../../../components/buttonClass.js'
import { useApi } from '../../../hooks/useApi.js'
import { useAuth } from '../../../hooks/useAuth.js'
import { api, ApiError } from '../../../lib/api.js'
import { hasRole } from '../../../lib/auth.js'
import { fieldErrors } from '../../../lib/formErrors.js'
import type { AboutData } from '../../about/types.js'
import { ProjectForm } from './ProjectForm.js'
import { createProjectPayload, initialProjectValues, type ProjectFormValues, useDirtyFormWarning } from './projectTypes.js'

/** PAGE-MGT-PRJ-02 — tạo dự án mới (C4). Dự án tạo ra luôn ở trạng thái Ẩn; công bố làm ở trang sửa. */
export function AdminProjectCreatePage() {
  const { user } = useAuth()
  const board = hasRole(user, 'BOARD')
  const navigate = useNavigate()
  const [values, setValues] = useState<ProjectFormValues>(() => initialProjectValues())
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<{ message: string; fields: Record<string, string[]> } | null>(null)

  const about = useApi<AboutData>('/public/about')
  const departments = about.data?.departments ?? []

  // Cảnh báo khi rời trang còn thay đổi chưa lưu (STATE-08).
  const dirty = JSON.stringify(values) !== JSON.stringify(initialProjectValues())
  useDirtyFormWarning(dirty && !pending)

  const fields = error?.fields ?? {}
  const onChange = (patch: Partial<ProjectFormValues>) => setValues((current) => ({ ...current, ...patch }))

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    setError(null)
    try {
      await api('/admin/content/projects', { method: 'POST', body: createProjectPayload(values, board) })
      navigate('/admin/content/projects')
    } catch (caught) {
      // 422 thì đánh dấu từng ô; lỗi khác hiện thông báo của server (ví dụ 403 khi hết quyền giữa chừng).
      setError({
        message:
          caught instanceof ApiError && caught.status !== 422
            ? caught.message
            : 'Kiểm tra lại các ô được đánh dấu.',
        fields: fieldErrors(caught),
      })
    } finally {
      setPending(false)
    }
  }

  return (
    <main className="flex flex-col gap-8">
      <div>
        <h1 className="font-display text-[clamp(32px,4vw,56px)] font-extrabold leading-none tracking-[-0.03em]">
          Thêm dự án
        </h1>
        <p className="mt-3 max-w-[70ch] text-[17px] text-muted">
          Dự án mới lưu ở trạng thái Ẩn, chưa hiện ra ngoài.{' '}
          {board
            ? 'Bạn chọn ban sở hữu; bỏ trống nghĩa là dự án toàn CLB.'
            : 'Dự án tự gán vào ban bạn quản lý.'}
        </p>
      </div>

      {error && (
        <p role="alert" className="rounded-xl bg-apc-red/10 px-4 py-3 text-[15px] font-bold text-apc-red">
          {error.message}
        </p>
      )}

      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-8">
        <ProjectForm
          values={values}
          onChange={onChange}
          fields={fields}
          disabled={pending}
          board={board}
          departments={departments}
        />

        <div className="flex flex-wrap items-center gap-3 border-t-2 border-ink pt-6">
          <Button type="submit" disabled={pending}>
            {pending ? 'Đang lưu…' : 'Tạo dự án'}
          </Button>
          <Link to="/admin/content/projects" className={buttonClass('outline')}>
            Hủy
          </Link>
        </div>
      </form>
    </main>
  )
}

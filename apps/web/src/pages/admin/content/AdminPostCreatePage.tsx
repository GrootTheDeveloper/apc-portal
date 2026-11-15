import { type FormEvent, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { Button } from '../../../components/Button'
import { buttonClass } from '../../../components/buttonClass'
import { useAuth } from '../../../hooks/useAuth'
import { api, ApiError } from '../../../lib/api'
import { hasRole } from '../../../lib/auth'
import { fieldErrors } from '../../../lib/formErrors'
import { PostForm } from './PostForm'
import { type AdminPostDetail, type PostFormValues, createPayload, initialPostValues } from './postTypes'

/** PAGE-MGT-CMS-02 — tạo bài viết mới (C3). Bài tạo ra luôn ở trạng thái Bản nháp; công bố làm ở trang sửa. */
export function AdminPostCreatePage() {
  const { user } = useAuth()
  const board = hasRole(user, 'BOARD')
  const navigate = useNavigate()
  const [values, setValues] = useState<PostFormValues>(() => initialPostValues())
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<{ message: string; fields: Record<string, string[]> } | null>(null)

  const fields = error?.fields ?? {}
  const onChange = (patch: Partial<PostFormValues>) => setValues((current) => ({ ...current, ...patch }))

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    setError(null)
    try {
      const created = await api<AdminPostDetail>('/admin/content/posts', {
        method: 'POST',
        body: createPayload(values),
      })
      navigate(`/admin/content/posts/${created.id}`)
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
          Viết bài mới
        </h1>
        <p className="mt-3 max-w-[70ch] text-[17px] text-muted">
          Bài mới lưu ở trạng thái Bản nháp, chưa hiện ra ngoài (BR-11). Tác giả là bạn;
          {board
            ? ' bài không gán ban nào nên thuộc toàn CLB và chỉ Ban Chủ nhiệm thấy được.'
            : ' bài tự gán vào ban bạn quản lý.'}
        </p>
      </div>

      {error && (
        <p role="alert" className="rounded-xl bg-apc-red/10 px-4 py-3 text-[15px] font-bold text-apc-red">
          {error.message}
        </p>
      )}

      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-8">
        <PostForm values={values} onChange={onChange} fields={fields} disabled={pending} board={board} />

        <div className="flex flex-wrap items-center gap-3 border-t-2 border-ink pt-6">
          <Button type="submit" disabled={pending}>
            {pending ? 'Đang lưu…' : 'Lưu bản nháp'}
          </Button>
          <Link to="/admin/content/posts" className={buttonClass('outline')}>
            Hủy
          </Link>
        </div>
      </form>
    </main>
  )
}

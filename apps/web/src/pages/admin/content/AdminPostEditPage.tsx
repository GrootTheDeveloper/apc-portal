import { type FormEvent, type ReactNode, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { AsyncState } from '../../../components/AsyncState'
import { Button } from '../../../components/Button'
import { buttonClass } from '../../../components/buttonClass'
import { ConfirmDialog } from '../../../components/ConfirmDialog'
import { inputClass, labelClass } from '../../../components/formClass'
import { useApi } from '../../../hooks/useApi'
import { useAuth } from '../../../hooks/useAuth'
import { api, ApiError, type Page } from '../../../lib/api'
import { hasRole } from '../../../lib/auth'
import { fieldErrors } from '../../../lib/formErrors'
import { formatDateTime } from '../../../lib/format'
import type { AboutData } from '../../about/types'
import type { AccountRow } from '../accounts/accountTypes'
import { PostForm } from './PostForm'
import {
  ACTION_LABEL,
  type AdminPostDetail,
  type PostAction,
  type PostFormValues,
  SCOPE_LABEL,
  STATUS_LABEL,
  departmentLabel,
  initialPostValues,
  scopeBadgeClass,
  statusBadgeClass,
  updatePayload,
} from './postTypes'

/** PAGE-MGT-CMS-03 — sửa bài viết (C3): lưu nội dung có kiểm tra xung đột, và đổi trạng thái theo PRD mục 9.2. */
export function AdminPostEditPage() {
  const { id } = useParams<{ id: string }>()
  const post = useApi<AdminPostDetail>(id ? `/admin/content/posts/${id}` : null)
  const about = useApi<AboutData>('/public/about')

  return (
    <main className="flex flex-col gap-8">
      <AsyncState
        loading={post.loading}
        error={post.error}
        empty={!post.data}
        emptyText="Không tìm thấy bài viết."
        onRetry={post.reload}
      >
        {post.data && <EditPost post={post.data} departments={about.data?.departments ?? []} />}
      </AsyncState>
    </main>
  )
}

function EditPost({
  post,
  departments,
}: {
  post: AdminPostDetail
  departments: { id: string; name: string }[]
}) {
  const { user } = useAuth()
  const board = hasRole(user, 'BOARD')

  const [detail, setDetail] = useState(post)
  const [values, setValues] = useState<PostFormValues>(() => initialPostValues(post))
  // Bản OCC: gửi lại nguyên chuỗi `updatedAt` server trả về, không định dạng hay cắt bớt.
  const [baseline, setBaseline] = useState(post.updatedAt)
  const [pending, setPending] = useState(false)
  const [saveError, setSaveError] = useState<{
    message: string
    fields: Record<string, string[]>
    stale: boolean
  } | null>(null)
  const [savedAt, setSavedAt] = useState<Date | null>(null)

  // Thành viên được nêu tên trong bài (BR-20): nhập tay mã thành viên, BOARD tìm thêm theo tên.
  const [mentionInput, setMentionInput] = useState('')
  const [picked, setPicked] = useState<{ id: string; name: string }[]>([])
  const [mentionDraft, setMentionDraft] = useState('')
  const [mentionQuery, setMentionQuery] = useState('')
  const [statusAction, setStatusAction] = useState<PostAction | null>(null)

  const accounts = useApi<Page<AccountRow>>(
    board && mentionQuery ? `/admin/accounts?q=${encodeURIComponent(mentionQuery)}&pageSize=5` : null,
  )

  const mentionedIds = Array.from(
    new Set([...mentionInput.split(/[\s,;]+/).filter(Boolean), ...picked.map((person) => person.id)]),
  )
  // Quản lý ban chỉ sửa được bài DRAFT của ban mình; bài đã công bố phải chờ BOARD gỡ về nháp.
  const managerLocked = !board && detail.status !== 'DRAFT'
  // Server chỉ cho quản lý ban đổi trạng thái bài INTERNAL; tin PUBLIC do BOARD xử lý.
  const canChangeStatus = board || detail.scope === 'INTERNAL'
  const actions: PostAction[] =
    detail.status === 'DRAFT'
      ? ['PUBLISH', 'ARCHIVE']
      : detail.status === 'PUBLISHED'
        ? ['UNPUBLISH', 'ARCHIVE']
        : []
  const titleChanged = values.title.trim() !== '' && values.title.trim() !== detail.title

  /** Đọc lại bài từ server: dùng sau khi đổi trạng thái (updatedAt đổi) và khi nút "Tải lại" của xung đột. */
  async function refresh() {
    const fresh = await api<AdminPostDetail>(`/admin/content/posts/${detail.id}`)
    setDetail(fresh)
    setValues(initialPostValues(fresh))
    setBaseline(fresh.updatedAt)
    setSavedAt(null)
    setSaveError(null)
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    setSaveError(null)
    setSavedAt(null)
    try {
      const updated = await api<AdminPostDetail>(`/admin/content/posts/${detail.id}`, {
        method: 'PATCH',
        body: updatePayload(values, baseline),
      })
      setDetail(updated)
      setValues(initialPostValues(updated))
      setBaseline(updated.updatedAt)
      setSavedAt(new Date())
    } catch (caught) {
      // 409: người khác vừa lưu bài này (STATE-09) — không ghi đè, bắt buộc tải lại bản mới.
      const stale = caught instanceof ApiError && caught.status === 409
      setSaveError({
        message:
          caught instanceof ApiError && caught.status !== 422
            ? caught.message
            : 'Kiểm tra lại các ô được đánh dấu.',
        fields: fieldErrors(caught),
        stale,
      })
    } finally {
      setPending(false)
    }
  }

  /** Đổi trạng thái; lỗi (403, 409 sai bước chuyển, 400 thiếu đồng ý) để ConfirmDialog hiện ngay trong hộp. */
  async function runStatusAction(action: PostAction) {
    const body: { action: PostAction; mentionedUserIds?: string[] } = { action }
    // mentionedUserIds chỉ có nghĩa với PUBLISH; server bỏ qua ở hành động khác.
    if (action === 'PUBLISH' && mentionedIds.length > 0) body.mentionedUserIds = mentionedIds
    await api(`/admin/content/posts/${detail.id}/status`, { method: 'PATCH', body })
    setStatusAction(null)
    await refresh()
  }

  const dialog: { title: string; confirmLabel: string; danger: boolean; description: ReactNode } | null =
    statusAction === 'PUBLISH'
      ? {
          title: 'Công bố bài viết',
          confirmLabel: ACTION_LABEL.PUBLISH,
          danger: false,
          description: (
            <>
              Bài <strong>{detail.title}</strong> sẽ hiện{' '}
              {detail.scope === 'PUBLIC' ? 'công khai trên /news' : 'trong portal của thành viên'} ngay khi công bố.
              {mentionedIds.length > 0
                ? ` Đã khai báo ${mentionedIds.length} thành viên được nêu tên; hệ thống kiểm tra đồng ý công bố tên của từng người, thiếu một người là không công bố được.`
                : ' Bạn chưa khai báo thành viên nào được nêu tên trong bài.'}
            </>
          ),
        }
      : statusAction === 'UNPUBLISH'
        ? {
            title: 'Gỡ bài về bản nháp',
            confirmLabel: ACTION_LABEL.UNPUBLISH,
            danger: true,
            description: (
              <>
                Bài <strong>{detail.title}</strong> biến mất khỏi trang công khai và link cũ trả 404. Nội dung vẫn giữ
                nguyên ở trạng thái Bản nháp để sửa tiếp.
              </>
            ),
          }
        : statusAction === 'ARCHIVE'
          ? {
              title: 'Lưu trữ bài viết',
              confirmLabel: ACTION_LABEL.ARCHIVE,
              danger: true,
              description: (
                <>
                  Bài <strong>{detail.title}</strong> chuyển sang Lưu trữ: không hiện ở đâu nữa và không công bố lại
                  được. Bài không bị xóa khỏi hệ thống (BR-13).
                </>
              ),
            }
          : null

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-display text-[clamp(28px,3.4vw,44px)] font-extrabold leading-tight tracking-[-0.03em]">
            {detail.title}
          </h1>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className={statusBadgeClass(detail.status)}>{STATUS_LABEL[detail.status]}</span>
            <span className={scopeBadgeClass(detail.scope)}>{SCOPE_LABEL[detail.scope]}</span>
            <span className="font-code text-[13px] text-muted">/{detail.slug}</span>
          </div>
        </div>
        <Link to={`/admin/content/posts/${detail.id}/preview`} className={buttonClass('outline')}>
          Xem trước
        </Link>
      </div>

      <dl className="grid gap-x-8 gap-y-3 rounded-2xl bg-soft px-5 py-4 text-[15px] sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <dt className="font-code text-[13px] font-bold text-muted">chuyên mục</dt>
          <dd className="mt-1 font-bold">{detail.category}</dd>
        </div>
        <div>
          <dt className="font-code text-[13px] font-bold text-muted">ban sở hữu</dt>
          <dd className="mt-1 font-bold">{departmentLabel(departments, detail.departmentId)}</dd>
        </div>
        <div>
          <dt className="font-code text-[13px] font-bold text-muted">cập nhật</dt>
          <dd className="mt-1">{formatDateTime(detail.updatedAt)}</dd>
        </div>
        <div>
          <dt className="font-code text-[13px] font-bold text-muted">công bố</dt>
          <dd className="mt-1">{detail.publishedAt ? formatDateTime(detail.publishedAt) : 'chưa công bố'}</dd>
        </div>
      </dl>

      {managerLocked && (
        <p className="rounded-2xl bg-apc-gold-pale px-5 py-4 text-[15px] font-bold text-ink">
          Bài đã công bố: quản lý ban chỉ xem được. Cần sửa thì Ban Chủ nhiệm gỡ về Bản nháp trước.
        </p>
      )}

      {titleChanged && (
        <p role="status" className="rounded-2xl bg-apc-red/10 px-5 py-4 text-[15px] font-bold text-apc-red">
          Đổi tiêu đề sẽ làm đổi link của bài (hiện tại /{detail.slug}). Bài đã công bố thì link cũ sẽ không còn vào
          được — cân nhắc giữ nguyên tiêu đề.
        </p>
      )}

      {saveError && (
        <div
          role="alert"
          className="flex flex-col gap-3 rounded-2xl bg-apc-red/10 px-5 py-4 text-[15px] font-bold text-apc-red"
        >
          <p>{saveError.message}</p>
          {Object.entries(saveError.fields).map(([field, messages]) => (
            <p key={field}>{messages.join(' ')}</p>
          ))}
          {saveError.stale && (
            <div>
              <Button type="button" variant="outline" onClick={() => void refresh().catch(() => setSaveError(null))}>
                Tải lại bản mới nhất
              </Button>
            </div>
          )}
        </div>
      )}

      {savedAt && !saveError && (
        <p role="status" className="rounded-2xl bg-apc-blue-pale px-5 py-4 text-[15px] font-bold text-apc-blue">
          Đã lưu lúc {formatDateTime(savedAt)}.
        </p>
      )}

      <form onSubmit={handleSave} noValidate className="flex flex-col gap-8">
        <PostForm
          values={values}
          onChange={(patch) => setValues((current) => ({ ...current, ...patch }))}
          fields={saveError?.fields ?? {}}
          disabled={pending || managerLocked}
          board={board}
        />

        <div className="flex flex-wrap items-center gap-3 border-t-2 border-ink pt-6">
          <Button type="submit" disabled={pending || managerLocked}>
            {pending ? 'Đang lưu…' : 'Lưu thay đổi'}
          </Button>
          <Link to="/admin/content/posts" className={buttonClass('outline')}>
            Về danh sách
          </Link>
        </div>
      </form>

      <section className="flex flex-col gap-5 rounded-2xl border-2 border-ink p-5">
        <div>
          <h2 className="font-display text-[24px] font-extrabold">Trạng thái bài viết</h2>
          <p className="mt-2 max-w-[70ch] text-[15px] text-muted">
            {canChangeStatus
              ? 'Công bố, gỡ và lưu trữ đều được ghi nhật ký (docs/02 §11). Bài Lưu trữ không công bố lại được.'
              : 'Tin Công khai: chỉ Ban Chủ nhiệm công bố, gỡ và lưu trữ. Bạn chỉ thao tác được thông báo Nội bộ của ban.'}
          </p>
        </div>

        {actions.length > 0 && canChangeStatus && (
          <div className="flex flex-wrap gap-3">
            {actions.map((action) => (
              <Button
                key={action}
                type="button"
                variant={action === 'PUBLISH' ? 'primary' : 'outline'}
                onClick={() => setStatusAction(action)}
              >
                {ACTION_LABEL[action]}
              </Button>
            ))}
          </div>
        )}

        {actions.includes('PUBLISH') && canChangeStatus && (
          <div className="flex flex-col gap-4 border-t-2 border-ink/10 pt-5">
            <label className={labelClass} htmlFor="post-mentions">
              thành viên được nêu tên hoặc có ảnh trong bài
              <textarea
                id="post-mentions"
                className={`${inputClass} min-h-20 resize-y font-code text-[15px]`}
                value={mentionInput}
                placeholder="Mỗi dòng một mã thành viên"
                onChange={(event) => setMentionInput(event.target.value)}
              />
              <span className="font-body text-[15px] text-muted">
                Trước khi công bố, hệ thống kiểm tra đồng ý công bố tên (PUBLIC_NAME) của từng người; thiếu một người
                là không công bố được và phải thay nội dung hoặc chọn người khác (FLOW-17 bước 3, BR-20).
              </span>
            </label>

            {picked.length > 0 && (
              <ul className="flex flex-wrap gap-2">
                {picked.map((person) => (
                  <li key={person.id}>
                    <button
                      type="button"
                      onClick={() => setPicked((current) => current.filter((item) => item.id !== person.id))}
                      className="inline-flex items-center gap-2 rounded-full bg-soft px-3 py-1.5 text-[14px] font-bold text-ink transition-colors hover:bg-apc-red-pale"
                    >
                      {person.name}
                      <span aria-hidden className="text-apc-red">
                        ✕
                      </span>
                      <span className="sr-only">Bỏ chọn</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {board && (
              <div className="flex flex-col gap-3">
                <form
                  role="search"
                  className="flex flex-col gap-3 sm:flex-row"
                  onSubmit={(event) => {
                    event.preventDefault()
                    setMentionQuery(mentionDraft.trim())
                  }}
                >
                  <label className={labelClass} htmlFor="mention-search">
                    tìm thành viên theo tên
                    <input
                      id="mention-search"
                      className={inputClass}
                      value={mentionDraft}
                      placeholder="Tên hoặc tên đăng nhập…"
                      onChange={(event) => setMentionDraft(event.target.value)}
                    />
                  </label>
                  <Button type="submit" variant="outline" className="self-start sm:self-end">
                    Tìm
                  </Button>
                </form>

                {mentionQuery && (
                  <AsyncState
                    loading={accounts.loading}
                    error={accounts.error}
                    empty={accounts.data?.items.length === 0}
                    emptyText={`Không có thành viên khớp “${mentionQuery}”.`}
                    onRetry={accounts.reload}
                  >
                    <ul className="flex flex-col divide-y divide-ink/10 border-y-2 border-ink">
                      {accounts.data?.items.map((account) => {
                        const chosen = picked.some((person) => person.id === account.id)
                        return (
                          <li key={account.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                            <span className="min-w-0">
                              <span className="block truncate font-bold">{account.fullName}</span>
                              <span className="block truncate font-code text-[13px] text-muted">
                                {account.username} · {account.id}
                              </span>
                            </span>
                            <Button
                              type="button"
                              variant={chosen ? 'light' : 'outline'}
                              className="min-h-10 px-4 py-2 text-[15px]"
                              disabled={chosen}
                              onClick={() =>
                                setPicked((current) => [...current, { id: account.id, name: account.fullName }])
                              }
                            >
                              {chosen ? 'Đã chọn' : 'Chọn'}
                            </Button>
                          </li>
                        )
                      })}
                    </ul>
                  </AsyncState>
                )}
              </div>
            )}

            <p className="font-code text-[13px] text-muted">
              <span aria-hidden>{'// '}</span>
              {mentionedIds.length > 0
                ? `${mentionedIds.length} mã thành viên sẽ được kiểm tra đồng ý khi công bố`
                : 'chưa khai báo thành viên nào'}
            </p>
          </div>
        )}
      </section>

      <ConfirmDialog
        open={dialog !== null}
        title={dialog?.title ?? ''}
        description={dialog?.description ?? ''}
        confirmLabel={dialog?.confirmLabel ?? ''}
        danger={dialog?.danger ?? false}
        reason="none"
        onConfirm={async () => {
          if (!statusAction) return
          await runStatusAction(statusAction)
        }}
        onClose={() => setStatusAction(null)}
        onReload={() => {
          // 409: trạng thái bài đã đổi (người khác vừa công bố/gỡ) — đóng hộp và lấy bản mới.
          setStatusAction(null)
          void refresh().catch(() => setSaveError({ message: 'Không tải lại được bài viết.', fields: {}, stale: false }))
        }}
      />
    </>
  )
}

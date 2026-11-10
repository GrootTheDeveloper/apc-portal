import { type FormEvent, type ReactNode, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { AsyncState } from '../../../components/AsyncState.js'
import { Button } from '../../../components/Button.js'
import { buttonClass } from '../../../components/buttonClass.js'
import { ConfirmDialog } from '../../../components/ConfirmDialog.js'
import { useApi } from '../../../hooks/useApi.js'
import { useAuth } from '../../../hooks/useAuth.js'
import { api, ApiError } from '../../../lib/api.js'
import { hasRole } from '../../../lib/auth.js'
import { fieldErrors } from '../../../lib/formErrors.js'
import { formatDateTime } from '../../../lib/format.js'
import type { AboutData } from '../../about/types.js'
import { ProjectForm } from './ProjectForm.js'
import { departmentLabel } from './postTypes.js'
import {
  ACTION_LABEL,
  type AdminProjectDetail,
  type ProjectAction,
  type ProjectFormValues,
  PROJECT_STATUS_LABEL,
  PROJECT_TYPE_LABEL,
  initialProjectValues,
  projectStatusBadgeClass,
  projectTypeBadgeClass,
  updateProjectPayload,
  useDirtyFormWarning,
} from './projectTypes.js'

/** PAGE-MGT-PRJ-03 — sửa dự án (C4): lưu có kiểm tra xung đột (OCC), và đổi trạng thái theo PRD mục 9.2. */
export function AdminProjectEditPage() {
  const { id } = useParams<{ id: string }>()
  const project = useApi<AdminProjectDetail>(id ? `/admin/content/projects/${id}` : null)
  const about = useApi<AboutData>('/public/about')

  return (
    <main className="flex flex-col gap-8">
      <AsyncState
        loading={project.loading}
        error={project.error}
        empty={!project.data}
        emptyText="Không tìm thấy dự án."
        onRetry={project.reload}
      >
        {project.data && <EditProject project={project.data} departments={about.data?.departments ?? []} />}
      </AsyncState>
    </main>
  )
}

function EditProject({
  project,
  departments,
}: {
  project: AdminProjectDetail
  departments: { id: string; name: string }[]
}) {
  const { user } = useAuth()
  const board = hasRole(user, 'BOARD')

  const [detail, setDetail] = useState(project)
  const [values, setValues] = useState<ProjectFormValues>(() => initialProjectValues(project))
  // Bản OCC: gửi lại nguyên chuỗi `updatedAt` server trả về, không định dạng hay cắt bớt.
  const [baseline, setBaseline] = useState(project.updatedAt)
  const [pending, setPending] = useState(false)
  const [saveError, setSaveError] = useState<{
    message: string
    fields: Record<string, string[]>
    stale: boolean
  } | null>(null)
  const [savedAt, setSavedAt] = useState<Date | null>(null)
  const [statusAction, setStatusAction] = useState<ProjectAction | null>(null)

  // Quản lý ban chỉ sửa dự án Ẩn của ban mình; dự án đã công bố phải chờ BOARD gỡ công bố.
  const managerLocked = !board && detail.status !== 'DRAFT'
  const actions: ProjectAction[] =
    detail.status === 'DRAFT' ? ['publish', 'archive'] : detail.status === 'PUBLISHED' ? ['unpublish', 'archive'] : []
  const titleChanged = values.title.trim() !== '' && values.title.trim() !== detail.title

  // Cảnh báo khi rời trang còn thay đổi chưa lưu (STATE-08).
  const dirty = JSON.stringify(values) !== JSON.stringify(initialProjectValues(detail))
  useDirtyFormWarning(dirty && !pending)

  /** Đọc lại dự án từ server: dùng sau khi lưu và khi nút "Tải lại" của xung đột. */
  async function refresh() {
    const fresh = await api<AdminProjectDetail>(`/admin/content/projects/${detail.id}`)
    setDetail(fresh)
    setValues(initialProjectValues(fresh))
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
      await api(`/admin/content/projects/${detail.id}`, {
        method: 'PATCH',
        body: updateProjectPayload(values, baseline, board),
      })
      // PATCH trả về bản ghi không kèm members: đọc lại chi tiết để cập nhật danh sách thành viên và updatedAt mới.
      await refresh()
      setSavedAt(new Date())
    } catch (caught) {
      // 409: người khác vừa lưu dự án này (STATE-09) — không ghi đè, bắt buộc tải lại bản mới.
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

  /** Đổi trạng thái; lỗi (403, 409 sai bước chuyển hoặc OCC) để ConfirmDialog hiện ngay trong hộp. */
  async function runStatusAction(action: ProjectAction) {
    await api(`/admin/content/projects/${detail.id}/status`, {
      method: 'PATCH',
      body: { action, updatedAt: baseline },
    })
    setStatusAction(null)
    await refresh()
  }

  const dialog: { title: string; confirmLabel: string; danger: boolean; description: ReactNode } | null =
    statusAction === 'publish'
      ? {
          title: 'Công bố dự án',
          confirmLabel: ACTION_LABEL.publish,
          danger: false,
          description: (
            <>
              Dự án <strong>{detail.title}</strong> sẽ hiện công khai trên /projects ngay khi công bố. Thành viên
              chưa đồng ý công bố tên/ảnh sẽ tự bị ẩn khỏi trang công khai.
            </>
          ),
        }
      : statusAction === 'unpublish'
        ? {
            title: 'Gỡ công bố dự án',
            confirmLabel: ACTION_LABEL.unpublish,
            danger: true,
            description: (
              <>
                Dự án <strong>{detail.title}</strong> biến mất khỏi trang công khai và link cũ trả 404. Nội dung vẫn
                giữ nguyên ở trạng thái Ẩn để sửa tiếp.
              </>
            ),
          }
        : statusAction === 'archive'
          ? {
              title: 'Lưu trữ dự án',
              confirmLabel: ACTION_LABEL.archive,
              danger: true,
              description: (
                <>
                  Dự án <strong>{detail.title}</strong> chuyển sang Lưu trữ: không hiện ở đâu nữa và không công bố lại
                  được. Dự án không bị xóa khỏi hệ thống (BR-13).
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
            <span className={projectStatusBadgeClass(detail.status)}>{PROJECT_STATUS_LABEL[detail.status]}</span>
            <span className={projectTypeBadgeClass(detail.type)}>{PROJECT_TYPE_LABEL[detail.type]}</span>
            <span className="font-code text-[13px] text-muted">/{detail.slug}</span>
          </div>
        </div>
        <Link to={`/admin/content/projects/${detail.id}/preview`} className={buttonClass('outline')}>
          Xem trước
        </Link>
      </div>

      <dl className="grid gap-x-8 gap-y-3 rounded-2xl bg-soft px-5 py-4 text-[15px] sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <dt className="font-code text-[13px] font-bold text-muted">loại</dt>
          <dd className="mt-1 font-bold">{PROJECT_TYPE_LABEL[detail.type]}</dd>
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
          Dự án đã công bố: quản lý ban chỉ xem được. Cần sửa thì Ban Chủ nhiệm gỡ công bố trước.
        </p>
      )}

      {titleChanged && (
        <p role="status" className="rounded-2xl bg-apc-gold-pale px-5 py-4 text-[15px] font-bold text-ink">
          Đổi tiêu đề KHÔNG đổi đường dẫn của dự án (/{detail.slug}) — slug đóng băng từ lúc tạo (đặc tả C4).
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
        <ProjectForm
          values={values}
          onChange={(patch) => setValues((current) => ({ ...current, ...patch }))}
          fields={saveError?.fields ?? {}}
          disabled={pending || managerLocked}
          board={board}
          departments={departments}
          members={detail.members}
        />

        <div className="flex flex-wrap items-center gap-3 border-t-2 border-ink pt-6">
          <Button type="submit" disabled={pending || managerLocked}>
            {pending ? 'Đang lưu…' : 'Lưu thay đổi'}
          </Button>
          <Link to="/admin/content/projects" className={buttonClass('outline')}>
            Về danh sách
          </Link>
        </div>
      </form>

      {board && (
        <section className="flex flex-col gap-5 rounded-2xl border-2 border-ink p-5">
          <div>
            <h2 className="font-display text-[24px] font-extrabold">Trạng thái dự án</h2>
            <p className="mt-2 max-w-[70ch] text-[15px] text-muted">
              Công bố, gỡ và lưu trữ đều được ghi nhật ký (docs/02 §11). Dự án Lưu trữ không công bố lại được.
            </p>
          </div>

          {actions.length > 0 && (
            <div className="flex flex-wrap gap-3">
              {actions.map((action) => (
                <Button
                  key={action}
                  type="button"
                  variant={action === 'publish' ? 'primary' : 'outline'}
                  onClick={() => setStatusAction(action)}
                >
                  {ACTION_LABEL[action]}
                </Button>
              ))}
            </div>
          )}
        </section>
      )}

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
          // 409: dự án đã đổi (người khác vừa lưu/công bố) — đóng hộp và lấy bản mới.
          setStatusAction(null)
          void refresh().catch(() => setSaveError({ message: 'Không tải lại được dự án.', fields: {}, stale: false }))
        }}
      />
    </>
  )
}

import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { AsyncState } from '../../../../components/AsyncState'
import { Breadcrumb } from '../../../../components/Breadcrumb'
import { Button } from '../../../../components/Button'
import { buttonClass } from '../../../../components/buttonClass'
import { ConfirmDialog } from '../../../../components/ConfirmDialog'
import { FileUpload } from '../../../../components/FileUpload'
import { Seo } from '../../../../components/Seo'
import { inputClass, labelClass } from '../../../../components/formClass'
import { useApi } from '../../../../hooks/useApi'
import { api } from '../../../../lib/api'
import { formatDateTime } from '../../../../lib/format'
import type { AboutData } from '../../../about/types'
import { DocumentForm } from '../DocumentForm'
import type { DocumentItem } from '../types'

export function AdminDocumentDetailPage() {
  const { id } = useParams<{ id: string }>()
  const document = useApi<DocumentItem>(id ? `/admin/documents/${id}` : null)
  const about = useApi<AboutData>('/public/about')
  const [action, setAction] = useState<'archive' | 'restore' | null>(null)
  const [replacementId, setReplacementId] = useState('')
  const [replacementReason, setReplacementReason] = useState('')
  const [replaceError, setReplaceError] = useState('')
  const [replacePending, setReplacePending] = useState(false)

  async function changeStatus(values: { reason: string }) {
    if (!document.data || !id || !action) return
    await api(`/admin/documents/${id}/${action}`, { method: 'POST', body: { ...values, updatedAt: document.data.updatedAt } })
    setAction(null)
    document.reload()
  }

  async function replaceFile(event: React.FormEvent) {
    event.preventDefault()
    if (!document.data || !id || !replacementId) return
    setReplacePending(true)
    setReplaceError('')
    try {
      await api(`/admin/documents/${id}/versions`, { method: 'POST', body: { storedFileId: replacementId, reason: replacementReason, updatedAt: document.data.updatedAt } })
      setReplacementId('')
      setReplacementReason('')
      document.reload()
    } catch (caught) {
      setReplaceError(caught instanceof Error ? caught.message : 'Không thể thay tệp. Vui lòng thử lại.')
    } finally {
      setReplacePending(false)
    }
  }

  return (
    <main className="mx-auto max-w-4xl px-gutter py-10 md:py-14">
      <AsyncState loading={document.loading} error={document.error} empty={!document.data} emptyText="Không tìm thấy tài liệu." onRetry={document.reload}>
        {document.data && <>
          <Seo title={document.data.title} description="Quản lý tài liệu nội bộ APC." path={`/admin/documents/${id}`} robots="noindex, nofollow" />
          <Breadcrumb items={[{ label: 'quản trị', to: '/admin' }, { label: 'tài liệu', to: '/admin/documents' }, { label: document.data.title }]} />
          <div className="mt-5 flex flex-col justify-between gap-5 border-b-2 border-ink pb-6 sm:flex-row sm:items-end">
            <div>
              <p className="font-code text-xs font-bold uppercase text-apc-blue">{document.data.category} · {document.data.scope === 'CLUB' ? 'toàn câu lạc bộ' : document.data.department?.name}</p>
              <h1 className="mt-2 font-display text-3xl font-extrabold text-ink md:text-4xl">{document.data.title}</h1>
              {document.data.description && <p className="mt-3 max-w-2xl text-muted">{document.data.description}</p>}
              <p className="mt-3 text-sm text-muted">Cập nhật {formatDateTime(document.data.updatedAt)} · {document.data.status === 'ACTIVE' ? 'Đang hoạt động' : 'Đã lưu trữ'}</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link to={`/admin/documents/${id}/versions`} className={buttonClass('outline')}>Lịch sử phiên bản</Link>
              <Button type="button" variant={document.data.status === 'ACTIVE' ? 'primary' : 'outline'} onClick={() => setAction(document.data?.status === 'ACTIVE' ? 'archive' : 'restore')}>
                {document.data.status === 'ACTIVE' ? 'Lưu trữ' : 'Khôi phục tài liệu'}
              </Button>
            </div>
          </div>
          <section data-rv className="mt-7 border-b-2 border-ink/20 pb-7">
            <h2 className="font-display text-xl font-extrabold">Tệp hiện hành</h2>
            {document.data.currentVersion ? <div className="mt-3 flex flex-wrap items-center gap-4">
              <p>{document.data.currentVersion.originalName} · phiên bản {document.data.currentVersion.versionNumber} · {document.data.currentVersion.scanStatus === 'CLEAN' ? 'Đã quét sạch' : 'Đang cách ly để quét'}</p>
              {document.data.currentVersion.scanStatus === 'CLEAN' && <a className={buttonClass('light')} href={`/api/portal/documents/${id}/versions/${document.data.currentVersion.id}/download`}>Tải tệp</a>}
            </div> : <p className="mt-3 text-muted">Chưa có phiên bản.</p>}
          </section>
          {document.data.status === 'ACTIVE' && <section data-rv className="mt-7 border-b-2 border-ink/20 pb-7">
            <h2 className="font-display text-xl font-extrabold">Thay tệp</h2>
            <p className="mt-2 text-sm text-muted">Tệp cũ vẫn được giữ trong lịch sử phiên bản.</p>
            <form onSubmit={replaceFile} className="mt-4 flex max-w-2xl flex-col gap-5">
              <FileUpload purpose="DOCUMENT" label="Chọn tệp phiên bản mới" onUploaded={setReplacementId} />
              <label className={labelClass}>Lý do thay tệp<textarea className={`${inputClass} min-h-20 resize-y`} required minLength={3} maxLength={500} value={replacementReason} onChange={(event) => setReplacementReason(event.target.value)} /></label>
              {replaceError && <p role="alert" className="font-bold text-apc-red">{replaceError}</p>}
              <Button type="submit" disabled={!replacementId || replacePending}>{replacePending ? 'Đang lưu…' : 'Tạo phiên bản mới'}</Button>
            </form>
          </section>}
          {about.data && <section data-rv className="mt-7">
            <h2 className="mb-4 font-display text-xl font-extrabold">Thông tin và quyền xem</h2>
            <DocumentForm key={`${document.data.id}-${document.data.updatedAt}`} departments={about.data.departments} document={document.data} onSaved={() => document.reload()} />
          </section>}
          <ConfirmDialog
            open={action !== null}
            title={action === 'archive' ? 'Lưu trữ tài liệu?' : 'Khôi phục tài liệu?'}
            description={action === 'archive' ? <>Tài liệu <strong>{document.data.title}</strong> sẽ ẩn khỏi thư viện thành viên và không thể tải xuống.</> : <>Tài liệu <strong>{document.data.title}</strong> sẽ xuất hiện lại với người được cấp quyền.</>}
            confirmLabel={action === 'archive' ? 'Lưu trữ tài liệu' : 'Khôi phục tài liệu'}
            danger={action === 'archive'}
            onConfirm={changeStatus}
            onClose={() => setAction(null)}
            onReload={document.reload}
          />
        </>}
      </AsyncState>
      {!about.data && !about.loading && about.error && <p className="mt-6 text-apc-red">{about.error.message}</p>}
    </main>
  )
}

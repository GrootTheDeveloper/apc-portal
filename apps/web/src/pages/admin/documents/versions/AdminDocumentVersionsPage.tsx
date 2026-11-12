import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { AsyncState } from '../../../../components/AsyncState'
import { Breadcrumb } from '../../../../components/Breadcrumb'
import { Button } from '../../../../components/Button'
import { ConfirmDialog } from '../../../../components/ConfirmDialog'
import { Seo } from '../../../../components/Seo'
import { useApi } from '../../../../hooks/useApi'
import { api } from '../../../../lib/api'
import { formatDateTime } from '../../../../lib/format'
import type { DocumentItem, DocumentVersion } from '../types'
import { fileSize } from '../types'

export function AdminDocumentVersionsPage() {
  const { id } = useParams<{ id: string }>()
  const document = useApi<DocumentItem>(id ? `/admin/documents/${id}` : null)
  const versions = useApi<DocumentVersion[]>(id ? `/admin/documents/${id}/versions` : null)
  const [restoreVersion, setRestoreVersion] = useState<DocumentVersion | null>(null)

  async function restore(values: { reason: string }) {
    if (!id || !document.data || !restoreVersion) return
    await api(`/admin/documents/${id}/versions/${restoreVersion.id}/restore`, {
      method: 'POST',
      body: { ...values, updatedAt: document.data.updatedAt },
    })
    setRestoreVersion(null)
    document.reload()
    versions.reload()
  }

  const items = versions.data ?? []
  return (
    <main className="mx-auto max-w-4xl px-gutter py-10 md:py-14">
      <AsyncState loading={document.loading || versions.loading} error={document.error ?? versions.error} empty={!document.data} emptyText="Không tìm thấy tài liệu." onRetry={() => { document.reload(); versions.reload() }}>
        {document.data && <>
          <Seo title={`Phiên bản · ${document.data.title}`} description="Lịch sử phiên bản tài liệu nội bộ APC." path={`/admin/documents/${id}/versions`} robots="noindex, nofollow" />
          <Breadcrumb items={[{ label: 'quản trị', to: '/admin' }, { label: 'tài liệu', to: '/admin/documents' }, { label: document.data.title, to: `/admin/documents/${id}` }, { label: 'phiên bản' }]} />
          <p className="mt-5 font-code text-xs font-bold uppercase text-apc-blue">lịch sử tệp</p>
          <h1 className="mt-2 font-display text-3xl font-extrabold text-ink">Các phiên bản · {document.data.title}</h1>
          <div className="mt-7">
            <AsyncState loading={versions.loading} error={versions.error} empty={items.length === 0} emptyText="Tài liệu chưa có phiên bản." onRetry={versions.reload}>
              <div className="divide-y-2 divide-ink/20 border-y-2 border-ink/20">
                {items.map((version) => (
                  <article key={version.id} className="flex flex-col justify-between gap-4 py-5 sm:flex-row sm:items-center">
                    <div>
                      <h2 className="font-display text-lg font-extrabold">Phiên bản {version.versionNumber}{version.isCurrent ? ' · hiện hành' : ''}</h2>
                      <p className="mt-1 text-sm text-muted">{version.storedFile.originalName} · {fileSize(version.storedFile.size)} · {version.storedFile.scanStatus === 'CLEAN' ? 'Đã quét sạch' : 'Đang cách ly'}</p>
                      <p className="mt-1 text-xs text-muted">Tải lên bởi {version.uploadedBy.fullName} · {formatDateTime(version.createdAt)}</p>
                    </div>
                    <div className="flex flex-wrap gap-3">
                      {version.storedFile.scanStatus === 'CLEAN' && <a className="inline-flex min-h-12 items-center rounded-xl bg-paper px-5 font-bold text-apc-blue shadow-[inset_0_0_0_2px_#081F3D]" href={`/api/portal/documents/${id}/versions/${version.id}/download`}>Tải bản này</a>}
                      {!version.isCurrent && <Button type="button" variant="outline" onClick={() => setRestoreVersion(version)}>Khôi phục bản này</Button>}
                    </div>
                  </article>
                ))}
              </div>
            </AsyncState>
          </div>
          <Link to={`/admin/documents/${id}`} className="mt-8 inline-flex font-bold text-apc-blue hover:underline">← Trở về tài liệu</Link>
          <ConfirmDialog
            open={!!restoreVersion}
            title="Khôi phục phiên bản?"
            description={<>Nội dung của phiên bản <strong>{restoreVersion?.versionNumber}</strong> sẽ trở thành bản hiện hành bằng cách tạo một phiên bản mới. Các bản cũ vẫn được giữ.</>}
            confirmLabel="Tạo phiên bản khôi phục"
            onConfirm={restore}
            onClose={() => setRestoreVersion(null)}
            onReload={() => { document.reload(); versions.reload() }}
          />
        </>}
      </AsyncState>
    </main>
  )
}

import { Link, useParams } from 'react-router-dom'

import { AsyncState } from '../../../../components/AsyncState'
import { Breadcrumb } from '../../../../components/Breadcrumb'
import { buttonClass } from '../../../../components/buttonClass'
import { Seo } from '../../../../components/Seo'
import { useApi } from '../../../../hooks/useApi'
import { formatDateTime } from '../../../../lib/format'
import type { DocumentItem } from '../../../admin/documents/types'
import { fileSize } from '../../../admin/documents/types'

export function PortalDocumentDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { data, loading, error, reload } = useApi<DocumentItem>(id ? `/portal/documents/${id}` : null)
  return (
    <main className="mx-auto max-w-3xl px-gutter py-10 md:py-14">
      <AsyncState loading={loading} error={error} empty={!data} emptyText="Không tìm thấy tài liệu." onRetry={reload}>
        {data && <>
          <Seo title={data.title} description="Tài liệu nội bộ APC dành cho thành viên." path={`/portal/documents/${id}`} robots="noindex, nofollow" />
          <Breadcrumb items={[{ label: 'portal', to: '/portal' }, { label: 'tài liệu', to: '/portal/documents' }, { label: data.title }]} />
          <p className="mt-5 font-code text-xs font-bold uppercase text-apc-blue">{data.category} · {data.scope === 'CLUB' ? 'toàn câu lạc bộ' : data.department?.name}</p>
          <h1 className="mt-2 font-display text-3xl font-extrabold text-ink md:text-4xl">{data.title}</h1>
          {data.description && <p className="mt-4 text-lg leading-relaxed text-muted">{data.description}</p>}
          <p className="mt-4 text-sm text-muted">Cập nhật {formatDateTime(data.updatedAt)}</p>
          <section data-rv className="mt-8 border-y-2 border-ink py-6">
            <h2 className="font-display text-xl font-extrabold">Phiên bản hiện hành</h2>
            {data.currentVersion?.scanStatus === 'CLEAN' ? <div className="mt-4 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
              <div>
                <p className="font-bold">{data.currentVersion.originalName}</p>
                <p className="mt-1 text-sm text-muted">Phiên bản {data.currentVersion.versionNumber} · {fileSize(data.currentVersion.size)}</p>
              </div>
              <a className={buttonClass('primary')} href={`/api/portal/documents/${id}/versions/${data.currentVersion.id}/download`}>Tải tài liệu</a>
            </div> : <p className="mt-3 text-muted">Tệp đang được quét bảo mật. Vui lòng thử lại sau.</p>}
          </section>
          <Link to="/portal/documents" className="mt-7 inline-flex font-bold text-apc-blue hover:underline">← Trở lại thư viện</Link>
        </>}
      </AsyncState>
    </main>
  )
}

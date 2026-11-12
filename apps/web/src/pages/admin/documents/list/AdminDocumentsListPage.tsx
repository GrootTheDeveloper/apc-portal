import { Link, useSearchParams } from 'react-router-dom'

import { AsyncState } from '../../../../components/AsyncState'
import { Breadcrumb } from '../../../../components/Breadcrumb'
import { buttonClass } from '../../../../components/buttonClass'
import { Pagination } from '../../../../components/Pagination'
import { Seo } from '../../../../components/Seo'
import { useApi } from '../../../../hooks/useApi'
import type { Page } from '../../../../lib/api'
import { formatDateTime } from '../../../../lib/format'
import type { DocumentItem } from '../types'

export function AdminDocumentsListPage() {
  const [params, setParams] = useSearchParams()
  const page = Number(params.get('page') || 1)
  const status = params.get('status') || 'ALL'
  const { data, loading, error, reload } = useApi<Page<DocumentItem>>(`/admin/documents?page=${page}&pageSize=20&status=${status}`)
  const documents = data?.items ?? []

  function updateParam(key: string, value: string) {
    const next = new URLSearchParams(params)
    if (value === 'ALL' || value === '') next.delete(key)
    else next.set(key, value)
    if (key !== 'page') next.set('page', '1')
    setParams(next)
  }

  return (
    <main className="mx-auto max-w-container-max px-gutter py-10 md:py-14">
      <Seo title="Tài liệu nội bộ" description="Quản lý thư viện tài liệu APC." path="/admin/documents" robots="noindex, nofollow" />
      <Breadcrumb items={[{ label: 'quản trị', to: '/admin' }, { label: 'tài liệu' }]} />
      <div className="mt-4 flex flex-col justify-between gap-4 border-b-2 border-ink pb-6 sm:flex-row sm:items-end">
        <div>
          <p className="font-code text-xs font-bold uppercase text-apc-blue">thư viện nội bộ</p>
          <h1 className="mt-2 font-display text-3xl font-extrabold text-ink md:text-4xl">Tài liệu</h1>
        </div>
        <Link to="/admin/documents/upload" className={buttonClass('primary')}>+ Tải tài liệu lên</Link>
      </div>
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <label htmlFor="document-status" className="font-code text-xs font-bold uppercase">Trạng thái</label>
        <select id="document-status" className="rounded-xl bg-paper px-3 py-2 font-body shadow-[inset_0_0_0_2px_#081F3D]" value={status} onChange={(event) => updateParam('status', event.target.value)}>
          <option value="ALL">Tất cả</option>
          <option value="ACTIVE">Đang hoạt động</option>
          <option value="ARCHIVED">Đã lưu trữ</option>
        </select>
      </div>
      <div className="mt-8">
        <AsyncState loading={loading} error={error} empty={documents.length === 0} emptyText="Chưa có tài liệu phù hợp." onRetry={reload}>
          <div className="grid gap-4">
            {documents.map((document) => (
              <article key={document.id} data-rv className="border-b-2 border-ink/20 py-5">
                <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                  <div>
                    <p className="font-code text-xs font-bold uppercase text-apc-blue">{document.category} · {document.scope === 'CLUB' ? 'Toàn câu lạc bộ' : document.department?.name ?? 'Ban lưu trữ'}</p>
                    <h2 className="mt-1 font-display text-xl font-extrabold"><Link className="hover:text-apc-red" to={`/admin/documents/${document.id}`}>{document.title}</Link></h2>
                    <p className="mt-1 text-sm text-muted">{document.currentVersion ? `Phiên bản ${document.currentVersion.versionNumber} · ${document.currentVersion.originalName}` : 'Chưa có phiên bản'}</p>
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <span className={document.status === 'ACTIVE' ? 'font-bold text-apc-blue' : 'font-bold text-muted'}>{document.status === 'ACTIVE' ? 'Đang hoạt động' : 'Đã lưu trữ'}</span>
                    <span className="font-code text-xs text-muted">{formatDateTime(document.updatedAt)}</span>
                    <Link className="font-bold text-apc-blue hover:underline" to={`/admin/documents/${document.id}`}>Quản lý →</Link>
                  </div>
                </div>
              </article>
            ))}
          </div>
          {data && data.total > data.pageSize && <div className="mt-8 flex justify-center"><Pagination currentPage={page} totalPages={Math.ceil(data.total / data.pageSize)} onPageChange={(nextPage) => updateParam('page', String(nextPage))} /></div>}
        </AsyncState>
      </div>
    </main>
  )
}

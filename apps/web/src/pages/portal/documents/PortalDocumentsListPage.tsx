import { Link, useSearchParams } from 'react-router-dom'

import { AsyncState } from '../../../components/AsyncState'
import { Breadcrumb } from '../../../components/Breadcrumb'
import { Pagination } from '../../../components/Pagination'
import { Seo } from '../../../components/Seo'
import { useApi } from '../../../hooks/useApi'
import type { Page } from '../../../lib/api'
import { formatDateTime } from '../../../lib/format'
import type { DocumentItem } from '../../admin/documents/types'

export function PortalDocumentsListPage() {
  const [params, setParams] = useSearchParams()
  const page = Number(params.get('page') || 1)
  const { data, loading, error, reload } = useApi<Page<DocumentItem>>(`/portal/documents?page=${page}&pageSize=20`)
  const documents = data?.items ?? []
  function changePage(nextPage: number) {
    const next = new URLSearchParams(params)
    next.set('page', String(nextPage))
    setParams(next)
  }
  return (
    <main className="mx-auto max-w-container-max px-gutter py-10 md:py-14">
      <Seo title="Tài liệu của bạn" description="Thư viện tài liệu nội bộ APC dành cho thành viên." path="/portal/documents" robots="noindex, nofollow" />
      <Breadcrumb items={[{ label: 'portal', to: '/portal' }, { label: 'tài liệu' }]} />
      <p className="mt-5 font-code text-xs font-bold uppercase text-apc-blue">thư viện nội bộ</p>
      <h1 className="mt-2 font-display text-3xl font-extrabold text-ink md:text-4xl">Tài liệu của bạn</h1>
      <div className="mt-8">
        <AsyncState loading={loading} error={error} empty={documents.length === 0} emptyText="Hiện chưa có tài liệu nào được cấp cho bạn." onRetry={reload}>
          <div className="grid gap-4">
            {documents.map((document) => (
              <article key={document.id} data-rv className="border-b-2 border-ink/20 py-5">
                <p className="font-code text-xs font-bold uppercase text-apc-blue">{document.category} · {document.scope === 'CLUB' ? 'toàn câu lạc bộ' : document.department?.name}</p>
                <h2 className="mt-1 font-display text-xl font-extrabold"><Link to={`/portal/documents/${document.id}`} className="hover:text-apc-red">{document.title}</Link></h2>
                {document.description && <p className="mt-2 text-muted">{document.description}</p>}
                <p className="mt-2 text-xs text-muted">Cập nhật {formatDateTime(document.updatedAt)}</p>
              </article>
            ))}
          </div>
          {data && data.total > data.pageSize && <div className="mt-8 flex justify-center"><Pagination currentPage={page} totalPages={Math.ceil(data.total / data.pageSize)} onPageChange={changePage} /></div>}
        </AsyncState>
      </div>
    </main>
  )
}

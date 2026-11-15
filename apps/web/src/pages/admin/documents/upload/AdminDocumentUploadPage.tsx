import { useNavigate } from 'react-router-dom'

import { AsyncState } from '../../../../components/AsyncState'
import { Breadcrumb } from '../../../../components/Breadcrumb'
import { Seo } from '../../../../components/Seo'
import { useApi } from '../../../../hooks/useApi'
import type { AboutData } from '../../../about/types'
import type { DocumentItem } from '../types'
import { DocumentForm } from '../DocumentForm'

export function AdminDocumentUploadPage() {
  const navigate = useNavigate()
  const about = useApi<AboutData>('/public/about')
  return (
    <main className="mx-auto max-w-3xl px-gutter py-10 md:py-14">
      <Seo title="Tải tài liệu lên" description="Tải tài liệu nội bộ APC." path="/admin/documents/upload" robots="noindex, nofollow" />
      <Breadcrumb items={[{ label: 'quản trị', to: '/admin' }, { label: 'tài liệu', to: '/admin/documents' }, { label: 'tải tài liệu lên' }]} />
      <p className="mt-5 font-code text-xs font-bold uppercase text-apc-blue">thư viện nội bộ</p>
      <h1 className="mt-2 font-display text-3xl font-extrabold text-ink">Tải tài liệu lên</h1>
      <p className="mt-3 max-w-2xl text-muted">Tệp được quét trước khi thành viên có thể tải. Tệp nội bộ không có đường dẫn kho công khai.</p>
      <div className="mt-8">
        <AsyncState loading={about.loading} error={about.error} empty={!about.data} emptyText="Chưa tải được danh sách ban." onRetry={about.reload}>
          {about.data && <DocumentForm departments={about.data.departments} onSaved={(document: DocumentItem) => navigate(`/admin/documents/${document.id}`)} />}
        </AsyncState>
      </div>
    </main>
  )
}

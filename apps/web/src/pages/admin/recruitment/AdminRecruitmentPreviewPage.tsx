import { Link, useParams } from 'react-router-dom'
import { AsyncState } from '../../../components/AsyncState'
import { buttonClass } from '../../../components/buttonClass'
import { useApi } from '../../../hooks/useApi'
import { RecruitmentDetailContent } from '../../recruitment/detail/RecruitmentDetailPage'
import type { RecruitmentRound } from '../../recruitment/types'

export function AdminRecruitmentPreviewPage() {
  const { id } = useParams<{ id: string }>()
  // Reviewer item 20: Dùng đúng route preview của API
  const { data: round, loading, error, reload } = useApi<RecruitmentRound>(
    id ? `/admin/recruitment/${id}/preview` : null,
  )

  // Reviewer Item 20: Khi preview đợt DRAFT, giả lập như đang OPEN để admin xem trước được nút Ứng tuyển
  const previewRound = round && round.status === 'DRAFT'
    ? { ...round, status: 'OPEN' as const }
    : round

 return (
    <div className="min-h-screen">
      {/* Banner xem trước chế độ Admin */}
      <div className="sticky top-0 z-30 flex flex-wrap items-center justify-between gap-3 border-b-2 border-ink bg-soft px-6 py-3">
        <div className="flex items-center gap-3 text-sm font-bold text-ink">
          <span className="font-code text-xs uppercase text-apc-blue">{'// xem trước'}</span>
          <span>Chế độ xem trước đợt tuyển (Admin Preview)</span>
          {round && (
            <span className="rounded-md bg-ink px-2.5 py-0.5 font-code text-xs text-paper">
              Trạng thái thực: {round.status}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {round && (
            <Link to={`/admin/recruitment/${round.id}/edit`} className={buttonClass('outline')}>
              Chỉnh sửa
            </Link>
          )}
          <Link
            to={round ? `/admin/recruitment/${round.id}` : '/admin/recruitment'}
            className={buttonClass('primary')}
          >
            ← Quay lại quản lý
          </Link>
        </div>
      </div>
      {/* Reviewer Item 20: Không lồng thêm thẻ <main> vì bên trong RecruitmentDetailContent đã có <main> */}
      <div className="mx-auto w-full">
        <AsyncState
          loading={loading}
          error={error}
          empty={!round}
          onRetry={reload}
          emptyText="Không tìm thấy đợt tuyển để xem trước."
        >
          {previewRound && <RecruitmentDetailContent round={previewRound} />}
        </AsyncState>
      </div>
    </div>
  )
}
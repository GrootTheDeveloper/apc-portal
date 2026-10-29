import { Link, useParams } from 'react-router-dom'
import { AsyncState } from '../../../components/AsyncState'
import { Button } from '../../../components/Button'
import { useApi } from '../../../hooks/useApi'
import { RecruitmentDetailContent } from '../../recruitment/detail/RecruitmentDetailPage'
import type { RecruitmentRound } from '../../recruitment/types'

export function AdminRecruitmentPreviewPage() {
  const { id } = useParams<{ id: string }>()
  const { data: round, loading, error, reload } = useApi<RecruitmentRound>(
    id ? `/admin/recruitment/${id}` : null,
  )

  return (
    <div className="min-h-screen">
      {/* Banner xem trước chế độ Admin */}
      <div className="sticky top-0 z-30 flex flex-wrap items-center justify-between gap-3 bg-amber-500/15 border-b border-amber-500/30 px-6 py-3 backdrop-blur bg-amber-50">
        <div className="flex items-center gap-2 text-sm font-semibold text-amber-950">
          <span className="material-symbols-outlined text-amber-700">visibility</span>
          <span>Chế độ xem trước đợt tuyển (Admin Preview)</span>
          {round && (
            <span className="rounded-full bg-amber-200/80 px-2.5 py-0.5 text-xs font-bold text-amber-900">
              Trạng thái: {round.status}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {round && (
            <Link to={`/admin/recruitment/${round.id}/edit`}>
              <Button variant="outline" className="text-xs py-1.5 px-3">
                <span className="material-symbols-outlined text-sm">edit</span>
                Chỉnh sửa
              </Button>
            </Link>
          )}
          <Link to={round ? `/admin/recruitment/${round.id}` : '/admin/recruitment'}>
            <Button variant="primary" className="text-xs py-1.5 px-3 shadow-sm">
              ← Quay lại trang quản lý
            </Button>
          </Link>
        </div>
      </div>

      <main className="mx-auto max-w-container-max px-gutter py-10 md:py-14">
        <AsyncState
          loading={loading}
          error={error}
          empty={!round}
          onRetry={reload}
          emptyText="Không tìm thấy đợt tuyển để xem trước."
        >
          {round && <RecruitmentDetailContent round={round} />}
        </AsyncState>
      </main>
    </div>
  )
}
import { Link } from 'react-router-dom'
import { formatDateTime } from '../../../lib/format'
import type { RecruitmentRoundItem } from '../mock'

export function RecruitmentCard({ round }: { round: RecruitmentRoundItem }) {
  const now = new Date()
  const opensAt = new Date(round.opensAt)
  const closesAt = new Date(round.closesAt)

  const isUpcoming = round.status === 'OPEN' && now < opensAt
  const isOpen = round.status === 'OPEN' && now >= opensAt && now <= closesAt
  const isClosed = round.status === 'CLOSED' || now > closesAt

  return (
    <article className="flex flex-col justify-between rounded-apc border border-outline-variant bg-surface-container-lowest p-6 shadow-sm transition-all hover:border-outline-variant/80 hover:shadow-md">
      <div>
        <div className="flex items-center justify-between gap-3">
          <span className="font-label-mono text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
            {round.departments.length} ban đang tuyển
          </span>
          {isOpen && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 animate-pulse" />
              Đang nhận đơn
            </span>
          )}
          {isUpcoming && (
            <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
              Sắp mở
            </span>
          )}
          {isClosed && (
            <span className="inline-flex items-center rounded-full bg-surface-container-high px-2.5 py-1 text-xs font-medium text-on-surface-variant">
              Đã đóng nhận đơn
            </span>
          )}
        </div>

        <h3 className="mt-4 text-xl font-bold text-on-surface hover:text-apc-red transition-colors">
          <Link to={`/recruitment/${round.slug}`}>{round.title}</Link>
        </h3>
        <p className="mt-2 line-clamp-2 text-sm text-on-surface-variant leading-relaxed">
          {round.description}
        </p>

        <div className="mt-5 space-y-2 border-t border-outline-variant/40 pt-4 text-xs text-on-surface-variant">
          <div className="flex items-center gap-2">
            <span className="font-medium text-on-surface">Thời gian:</span>
            <span>{formatDateTime(round.opensAt)} – {formatDateTime(round.closesAt)}</span>
          </div>
          <div className="flex flex-wrap gap-1.5 pt-1">
            {round.departments.map((dept) => (
              <span
                key={dept.id}
                className="rounded bg-surface-container px-2 py-0.5 text-xs text-on-surface-variant"
              >
                {dept.name.split('(')[0].trim()}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-6 pt-2">
        <Link
          to={`/recruitment/${round.slug}`}
          className="inline-flex w-full items-center justify-center gap-2 rounded-apc border border-apc-blue px-4 py-2.5 text-sm font-medium text-apc-blue hover:bg-surface-container-low transition-colors"
        >
          Xem chi tiết đợt tuyển
          <span className="material-symbols-outlined text-base">arrow_forward</span>
        </Link>
      </div>
    </article>
  )
}
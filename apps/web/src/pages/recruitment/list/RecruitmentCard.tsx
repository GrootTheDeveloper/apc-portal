import { Link } from 'react-router-dom'

import { formatDateTime } from '../../../lib/format'
import type { RecruitmentRoundItem } from '../mock'
import { roundPhase } from '../roundPhase'

// Class literal để Tailwind JIT nhận diện được.
const PHASE_CHIPS = {
  open: { label: 'đang nhận đơn', className: 'bg-apc-red text-paper' },
  upcoming: { label: 'sắp mở', className: 'bg-apc-gold text-ink' },
  closed: { label: 'đã đóng', className: 'bg-ink/10 text-ink/70' },
} as const

/** Nhãn giai đoạn của đợt tuyển; dùng cho danh sách và trang chi tiết. */
export function PhaseChip({ round }: { round: RecruitmentRoundItem }) {
  const chip = PHASE_CHIPS[roundPhase(round)]
  return <span className={`rounded-md px-2 py-1 font-code text-[13px] font-bold ${chip.className}`}>{chip.label}</span>
}

/** Một hàng trong danh sách đợt tuyển: cả hàng bấm được, rê chuột thì tên đổi màu và mũi tên nhích sang. */
export function RecruitmentCard({ round }: { round: RecruitmentRoundItem }) {
  return (
    <article className="group relative grid gap-5 border-b-2 border-ink py-8 md:grid-cols-[minmax(0,1fr)_minmax(0,360px)_40px] md:items-center md:gap-10">
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-3">
          <PhaseChip round={round} />
          <span className="font-code text-[13px] font-bold text-muted">{round.departments.length} ban đang tuyển</span>
        </p>
        <h3 className="mt-3 font-display text-[clamp(24px,2.4vw,34px)] font-bold leading-[1.1] transition-colors group-hover:text-apc-red">
          {/* phủ cả hàng để bấm chỗ nào cũng vào chi tiết */}
          <Link to={`/recruitment/${round.slug}`} className="after:absolute after:inset-0">
            {round.title}
          </Link>
        </h3>
        <p className="mt-2 line-clamp-2 max-w-[60ch] text-[16px] leading-relaxed text-muted">{round.description}</p>
      </div>
      <div className="text-[15px]">
        <p className="font-code text-[13px] font-bold text-muted">nhận đơn</p>
        <b className="mt-0.5 block">
          {formatDateTime(round.opensAt)} – {formatDateTime(round.closesAt)}
        </b>
        <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Ban đang tuyển">
          {round.departments.map((department) => (
            <li key={department.id} className="rounded-md bg-ink px-2 py-1 font-code text-[13px] font-bold text-paper" title={department.name}>
              {department.code}
            </li>
          ))}
        </ul>
      </div>
      <span aria-hidden className="hidden text-[28px] font-extrabold transition-transform group-hover:translate-x-1 md:block">
        →
      </span>
    </article>
  )
}

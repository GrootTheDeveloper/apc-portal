import type { CSSProperties } from 'react'
import { Link, useParams } from 'react-router-dom'
import { AsyncState } from '../../../components/AsyncState'
import { Breadcrumb } from '../../../components/Breadcrumb'
import { buttonClass } from '../../../components/buttonClass'
import { PageHero } from '../../../components/PageHero'
import { useApi } from '../../../hooks/useApi'
import { formatDateTime } from '../../../lib/format'
import { NotFound } from '../../NotFound'
import { PhaseChip } from '../list/RecruitmentCard'
import { roundPhase } from '../roundPhase'
import type { RecruitmentRound } from '../types'

export function RecruitmentDetailPage() {
  const { slug } = useParams<{ slug: string }>()
  const { data: round, loading, error, reload } = useApi<RecruitmentRound>(
    slug ? `/public/recruitment-rounds/${slug}` : null,
  )

  if (!loading && !error && !round) return <NotFound />

  return (
    <AsyncState loading={loading} error={error} empty={false} onRetry={reload}>
      {round && <RecruitmentDetailContent round={round} />}
    </AsyncState>
  )
}

export function RecruitmentDetailContent({ round }: { round: RecruitmentRound }) {
  const phase = roundPhase(round)

  return (
    <main>
      <PageHero
        tone="red"
        compact
        top={
          <Breadcrumb
            items={[
              { label: 'trang chủ', to: '/' },
              { label: 'gia nhập apc', to: '/recruitment' },
              { label: round.title },
            ]}
          />
        }
        comment="đợt tuyển thành viên"
        title={round.title}
        lede={round.description}
      >
        {/* Đợt chưa mở hoặc đã đóng thì không có nút Ứng tuyển */}
        <div className="mt-8 flex flex-wrap items-center gap-x-8 gap-y-5">
          {phase === 'open' && (
            <Link to={`/recruitment/${round.slug}/apply`} className={buttonClass('light')}>
              Ứng tuyển ngay →
            </Link>
          )}
          <p className="text-[16px]">
            <span className="block font-code text-[13px] font-bold opacity-80">nhận hồ sơ</span>
            <b>
              {formatDateTime(round.opensAt)} – {formatDateTime(round.closesAt)}
            </b>
          </p>
          {phase === 'upcoming' && (
            <b className="rounded-xl bg-paper px-4 py-3 text-ink">
              Mở nhận đơn từ {formatDateTime(round.opensAt)}
            </b>
          )}
          {phase === 'closed' && <PhaseChip round={round} />}
        </div>
      </PageHero>

      <section className="px-4 py-[clamp(40px,7vh,80px)] md:px-8">
        <div className="mx-auto w-full max-w-container-max">
          <div className="grid gap-12 md:grid-cols-2 lg:gap-16">
            <div data-rv>
              <h2 className="border-b-2 border-ink pb-3 font-display text-[28px] font-extrabold leading-none">
                Ai nên nộp
              </h2>
              <p className="mt-5 text-[18px] leading-relaxed">{round.audience}</p>
            </div>
            <div data-rv style={{ '--d': '90ms' } as CSSProperties}>
              <h2 className="border-b-2 border-ink pb-3 font-display text-[28px] font-extrabold leading-none">
                Yêu cầu
              </h2>
              <p className="mt-5 text-[18px] leading-relaxed">{round.requirements}</p>
            </div>
          </div>

          <h2 className="mt-[clamp(48px,8vh,88px)] font-display text-[clamp(28px,3vw,44px)] font-extrabold leading-none">
            Các ban tuyển đợt này
          </h2>
          <ul className="mt-8 grid gap-x-10 gap-y-10 md:grid-cols-3">
            {round.departments.map((department, index) => (
              <li
                key={department.id}
                data-rv
                className="border-t-2 border-ink pt-5"
                style={{ '--d': `${index * 90}ms` } as CSSProperties}
              >
                <span className="rounded-md bg-ink px-2 py-1 font-code text-[13px] font-bold text-paper">
                  {department.code}
                </span>
                <h3 className="mt-4 font-display text-[22px] font-bold leading-[1.15]">{department.name}</h3>
                {department.description && (
                  <p className="mt-2 text-[16px] leading-relaxed text-muted">{department.description}</p>
                )}
              </li>
            ))}
          </ul>

          {/* Dữ liệu thu thập & thông báo quyền riêng tư (R1, REC-04) */}
          <div className="mt-[clamp(48px,8vh,88px)] rounded-[20px] bg-soft p-6 md:p-8">
            <p className="font-code text-[14px] font-bold text-apc-blue">{'// dữ liệu ứng viên'}</p>
            <p className="mt-2 max-w-[80ch] text-[16px] leading-relaxed">
              Khi nộp đơn, APC thu thập họ tên, email, MSSV, khoa/ngành và câu trả lời của bạn chỉ để xét duyệt thành viên. Dữ liệu được
              bảo vệ theo{' '}
              <Link
                to="/privacy"
                className="font-bold text-apc-blue underline decoration-2 underline-offset-4 hover:text-apc-red"
              >
                Chính sách quyền riêng tư
              </Link>{' '}
              của câu lạc bộ.
            </p>
          </div>
        </div>
      </section>
    </main>
  )
}

import { Link, useParams } from 'react-router-dom'

import { AsyncState } from '../../../components/AsyncState'
import { Breadcrumb } from '../../../components/Breadcrumb'
import { Button } from '../../../components/Button'
import { Eyebrow } from '../../../components/Eyebrow'
import { useMockApi } from '../../../hooks/useMockApi'
import { formatDateTime } from '../../../lib/format'
import { NotFound } from '../../NotFound'
import { getRecruitmentRound, type RecruitmentRoundItem } from '../mock'
import { roundPhase } from '../roundPhase'

export function RecruitmentDetailPage() {
  const { slug } = useParams<{ slug: string }>()
  const { data: round, loading, error, reload } = useMockApi(
    () => (slug ? getRecruitmentRound(slug) : Promise.resolve(null)),
    [slug],
  )

  if (!loading && !error && !round) return <NotFound />

  return (
    <AsyncState loading={loading} error={error} empty={false} onRetry={reload}>
      {round && <RoundDetail round={round} />}
    </AsyncState>
  )
}

function RoundDetail({ round }: { round: RecruitmentRoundItem }) {
  const phase = roundPhase(round)
  const isOpen = phase === 'open'
  const isUpcoming = phase === 'upcoming'
  const isClosed = phase === 'closed'

  return (
    <main className="mx-auto max-w-container-max px-gutter py-10 md:py-14">
      {/* Breadcrumb */}
      <Breadcrumb
        items={[
          { label: 'Trang chủ', to: '/' },
          { label: 'Gia nhập APC', to: '/recruitment' },
          { label: round.title },
        ]}
      />

      {/* Header đợt tuyển */}
      <div className="rounded-apc border border-outline-variant bg-surface-container-lowest p-8 md:p-10 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <Eyebrow>Đợt tuyển thành viên</Eyebrow>
          {isOpen && (
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
              Đang mở nhận đơn
            </span>
          )}
          {isUpcoming && (
            <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
              Sắp mở
            </span>
          )}
          {isClosed && (
            <span className="rounded-full bg-surface-container-high px-3 py-1 text-xs font-medium text-on-surface-variant">
              Đã đóng nhận đơn
            </span>
          )}
        </div>

        <h1 className="mt-4 text-3xl md:text-4xl font-extrabold text-on-surface">{round.title}</h1>
        <p className="mt-4 text-base md:text-lg text-on-surface-variant leading-relaxed max-w-3xl">
          {round.description}
        </p>

        {/* Action Card: Theo đúng yêu cầu "Đợt chưa mở hoặc đã đóng không có nút Ứng tuyển" */}
        <div className="mt-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-apc bg-surface-container p-6 border border-outline-variant/60">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">Thời hạn nhận hồ sơ</p>
            <p className="mt-1 text-sm md:text-base font-medium text-on-surface">
              {formatDateTime(round.opensAt)} – {formatDateTime(round.closesAt)}
            </p>
          </div>

          <div className="shrink-0">
            {isOpen && (
              <Link to={`/recruitment/${round.slug}/apply`}>
                <Button variant="primary" className="w-full sm:w-auto shadow-md">
                  Ứng tuyển ngay
                </Button>
              </Link>
            )}
            {isUpcoming && (
              <div className="inline-flex items-center gap-2 rounded-apc border border-amber-300 bg-amber-50 px-5 py-3 text-sm font-semibold text-amber-800">
                <span className="material-symbols-outlined text-lg">schedule</span>
                Mở nhận đơn từ {formatDateTime(round.opensAt)}
              </div>
            )}
            {isClosed && (
              <div className="inline-flex items-center gap-2 rounded-apc border border-outline-variant bg-surface-container-high px-5 py-3 text-sm font-medium text-on-surface-variant">
                <span className="material-symbols-outlined text-lg">lock</span>
                Đã đóng nhận đơn
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Thông tin chi tiết: Đối tượng & Điều kiện */}
      <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-8">
        <section className="rounded-apc border border-outline-variant bg-surface-container-lowest p-7">
          <h2 className="flex items-center gap-2 text-lg font-bold text-on-surface">
            <span className="material-symbols-outlined text-apc-blue">group</span>
            Đối tượng tuyển chọn
          </h2>
          <p className="mt-3 text-sm md:text-base text-on-surface-variant leading-relaxed">
            {round.audience}
          </p>
        </section>

        <section className="rounded-apc border border-outline-variant bg-surface-container-lowest p-7">
          <h2 className="flex items-center gap-2 text-lg font-bold text-on-surface">
            <span className="material-symbols-outlined text-apc-red">fact_check</span>
            Yêu cầu & Điều kiện
          </h2>
          <p className="mt-3 text-sm md:text-base text-on-surface-variant leading-relaxed">
            {round.requirements}
          </p>
        </section>
      </div>

      {/* Các ban chuyên môn đang tuyển */}
      <section className="mt-10">
        <h2 className="text-2xl font-bold text-on-surface mb-6">Các ban chuyên môn tuyển đợt này</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {round.departments.map((dept) => (
            <div key={dept.id} className="rounded-apc border border-outline-variant bg-surface-container-lowest p-6">
              <span className="inline-block rounded bg-primary-pale px-2.5 py-1 text-xs font-bold text-apc-red mb-3">
                {dept.code}
              </span>
              <h3 className="text-base font-bold text-on-surface">{dept.name}</h3>
              <p className="mt-2 text-sm text-on-surface-variant leading-relaxed">{dept.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Dữ liệu thu thập & Thông báo quyền riêng tư (yêu cầu trong R1 & REC-04) */}
      <section className="mt-12 rounded-apc border border-outline-variant bg-surface-container-lowest p-6 text-sm text-on-surface-variant">
        <p className="flex items-center gap-2 font-semibold text-on-surface mb-1">
          <span className="material-symbols-outlined text-lg text-emerald-600">shield</span>
          Chính sách dữ liệu ứng viên
        </p>
        <p>
          Khi nộp đơn ứng tuyển, APC thu thập họ tên, email, MSSV, khoa/ngành và câu trả lời nghiệp vụ chỉ nhằm mục đích xét duyệt thành viên. Dữ liệu của bạn được bảo mật tuyệt đối theo{' '}
          <Link to="/privacy" className="text-apc-blue underline font-medium hover:text-apc-red">
            Chính sách quyền riêng tư
          </Link>{' '}
          của câu lạc bộ.
        </p>
      </section>
    </main>
  )
}
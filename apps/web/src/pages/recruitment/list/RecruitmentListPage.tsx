import { Link } from 'react-router-dom'

import { AsyncState } from '../../../components/AsyncState'
import { buttonClass } from '../../../components/buttonClass'
import { PageHero } from '../../../components/PageHero'
import { useMockApi } from '../../../hooks/useMockApi'
import { listRecruitmentRounds } from '../mock'
import { sortRounds } from '../roundPhase'
import { RecruitmentCard } from './RecruitmentCard'

export function RecruitmentListPage() {
  const { data, loading, error, reload } = useMockApi(() => listRecruitmentRounds(), [])
  const sortedRounds = sortRounds(data ?? [])

  return (
    <main>
      <PageHero
        tone="red"
        comment="cơ hội tham gia"
        title="Gia nhập APC"
        lede="Nơi các bạn mê làm phần mềm ở UMT cùng học qua dự án, làm sản phẩm thật và có anh chị đi trước kèm cặp."
        aside={
          // Tra cứu hồ sơ theo FLOW-03
          <Link to="/recruitment/application-lookup" className={buttonClass('light')}>
            Tra cứu hồ sơ bằng mã
          </Link>
        }
      />

      <AsyncState loading={loading} error={error} empty={false} onRetry={reload}>
        {sortedRounds.length === 0 ? (
          // Khối rỗng theo FLOW-03
          <section className="px-4 py-[clamp(56px,10vh,120px)] text-center md:px-8">
            <div className="mx-auto max-w-[620px]">
              <p className="font-code text-[14px] font-bold text-apc-red">{'// chưa có đợt tuyển'}</p>
              <h2 className="mt-3 font-display text-[clamp(28px,3vw,44px)] font-extrabold leading-[1.05]">Hiện chưa có đợt tuyển nào đang mở</h2>
              <p className="mt-4 text-[17px] leading-relaxed text-muted">
                APC thường mở đợt tuyển thành viên vào đầu mỗi học kỳ. Theo dõi các kênh chính thức của tụi mình để không lỡ thông báo nha.
              </p>
              <p className="mt-6 flex flex-wrap justify-center gap-x-6 gap-y-2 text-[16px] font-extrabold">
                <a href="https://facebook.com" target="_blank" rel="noopener noreferrer" className="text-apc-blue underline decoration-2 underline-offset-4">
                  Fanpage Facebook ↗<span className="sr-only"> (mở tab mới)</span>
                </a>
                <a href="mailto:contact@apc.club" className="text-apc-blue underline decoration-2 underline-offset-4">
                  contact@apc.club
                </a>
              </p>
            </div>
          </section>
        ) : (
          <section className="px-4 py-[clamp(40px,7vh,80px)] md:px-8">
            <div className="mx-auto w-full max-w-container-max border-t-2 border-ink">
              {sortedRounds.map((round) => (
                <RecruitmentCard key={round.id} round={round} />
              ))}
            </div>
          </section>
        )}
      </AsyncState>
    </main>
  )
}

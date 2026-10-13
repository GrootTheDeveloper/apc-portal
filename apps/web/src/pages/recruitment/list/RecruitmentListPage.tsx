import { Link } from 'react-router-dom'
import { Eyebrow } from '../../../components/Eyebrow'
import { MOCK_RECRUITMENT_ROUNDS } from '../mock'
import { RecruitmentCard } from './RecruitmentCard'

export function RecruitmentListPage() {
  const rounds = MOCK_RECRUITMENT_ROUNDS

  // Đợt đang mở ưu tiên xếp trước, sau đó tới sắp mở và đã đóng
  const sortedRounds = [...rounds].sort((a, b) => {
    const now = new Date().getTime()
    const aOpen = a.status === 'OPEN' && new Date(a.opensAt).getTime() <= now && now <= new Date(a.closesAt).getTime()
    const bOpen = b.status === 'OPEN' && new Date(b.opensAt).getTime() <= now && now <= new Date(b.closesAt).getTime()
    if (aOpen && !bOpen) return -1
    if (!aOpen && bOpen) return 1
    return new Date(b.opensAt).getTime() - new Date(a.opensAt).getTime()
  })

  return (
    <main className="mx-auto max-w-container-max px-gutter py-12 md:py-16">
      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-outline-variant/60 pb-8">
        <div>
          <Eyebrow>Cơ hội tham gia</Eyebrow>
          <h1 className="mt-3 text-3xl md:text-5xl font-extrabold text-on-surface">Gia nhập APC</h1>
          <p className="mt-3 max-w-2xl text-base md:text-lg text-on-surface-variant font-light">
            Nơi kết nối những bạn trẻ đam mê công nghệ phần mềm tại UMT. Cùng học tập qua dự án, xây dựng sản phẩm thực tế và đồng hành cùng mentor.
          </p>
        </div>

        {/* Nút tra cứu hồ sơ theo yêu cầu FLOW-03 */}
        <Link
          to="/recruitment/application-lookup"
          className="inline-flex items-center gap-2 rounded-apc border border-outline-variant bg-surface-container-lowest px-5 py-3 text-sm font-semibold text-on-surface hover:border-apc-blue hover:text-apc-blue shadow-sm transition-all shrink-0"
        >
          <span className="material-symbols-outlined text-xl">search_check</span>
          Tra cứu kết quả hồ sơ
        </Link>
      </div>

      {/* Danh sách đợt tuyển hoặc Khối Empty State theo FLOW-03 */}
      {sortedRounds.length === 0 ? (
        <section className="mt-12 rounded-apc border border-outline-variant bg-surface-container-lowest p-8 md:p-12 text-center">
          <div className="mx-auto max-w-lg">
            <span className="material-symbols-outlined text-5xl text-apc-red mb-3">campaign</span>
            <h2 className="text-2xl font-bold text-on-surface">Hiện chưa có đợt tuyển nào đang mở</h2>
            <p className="mt-3 text-on-surface-variant leading-relaxed">
              APC thường mở đợt tuyển thành viên vào đầu mỗi học kỳ. Bạn hãy theo dõi các kênh thông tin chính thức của chúng mình để không bỏ lỡ thông báo mới nhất nhé!
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-4 text-sm font-medium">
              <a
                href="https://facebook.com"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-apc-blue hover:underline"
              >
                Fanpage Facebook <span className="material-symbols-outlined text-base">open_in_new</span>
              </a>
              <span className="text-outline-variant">•</span>
              <a href="mailto:contact@apc.club" className="text-apc-blue hover:underline">
                contact@apc.club
              </a>
            </div>
          </div>
        </section>
      ) : (
        <section className="mt-10">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {sortedRounds.map((round) => (
              <RecruitmentCard key={round.id} round={round} />
            ))}
          </div>
        </section>
      )}
    </main>
  )
}
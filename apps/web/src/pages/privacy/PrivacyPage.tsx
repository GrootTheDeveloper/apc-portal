import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

import { PageHero } from '../../components/PageHero'
import { Seo } from '../../components/Seo'
import { formatDate } from '../../lib/format'

/** Khớp `PRIVACY_POLICY_VERSION` trong apps/api/src/modules/consent/service.ts; đổi nội dung thì tăng cả hai. */
const POLICY_VERSION = '2026-10'
const EFFECTIVE_DATE = '2026-11-01T00:00:00+07:00'

const COLLECTED = [
  {
    title: 'Tài khoản thành viên',
    text: 'Họ tên, ảnh đại diện, email tài khoản, email liên hệ, mã số sinh viên, khoa/ngành, niên khóa, kỹ năng, lĩnh vực quan tâm, ban và vai trò.',
  },
  {
    title: 'Hồ sơ ứng tuyển',
    text: 'Họ tên, email, mã số sinh viên, khoa/ngành, niên khóa, ban mong muốn, kỹ năng, kinh nghiệm và câu trả lời trong biểu mẫu tuyển.',
  },
  {
    title: 'Đăng ký sự kiện',
    text: 'Thành viên đăng ký bằng tài khoản. Người ngoài APC đăng ký sự kiện công khai bằng họ tên, email và mã số sinh viên.',
  },
  {
    title: 'Nhật ký hệ thống',
    text: 'Thao tác quan trọng (phân quyền, công bố, xử lý hồ sơ…), thời điểm, địa chỉ IP và trình duyệt, để bảo mật và điều tra sự cố.',
  },
]

const PURPOSES = [
  'Xét tuyển thành viên và liên hệ ứng viên về kết quả.',
  'Tổ chức sự kiện: đăng ký, điểm danh, thông báo thay đổi.',
  'Quản lý thành viên, ban và phân quyền trong Portal.',
  'Gửi email hệ thống như xác nhận, nhắc lịch, thông báo.',
  'Bảo vệ tài khoản và hệ thống, điều tra khi có sự cố.',
]

const RETENTION = [
  ['Hồ sơ ứng viên không trúng tuyển hoặc đã rút', 'Giữ 12 tháng sau khi đợt tuyển đóng, sau đó ẩn danh câu trả lời và xóa thông tin liên hệ.'],
  ['Hồ sơ ứng viên được chấp nhận', 'Gắn với hồ sơ thành viên; câu trả lời tuyển dụng được ẩn danh sau 12 tháng kể từ ngày đợt tuyển đóng.'],
  ['Đăng ký sự kiện công khai', 'Giữ 12 tháng sau khi sự kiện kết thúc, sau đó xóa thông tin liên hệ, chỉ giữ số liệu tổng hợp.'],
  ['Thành viên ngừng hoạt động', 'Giữ định danh tối thiểu và lịch sử hoạt động để bàn giao; xóa email liên hệ, số điện thoại và dữ liệu tùy chọn sau 12 tháng.'],
  ['Trạng thái gửi email', 'Giữ 90 ngày; không lưu mật khẩu hay mã xác thực trong log.'],
  ['Log ứng dụng thông thường', 'Giữ 30 ngày.'],
  ['Nhật ký thao tác và bảo mật', 'Giữ tối thiểu 12 tháng.'],
  ['Bản sao lưu', 'Bản hằng ngày giữ 30 ngày; bản cuối tháng giữ 12 tháng.'],
] as const

const RIGHTS = [
  'Xem hồ sơ của mình; tự sửa ảnh đại diện, email liên hệ, kỹ năng và lĩnh vực quan tâm.',
  'Cấp hoặc thu hồi đồng ý công khai tên, ảnh, thông tin cá nhân theo từng mục đích và từng nội dung (ví dụ một dự án). Người quản lý nội dung không thể đồng ý thay bạn.',
  'Yêu cầu xuất, chỉnh sửa hoặc xóa dữ liệu cá nhân. Ban Chủ nhiệm quyết định; yêu cầu có trạng thái Mới, Đang xử lý, Hoàn thành hoặc Từ chối, và mọi trường hợp từ chối đều có lý do.',
  'Tệp dữ liệu xuất cho bạn chỉ bạn tải được và tự xóa sau 24 giờ.',
]

// Mỗi mục: tiêu đề Baloo gạch chân mực, nội dung ở cột phải trên màn rộng (DESIGN.md: không card viền, không bóng).
function PolicySection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="grid gap-4 border-t-2 border-ink py-[clamp(28px,5vh,48px)] lg:grid-cols-[280px_minmax(0,1fr)] lg:gap-12">
      <h2 data-rv className="font-display text-[clamp(24px,2.2vw,32px)] font-extrabold leading-[1.1]">
        {title}
      </h2>
      <div data-rv className="min-w-0 text-[17px] leading-relaxed">
        {children}
      </div>
    </section>
  )
}

/** PAGE-PUB: Chính sách quyền riêng tư (B2), nội dung theo PRD mục 10.5. */
export function PrivacyPage() {
  return (
    <main>
      <Seo
        title="Chính sách quyền riêng tư"
        description="APC thu thập dữ liệu gì, dùng để làm gì, giữ bao lâu và bạn có những quyền gì."
        path="/privacy"
      />
      <PageHero
        tone="blue"
        comment="quyền riêng tư"
        title="Chính sách quyền riêng tư"
        lede="APC Portal chỉ thu thập dữ liệu phục vụ hoạt động và quản lý thành viên của CLB APC. Dữ liệu cá nhân không xuất hiện trên trang công khai nếu bạn chưa đồng ý."
      >
        <p className="mt-6 font-code text-[14px] font-bold opacity-85">
          phiên bản {POLICY_VERSION} · hiệu lực từ {formatDate(EFFECTIVE_DATE)}
        </p>
      </PageHero>

      <div className="px-4 py-[clamp(32px,6vh,72px)] md:px-8">
        <div className="mx-auto w-full max-w-container-max">
          <PolicySection title="1. Dữ liệu thu thập">
            <dl className="flex flex-col gap-5">
              {COLLECTED.map((item) => (
                <div key={item.title}>
                  <dt className="font-extrabold">{item.title}</dt>
                  <dd className="mt-1 text-muted">{item.text}</dd>
                </div>
              ))}
            </dl>
          </PolicySection>

          <PolicySection title="2. Mục đích sử dụng">
            <ul className="list-disc space-y-2 pl-5">
              {PURPOSES.map((purpose) => (
                <li key={purpose}>{purpose}</li>
              ))}
            </ul>
          </PolicySection>

          <PolicySection title="3. Ghi nhận sự đồng ý">
            <p>
              Ứng viên và người đăng ký sự kiện công khai phải đồng ý với mục đích xử lý dữ liệu trước khi gửi. Mỗi lần đồng
              ý hoặc thu hồi, hệ thống lưu chủ thể, mục đích, phiên bản chính sách này, thời điểm và trạng thái hiệu lực. Thu
              hồi không xóa lịch sử đồng ý trước đó.
            </p>
          </PolicySection>

          <PolicySection title="4. Thời gian lưu giữ">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[32rem] border-collapse text-left">
                <thead>
                  <tr className="font-code text-[13px] font-bold text-muted">
                    <th scope="col" className="w-2/5 pb-3 pr-6 font-bold">loại dữ liệu</th>
                    <th scope="col" className="pb-3 font-bold">thời hạn và cách xử lý</th>
                  </tr>
                </thead>
                <tbody>
                  {RETENTION.map(([kind, rule]) => (
                    <tr key={kind} className="border-t-2 border-ink/10 align-top">
                      <th scope="row" className="py-3 pr-6 font-extrabold">{kind}</th>
                      <td className="py-3 text-muted">{rule}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-5 text-[15px] text-muted">
              Xóa hoặc ẩn danh áp dụng trên hệ thống đang chạy và các tệp xuất liên quan. Bản sao lưu không sửa từng bản mà
              hết hạn theo lịch trên; nếu phải khôi phục từ bản sao lưu, các yêu cầu xóa còn hiệu lực được áp lại trước khi
              mở lại dịch vụ.
            </p>
          </PolicySection>

          <PolicySection title="5. Quyền của bạn">
            <ul className="list-disc space-y-2 pl-5">
              {RIGHTS.map((right) => (
                <li key={right}>{right}</li>
              ))}
            </ul>
          </PolicySection>

          <PolicySection title="6. Ai được xem dữ liệu">
            <p>
              Mỗi người chỉ xem được dữ liệu của mình và dữ liệu thuộc phạm vi quyền được giao (ví dụ quản lý ban chỉ xem
              thành viên trong ban). Mật khẩu được băm một chiều; mật khẩu và mã khôi phục không bao giờ gửi qua email.
            </p>
          </PolicySection>

          <PolicySection title="7. Liên hệ">
            <p>
              Câu hỏi hoặc yêu cầu về dữ liệu cá nhân, vui lòng gửi Ban Chủ nhiệm APC qua kênh liên hệ ở trang{' '}
              <Link to="/about" className="font-extrabold text-apc-red underline decoration-2 underline-offset-4 hover:text-apc-red-deep">
                Về APC
              </Link>
              .
            </p>
          </PolicySection>
        </div>
      </div>
    </main>
  )
}

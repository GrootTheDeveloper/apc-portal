import { Link } from 'react-router-dom'

import { Eyebrow } from '../../components/Eyebrow'
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

/** PAGE-PUB: Chính sách quyền riêng tư (B2), nội dung theo PRD mục 10.5. */
export function PrivacyPage() {
  return (
    <main className="w-full bg-white px-gutter py-12 md:py-16">
      <Seo
        title="Chính sách quyền riêng tư"
        description="APC thu thập dữ liệu gì, dùng để làm gì, giữ bao lâu và bạn có những quyền gì."
        path="/privacy"
      />
      <article className="mx-auto flex w-full max-w-3xl flex-col gap-12">
        <header className="border-b border-outline-variant/20 pb-8">
          <Eyebrow className="mb-3 text-apc-blue">Quyền riêng tư</Eyebrow>
          <h1 className="font-headline-md text-3xl font-bold leading-tight text-on-surface md:text-4xl">
            Chính sách quyền riêng tư
          </h1>
          <p className="mt-4 text-on-surface-variant">
            Phiên bản <strong className="text-on-surface">{POLICY_VERSION}</strong> · Hiệu lực từ{' '}
            <strong className="text-on-surface">{formatDate(EFFECTIVE_DATE)}</strong>
          </p>
          <p className="mt-4 leading-relaxed text-on-surface-variant">
            APC Portal chỉ thu thập dữ liệu phục vụ hoạt động và quản lý thành viên của CLB APC. Dữ liệu cá nhân không
            xuất hiện trên trang công khai nếu bạn chưa đồng ý.
          </p>
        </header>

        <section>
          <h2 className="font-headline-sm text-2xl font-bold text-on-surface">1. Dữ liệu chúng tôi thu thập</h2>
          <dl className="mt-6 flex flex-col gap-5">
            {COLLECTED.map((item) => (
              <div key={item.title}>
                <dt className="font-bold text-on-surface">{item.title}</dt>
                <dd className="mt-1 leading-relaxed text-on-surface-variant">{item.text}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section>
          <h2 className="font-headline-sm text-2xl font-bold text-on-surface">2. Mục đích sử dụng</h2>
          <ul className="mt-6 list-disc space-y-2 pl-5 leading-relaxed text-on-surface-variant">
            {PURPOSES.map((purpose) => (
              <li key={purpose}>{purpose}</li>
            ))}
          </ul>
        </section>

        <section>
          <h2 className="font-headline-sm text-2xl font-bold text-on-surface">3. Ghi nhận sự đồng ý</h2>
          <p className="mt-6 leading-relaxed text-on-surface-variant">
            Ứng viên và người đăng ký sự kiện công khai phải đồng ý với mục đích xử lý dữ liệu trước khi gửi. Mỗi lần đồng
            ý hoặc thu hồi, hệ thống lưu chủ thể, mục đích, phiên bản chính sách này, thời điểm và trạng thái hiệu lực.
            Thu hồi không xóa lịch sử đồng ý trước đó.
          </p>
        </section>

        <section>
          <h2 className="font-headline-sm text-2xl font-bold text-on-surface">4. Thời gian lưu giữ</h2>
          <div className="mt-6 overflow-x-auto">
            <table className="w-full min-w-[32rem] border-collapse text-left">
              <thead>
                <tr className="bg-surface-container-low text-sm text-on-surface">
                  <th scope="col" className="w-2/5 px-4 py-3 font-bold">Loại dữ liệu</th>
                  <th scope="col" className="px-4 py-3 font-bold">Thời hạn và cách xử lý</th>
                </tr>
              </thead>
              <tbody>
                {RETENTION.map(([kind, rule]) => (
                  <tr key={kind} className="border-b border-outline-variant/20 align-top">
                    <th scope="row" className="px-4 py-3 font-medium text-on-surface">{kind}</th>
                    <td className="px-4 py-3 leading-relaxed text-on-surface-variant">{rule}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-sm leading-relaxed text-on-surface-variant">
            Xóa hoặc ẩn danh áp dụng trên hệ thống đang chạy và các tệp xuất liên quan. Bản sao lưu không sửa từng bản mà
            hết hạn theo lịch trên; nếu phải khôi phục từ bản sao lưu, các yêu cầu xóa còn hiệu lực được áp lại trước khi
            mở lại dịch vụ.
          </p>
        </section>

        <section>
          <h2 className="font-headline-sm text-2xl font-bold text-on-surface">5. Quyền của bạn</h2>
          <ul className="mt-6 list-disc space-y-2 pl-5 leading-relaxed text-on-surface-variant">
            {RIGHTS.map((right) => (
              <li key={right}>{right}</li>
            ))}
          </ul>
        </section>

        <section>
          <h2 className="font-headline-sm text-2xl font-bold text-on-surface">6. Ai được xem dữ liệu</h2>
          <p className="mt-6 leading-relaxed text-on-surface-variant">
            Mỗi người chỉ xem được dữ liệu của mình và dữ liệu thuộc phạm vi quyền được giao (ví dụ quản lý ban chỉ xem
            thành viên trong ban). Mật khẩu được băm một chiều; mật khẩu và mã khôi phục không bao giờ gửi qua email.
          </p>
        </section>

        <section>
          <h2 className="font-headline-sm text-2xl font-bold text-on-surface">7. Liên hệ</h2>
          <p className="mt-6 leading-relaxed text-on-surface-variant">
            Câu hỏi hoặc yêu cầu về dữ liệu cá nhân, vui lòng gửi Ban Chủ nhiệm APC qua kênh liên hệ ở trang{' '}
            <Link to="/about" className="font-medium text-apc-blue hover:underline">
              Về APC
            </Link>
            .
          </p>
        </section>
      </article>
    </main>
  )
}

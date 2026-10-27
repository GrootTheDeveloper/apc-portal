import { useEffect, useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'

import { buttonClass } from '../../../components/buttonClass'
import { formatDate, formatDateTime } from '../../../lib/format'
import { MOCK_RECRUITMENT_ROUNDS } from '../../recruitment/mock'
import { roundPhase } from '../../recruitment/roundPhase'
import { Eyebrow } from '../../../components/Eyebrow'

const MARK_PIECES = ['/assets/home/mark/mark-red.png', '/assets/home/mark/mark-gold.png', '/assets/home/mark/mark-blue.png']
const delay = (ms: number) => ({ '--d': `${ms}ms` }) as CSSProperties
const pad = (n: number) => String(n).padStart(2, '0')

/** Thời gian còn lại tới `target` theo ngày/giờ/phút/giây, cập nhật mỗi giây. */
function useCountdown(target: string | undefined) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!target) return
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [target])
  const seconds = target ? Math.max(0, Math.floor((new Date(target).getTime() - now) / 1000)) : 0
  return [
    { value: Math.floor(seconds / 86400), label: 'ngày' },
    { value: Math.floor(seconds / 3600) % 24, label: 'giờ' },
    { value: Math.floor(seconds / 60) % 60, label: 'phút' },
    { value: seconds % 60, label: 'giây' },
  ]
}

/**
 * Gia nhập APC, chia đôi màn hình: trái nền đỏ là phần hành động (hạn chót, đếm ngược, nút ứng tuyển);
 * phải nền trắng là lộ trình xét hồ sơ (docs/01 mục 9.2) xếp dọc, logo APC đánh dấu bước đang diễn ra.
 */
export function JoinSection() {
  // Đợt tuyển đang mở đơn (mock, R2 thay bằng API).
  const round = MOCK_RECRUITMENT_ROUNDS.find((item) => roundPhase(item) === 'open')
  const units = useCountdown(round?.closesAt)
  const open = units.some((unit) => unit.value > 0)

  if (!round) {
    return (
      <section className="screen flex items-center bg-apc-red px-4 py-[clamp(40px,8vh,96px)] text-paper md:px-8">
        <div className="mx-auto w-full max-w-container-max">
          <h2 className="font-display text-[clamp(40px,min(5vw,9vh),88px)] font-extrabold leading-[0.95]">Chưa mở đợt tuyển mới.</h2>
          <p className="mt-4 max-w-[44ch] text-[18px] leading-relaxed text-paper/90">Đợt tiếp theo sẽ được thông báo trên trang Gia nhập APC.</p>
          <Link className={buttonClass('light', 'mt-8')} to="/recruitment">
            Xem các đợt tuyển →
          </Link>
        </div>
      </section>
    )
  }

  // Bước 0 đã qua (mở đơn), bước 1 đang diễn ra (nhận đơn tới hạn chót), các bước sau chưa tới.
  const NOW = 1
  const steps = [
    { label: 'Mở đơn', when: formatDate(round.opensAt), note: 'nộp online, không cần tài khoản, nhận mã hồ sơ để tra cứu' },
    { label: 'Nhận đơn tới hạn chót', when: formatDateTime(round.closesAt), note: 'form đóng đúng giờ này' },
    { label: 'Ban chuyên môn xét hồ sơ', when: 'sau hạn chót', note: 'đọc kỹ từng đơn' },
    { label: 'Phỏng vấn', when: 'hẹn lịch qua email', note: 'nói chuyện thoải mái, không đánh đố' },
    { label: 'Kết quả', when: 'qua email', note: 'tra cứu bằng mã hồ sơ bất cứ lúc nào' },
  ]

  return (
    <section className="screen relative grid overflow-hidden bg-paper lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
      {/* Trái: hành động */}
      <div className="flex items-center bg-apc-red px-4 py-[clamp(40px,8vh,96px)] text-paper md:px-8 lg:pl-[max(32px,calc((100vw-1520px)/2+32px))] lg:pr-14">
        <div className="w-full">
          <Eyebrow data-rv className="text-paper/85">
            {round.title.split(' - ')[0].toLowerCase()}
          </Eyebrow>
          <h2
            data-rv
            className="mt-3 font-display text-[clamp(44px,min(6vw,11vh),108px)] font-extrabold leading-[0.9] tracking-[-0.04em]"
            style={delay(60)}
          >
            Nộp đơn
            <br />
            trước <span className="text-apc-gold-soft">{formatDate(round.closesAt).slice(0, 5)}.</span>
          </h2>

          {open && (
            <div data-rv className="mt-[clamp(24px,5vh,48px)]" role="timer" aria-label={`Hạn chót nộp đơn ${formatDateTime(round.closesAt)}`} style={delay(120)}>
              <p className="font-code text-[14px] font-bold text-paper/80">đóng đơn sau</p>
              <p className="mt-2 flex gap-[clamp(14px,1.8vw,28px)] font-code font-bold">
                {units.map((unit, index) => (
                  <span key={unit.label} className="flex flex-col">
                    {/* giây đổi mỗi nhịp: key theo giá trị để chạy lại hiệu ứng lật */}
                    <span
                      key={index === 3 ? unit.value : unit.label}
                      className={`text-[clamp(40px,min(4.4vw,8vh),76px)] leading-none tracking-[-0.03em] ${index === 3 ? 'tick' : ''}`}
                    >
                      {pad(unit.value)}
                    </span>
                    <span className="mt-1.5 text-[13px] text-paper/75">{unit.label}</span>
                  </span>
                ))}
              </p>
            </div>
          )}

          <div data-rv className="mt-[clamp(24px,5vh,48px)] flex flex-wrap items-center gap-x-6 gap-y-3" style={delay(180)}>
            <Link className={buttonClass('light')} to={`/recruitment/${round.slug}`}>
              Ứng tuyển ngay →
            </Link>
            <Link
              className="inline-flex min-h-12 items-center text-[16px] font-extrabold underline decoration-2 underline-offset-4 hover:text-apc-gold-soft"
              to="/recruitment/application-lookup"
            >
              Tra cứu hồ sơ bằng mã
            </Link>
          </div>
        </div>
      </div>

      {/* Phải: lộ trình */}
      <div className="flex items-center px-4 py-[clamp(40px,8vh,96px)] text-ink md:px-8 lg:pl-14 lg:pr-[max(32px,calc((100vw-1520px)/2+32px))]">
        <div className="w-full max-w-[620px]">
          <Eyebrow data-rv className="text-apc-blue">
            lộ trình đợt tuyển
          </Eyebrow>
          <ol className="relative mt-[clamp(16px,3vh,28px)]">
            {/* đường nối dọc: đoạn đã qua liền màu đỏ tới bước hiện tại, đoạn sau nét đứt */}
            <span aria-hidden className="tl-line absolute bottom-[30px] left-[18px] top-[30px] w-[3px]" />
            {steps.map((step, index) => {
              const state = index < NOW ? 'done' : index === NOW ? 'now' : 'next'
              return (
                <li key={step.label} data-rv className="relative flex gap-5 py-[clamp(8px,1.6vh,14px)]" style={delay(160 + index * 90)}>
                  {index < NOW && <span aria-hidden className="tl-done absolute left-[18px] top-[30px] h-full w-[3px] bg-apc-red" />}
                  <span
                    aria-hidden
                    className={`relative z-10 grid h-[39px] w-[39px] shrink-0 place-items-center rounded-full text-[15px] font-extrabold ${
                      state === 'done'
                        ? 'bg-apc-red text-paper'
                        : state === 'now'
                          ? 'bg-paper shadow-[0_0_0_3px_#C23B22]'
                          : 'border-[3px] border-ink/20 bg-paper text-ink/45'
                    }`}
                  >
                    {state === 'done' ? (
                      '✓'
                    ) : state === 'now' ? (
                      <span className="mark-stack tl-bob block w-[22px]">
                        {MARK_PIECES.map((src) => (
                          <img key={src} alt="" src={src} />
                        ))}
                      </span>
                    ) : (
                      index + 1
                    )}
                  </span>
                  <span className="pt-1">
                    <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <b className={`font-display text-[clamp(19px,2.7vh,24px)] leading-tight ${state === 'next' ? 'text-ink/70' : ''}`}>{step.label}</b>
                      <span className={`font-code text-[13px] font-bold ${state === 'now' ? 'text-apc-red' : 'text-muted'}`}>{step.when}</span>
                      {state === 'now' && (
                        <span className="rounded-md bg-apc-red px-2 py-0.5 font-code text-[12px] font-bold text-paper">bạn đang ở đây</span>
                      )}
                    </span>
                    <span className={`mt-0.5 block text-[clamp(15px,2.1vh,17px)] ${state === 'next' ? 'text-muted' : ''}`}>{step.note}</span>
                  </span>
                </li>
              )
            })}
          </ol>

          <div data-rv className="mt-[clamp(16px,3.5vh,32px)] grid gap-4 border-t-2 border-ink pt-[clamp(14px,2.6vh,24px)] sm:grid-cols-[1fr_auto]" style={delay(640)}>
            <p className="text-[clamp(14px,2vh,16px)] leading-relaxed">
              <b className="font-code text-[13px] text-apc-blue">ai nên nộp · </b>
              {round.audience}
            </p>
            <ul className="flex flex-wrap items-start gap-2" aria-label="Ban đang tuyển">
              {round.departments.map((department) => (
                <li key={department.id} className="rounded-md bg-ink px-2 py-1 font-code text-[13px] font-bold text-paper" title={department.name}>
                  {department.code}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  )
}

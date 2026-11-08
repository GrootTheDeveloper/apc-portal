import { useState, type CSSProperties } from 'react'

import { buttonClass } from '../../../components/buttonClass'
import { UMTOJ_URL } from '../../../layouts/Navbar'
import { Eyebrow } from '../../../components/Eyebrow'

// Bài mini để chơi thử ngay trên trang: đọc code C++, chọn output đúng. answer phải nằm trong options.
const PROBLEMS = [
  {
    name: 'Tổng từ 1 đến 4',
    code: ['int s = 0;', 'for (int i = 1; i <= 4; i++) s += i;', 'cout << s;'],
    options: ['4', '10', '15'],
    answer: '10',
  },
  {
    name: 'Đảo chuỗi',
    code: ['string s = "APC";', 'reverse(s.begin(), s.end());', 'cout << s << s.size();'],
    options: ['APC3', 'CPA3', 'CPA2'],
    answer: 'CPA3',
  },
  {
    name: 'Chia lấy dư',
    code: ['int a = 7, b = 2;', 'cout << a / b << " " << a % b;'],
    options: ['3.5 1', '3 1', '3 2'],
    answer: '3 1',
  },
]

type Verdict = 'AC' | 'WA' | null

/** Mini judge kiểu UMTOJ: chọn output, nộp bài, nhận kết quả AC/WA ngay. */
function MiniJudge() {
  const [index, setIndex] = useState(0)
  const [picked, setPicked] = useState<string | null>(null)
  const [verdict, setVerdict] = useState<Verdict>(null)
  const [attempt, setAttempt] = useState(0)
  const problem = PROBLEMS[index]!

  const next = () => {
    setIndex((index + 1) % PROBLEMS.length)
    setPicked(null)
    setVerdict(null)
  }

  return (
    <form
      className="relative rounded-3xl bg-paper p-5 shadow-[0_10px_0_#0F52A0] md:p-7"
      onSubmit={(event) => {
        event.preventDefault()
        if (!picked) return
        setVerdict(picked === problem.answer ? 'AC' : 'WA')
        setAttempt((n) => n + 1)
      }}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-display text-[22px] font-bold">
          <span className="text-apc-blue">UMTOJ</span> · Bài {index + 1}/{PROBLEMS.length}: {problem.name}
        </p>
        <button
          className="min-h-11 rounded-full px-3 text-[16px] font-extrabold text-apc-red underline decoration-2 underline-offset-4 hover:text-apc-red-deep"
          onClick={next}
          type="button"
        >
          Bài khác →
        </button>
      </div>
      <pre className="mt-4 overflow-x-auto rounded-2xl bg-ink p-5 font-code text-[16px] leading-[1.7] text-paper">
        <code className="font-code">
          {problem.code.map((line, n) => (
            <span key={line} className="block">
              <span aria-hidden className="mr-4 select-none text-paper/40">
                {n + 1}
              </span>
              {line}
            </span>
          ))}
        </code>
      </pre>
      <fieldset className="mt-5">
        <legend className="text-[18px] font-extrabold">Chương trình in ra gì?</legend>
        <div className="mt-3 flex flex-wrap gap-3">
          {problem.options.map((option) => (
            <label
              key={option}
              className="option-pill relative inline-flex min-h-12 cursor-pointer items-center rounded-full bg-soft px-6 font-code text-[18px] font-bold"
            >
              <input
                checked={picked === option}
                name="output"
                onChange={() => {
                  setPicked(option)
                  setVerdict(null)
                }}
                type="radio"
                value={option}
              />
              {option}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="mt-6 flex flex-wrap items-center gap-4">
        <button className={buttonClass('primary', 'disabled:opacity-50 disabled:hover:translate-y-0')} disabled={!picked} type="submit">
          Nộp bài
        </button>
        <p aria-live="polite" className="text-[17px] font-bold">
          {verdict === 'AC' && 'Accepted, chuẩn luôn!'}
          {verdict === 'WA' && 'Wrong Answer, đọc lại từng dòng thử nha.'}
        </p>
      </div>
      {verdict && (
        <div
          key={attempt}
          aria-hidden
          className={`absolute -top-7 right-4 rotate-6 md:-right-5 ${verdict === 'AC' ? 'pop' : 'shake'}`}
        >
          <span
            className={`block rounded-2xl px-4 py-2 text-center text-paper ${
              verdict === 'AC' ? 'bg-[#0E9F6E] shadow-[0_5px_0_#0A7A54]' : 'bg-apc-red shadow-[0_5px_0_#9A2A16]'
            }`}
          >
            <b className="block font-display text-[44px] font-extrabold leading-[0.85]">{verdict}</b>
            <span className="block font-code text-[13px] font-bold">{verdict === 'AC' ? 'Accepted' : 'Wrong Answer'}</span>
          </span>
        </div>
      )}
    </form>
  )
}

// Những gì UMTOJ có (cùng nội dung chặng "practice" ở phần Hoạt động).
const FEATURES = ['Nộp code là biết đúng sai ngay', 'Contest để so tài với bạn bè', 'Bảng xếp hạng để biết mình đang ở đâu']

export function JudgeSection() {
  return (
    <section className="screen field-graph flex items-center overflow-hidden px-4 py-[clamp(40px,8vh,96px)] text-paper md:px-8">
      <div className="mx-auto grid w-full max-w-container-max items-center gap-14 lg:grid-cols-[1fr_1.05fr] lg:gap-20">
        <div className="min-w-0">
          <Eyebrow data-rv className="text-apc-gold-soft">
            UMT Online Judge do APC làm
          </Eyebrow>
          <h2
            data-rv
            className="mt-3 font-display text-[clamp(48px,min(6vw,11vh),104px)] font-extrabold leading-[0.9] tracking-[-0.04em]"
            style={{ '--d': '80ms' } as CSSProperties}
          >
            Thử chấm
            <br />
            <span className="text-apc-gold-soft">một bài.</span>
          </h2>
          <p
            data-rv
            className="mt-[clamp(16px,3vh,28px)] max-w-[42ch] text-[clamp(17px,2.4vh,20px)] leading-relaxed text-paper/90"
            style={{ '--d': '140ms' } as CSSProperties}
          >
            UMTOJ là hệ thống chấm bài tự động APC làm cho sinh viên UMT. Đoán output của đoạn code bên cạnh, rồi lên UMTOJ
            giải bài thật.
          </p>
          <ul data-rv className="mt-[clamp(20px,4vh,36px)] flex flex-col gap-2.5 border-t border-paper/25 pt-[clamp(16px,3vh,28px)]" style={{ '--d': '200ms' } as CSSProperties}>
            {FEATURES.map((feature) => (
              <li key={feature} className="flex items-baseline gap-3 text-[clamp(16px,2.2vh,18px)] font-bold">
                <span aria-hidden className="font-code text-apc-gold-soft">
                  ✓
                </span>
                {feature}
              </li>
            ))}
          </ul>
          <div data-rv className="mt-[clamp(24px,5vh,44px)]" style={{ '--d': '260ms' } as CSSProperties}>
            <a className={buttonClass('light')} href={UMTOJ_URL} target="_blank" rel="noopener noreferrer">
              Luyện tiếp trên UMTOJ ↗
            </a>
          </div>
        </div>
        <div data-rv className="min-w-0 text-ink" style={{ '--d': '160ms' } as CSSProperties}>
          <MiniJudge />
        </div>
      </div>
    </section>
  )
}

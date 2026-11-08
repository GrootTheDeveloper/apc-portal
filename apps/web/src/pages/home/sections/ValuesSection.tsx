import type { CSSProperties } from 'react'
import { Eyebrow } from '../../../components/Eyebrow'

// Logo APC giấu đủ ba chữ: ngọn lửa là chữ A, ngọn lửa ghép vệt vàng thành chữ P, con sóng xanh là chữ C.
// Ảnh ba mảnh tách từ logo gốc, cùng khung nên xếp chồng là ra logo.
// Class màu literal cho Tailwind JIT.
const VALUES = [
  {
    key: 'a',
    letter: 'A',
    word: 'Adaptive',
    desc: 'Thích ứng nhanh với công nghệ mới, linh hoạt trong cách tiếp cận vấn đề.',
    piece: 'ngọn lửa',
    letterClass: 'text-apc-red',
  },
  {
    key: 'p',
    letter: 'P',
    word: 'Progressive',
    desc: 'Học liên tục, mỗi dự án sau tốt hơn dự án trước.',
    piece: 'ngọn lửa + vệt vàng',
    letterClass: 'text-apc-gold',
  },
  {
    key: 'c',
    letter: 'C',
    word: 'Creative',
    desc: 'Dám làm khác, để sản phẩm có giá trị thật cho người dùng.',
    piece: 'con sóng',
    letterClass: 'text-apc-blue',
  },
]
const PIECES = [
  { key: 'red', src: '/assets/home/mark/mark-red.png' },
  { key: 'gold', src: '/assets/home/mark/mark-gold.png' },
  { key: 'blue', src: '/assets/home/mark/mark-blue.png' },
]

const delay = (ms: number) => ({ '--d': `${ms}ms` }) as CSSProperties

export function ValuesSection() {
  return (
    <section className="values screen flex items-center bg-paper px-4 py-[clamp(40px,8vh,96px)] md:px-8">
      <div className="mx-auto grid w-full max-w-container-max items-center gap-x-20 gap-y-12 lg:grid-cols-[0.8fr_1.2fr]">
        {/* Logo ráp từ ba mảnh khi cuộn tới; rê vào một chữ thì mảnh của chữ đó sáng lên */}
        <div aria-hidden className="mark-stack mx-auto w-[min(400px,62vw,52vh)]">
          {PIECES.map((piece) => (
            <img
              key={piece.key}
              alt=""
              className={`mark-piece mark-${piece.key}`}
              height={1536}
              loading="lazy"
              src={piece.src}
              width={1239}
            />
          ))}
        </div>

        <div>
          <Eyebrow data-rv className="text-apc-blue">
            applied · programming · club
          </Eyebrow>
          <h2
            data-rv
            className="mt-3 font-display text-[clamp(40px,min(4.8vw,8vh),76px)] font-extrabold leading-[0.95] tracking-[-0.03em]"
            style={delay(60)}
          >
            Ba chữ, <span className="text-apc-red">ba tinh thần.</span>
          </h2>
          <p data-rv className="mt-5 max-w-[48ch] text-[18px] leading-relaxed" style={delay(120)}>
            Logo APC giấu đủ ba chữ cái của tên CLB, và đó cũng là ba điều mỗi thành viên giữ khi cùng làm sản phẩm.
          </p>
          <ul className="mt-[clamp(20px,4vh,40px)] border-t-2 border-ink">
            {VALUES.map((value, index) => (
              <li
                key={value.key}
                data-rv
                className={`value-row value-${value.key} grid grid-cols-[72px_1fr] items-center gap-x-5 border-b-2 border-ink py-[clamp(12px,2.2vh,20px)] md:grid-cols-[96px_1fr]`}
                style={delay(200 + index * 100)}
              >
                <span
                  aria-hidden
                  className={`value-letter font-display text-[clamp(64px,6vw,96px)] font-extrabold leading-[0.8] ${value.letterClass}`}
                >
                  {value.letter}
                </span>
                <span>
                  <span className="flex flex-wrap items-baseline gap-x-3">
                    <b className="font-display text-[clamp(26px,2.4vw,34px)] font-extrabold leading-tight">{value.word}</b>
                    <span className="font-code text-[13px] font-bold text-muted">= {value.piece}</span>
                  </span>
                  <span className="mt-1 block text-[17px] leading-relaxed">{value.desc}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}

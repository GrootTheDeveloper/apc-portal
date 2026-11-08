import { useEffect, useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'

import { buttonClass } from '../../../components/buttonClass'

const TYPED = 'đến sản phẩm thật.'

/** Gõ dần `text` từng ký tự như terminal; bỏ qua khi người dùng bật giảm chuyển động. */
function useTyping(text: string, startMs: number, stepMs: number) {
  const [reduced] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  const [count, setCount] = useState(reduced ? text.length : 0)

  useEffect(() => {
    if (reduced) return
    let timer: number
    const tick = (n: number) => {
      setCount(n)
      if (n < text.length) timer = window.setTimeout(() => tick(n + 1), stepMs)
    }
    timer = window.setTimeout(() => tick(1), startMs)
    return () => window.clearTimeout(timer)
  }, [reduced, text, startMs, stepMs])

  return text.slice(0, count)
}

const delay = (ms: number) => ({ '--d': `${ms}ms` }) as CSSProperties

export function HeroSection() {
  const typed = useTyping(TYPED, 700, 55)

  return (
    <section className="lg:grid lg:h-[calc(100svh-72px)] lg:min-h-[620px] lg:[&>*]:[grid-area:1/1]">
      <figure className="hero-frame aspect-[5/4] max-h-[52svh] w-full md:aspect-[16/9] md:max-h-[60svh] lg:aspect-auto lg:max-h-none">
        <img
          alt="Nhóm sinh viên reo hò quanh chiếc laptop vừa chạy qua hết test"
          fetchPriority="high"
          height={1024}
          src="/assets/home/photos/hero.jpg"
          width={1536}
        />
      </figure>

      <div className="relative z-10 self-center px-4 pb-4 pt-8 md:px-8 lg:ml-[max(32px,calc((100vw-1520px)/2+32px))] lg:max-w-[min(660px,50vw)] lg:px-0 lg:pb-0 lg:pt-0">
        <p className="rise font-code text-[clamp(15px,1.2vw,18px)] font-bold text-apc-blue lg:text-paper/85">
          <span aria-hidden className="opacity-60">
            {'// '}
          </span>
          xin chào, tụi mình là APC
        </p>
        <h1
          aria-label={`Từ ý tưởng ${TYPED}`}
          className="mt-4 font-display text-[clamp(38px,5vw,80px)] font-extrabold leading-[1.02] tracking-[-0.03em] text-ink lg:text-paper"
        >
          <span aria-hidden className="rise block" style={delay(80)}>
            Từ ý tưởng
          </span>
          {/* Dòng hai được gõ dần trên nền đỏ như đoạn chữ đang bôi chọn trong editor;
              bản đầy đủ ẩn bên dưới giữ chỗ để bố cục không nhảy. */}
          <span aria-hidden className="relative mt-[0.08em] block w-fit text-paper">
            <span className="invisible block whitespace-nowrap px-[0.14em]">{TYPED}</span>
            <span className="absolute left-0 top-0 whitespace-nowrap rounded-[0.12em] bg-apc-red px-[0.14em]">
              {typed}
              <span className="caret" />
            </span>
          </span>
        </h1>
        <p className="rise mt-7 max-w-[44ch] text-[clamp(17px,1.3vw,20px)] leading-relaxed lg:text-paper/90" style={delay(240)}>
          APC là CLB Lập trình Ứng dụng của Khoa Công Nghệ, UMT. Tụi mình học qua dự án, vận hành hệ thống chấm bài
          UMTOJ và làm website cho các sự kiện như UMT TechGen.
        </p>
        <div className="rise mt-9 flex flex-wrap items-center gap-x-7 gap-y-4" style={delay(320)}>
          <Link className={buttonClass('primary', 'px-8')} to="/recruitment">
            Gia nhập APC →
          </Link>
          <a
            className="inline-flex min-h-12 items-center text-[17px] font-extrabold text-apc-red underline decoration-2 underline-offset-4 hover:text-apc-red-deep lg:text-paper lg:hover:text-apc-gold-soft"
            href="#activities"
          >
            Xem tụi mình làm gì
          </a>
        </div>
      </div>
    </section>
  )
}

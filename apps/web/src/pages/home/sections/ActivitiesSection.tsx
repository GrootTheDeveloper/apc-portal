import { useState, type CSSProperties } from 'react'
import { Eyebrow } from '../../../components/Eyebrow'

// Bốn chặng từ ý tưởng tới sản phẩm.
const STAGES = [
  {
    stage: 'learn',
    title: 'Học qua workshop',
    desc: 'Training nền tảng cho thành viên mới, workshop chuyên đề và tech talk, buổi nào cũng có bài làm tại chỗ.',
    img: '/assets/home/photos/workshop.jpg',
    alt: 'Anh chị mentor chỉ vào màn hình laptop, ba bạn sinh viên cười và gõ code',
  },
  {
    stage: 'practice',
    title: 'Luyện trên UMTOJ',
    desc: 'Giải bài trên hệ thống chấm tự động do APC xây, có contest và bảng xếp hạng để so tài.',
    img: '/assets/home/photos/contest.jpg',
    alt: 'Bạn sinh viên giơ hai tay ăn mừng vì vừa giải xong bài trong phòng máy',
  },
  {
    stage: 'build',
    title: 'Làm dự án nhóm',
    desc: 'Chia nhóm làm website, công cụ, ứng dụng cho sinh viên; dùng Git, review code như một team thật.',
    img: '/assets/home/photos/teamwork.jpg',
    alt: 'Nhóm sinh viên vẽ sơ đồ ứng dụng trên bảng trắng dán đầy giấy note',
  },
  {
    stage: 'ship',
    title: 'Ra sản phẩm thật',
    desc: 'Sản phẩm được đưa vào dùng: UMTOJ, APC Event Manager và website cho các sự kiện như UMT TechGen.',
    img: '/assets/home/photos/demoday.jpg',
    alt: 'Bạn sinh viên trình bày ứng dụng của nhóm trên màn chiếu, cả lớp vỗ tay',
  },
]

const delay = (ms: number) => ({ '--d': `${ms}ms` }) as CSSProperties

export function ActivitiesSection() {
  const [active, setActive] = useState(0)
  // Tự chuyển chặng khi thanh tiến trình chạy hết; tắt khi người dùng bật giảm chuyển động.
  const [auto] = useState(() => !window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  const current = STAGES[active]

  return (
    <section id="activities" className="screen relative grid overflow-hidden bg-ink text-paper lg:grid-cols-2">
      {/* Ảnh của chặng đang chọn, tràn sát mép phải */}
      <div className="relative aspect-[4/3] overflow-hidden lg:order-2 lg:aspect-auto">
        {STAGES.map((item, index) => (
          <img
            key={item.stage}
            alt={index === active ? item.alt : ''}
            className={`stage-photo absolute inset-0 h-full w-full object-cover ${index === active ? 'is-on' : ''}`}
            height={800}
            loading="lazy"
            src={item.img}
            width={1200}
          />
        ))}
        <p aria-hidden className="absolute bottom-4 left-4 rounded-lg bg-ink/85 px-3 py-1.5 font-code text-[14px] font-bold">
          stage {active + 1}/{STAGES.length} · <span className="text-apc-gold">{current.stage}</span>
        </p>
      </div>

      <div className="flex items-center px-4 py-[clamp(40px,8vh,88px)] md:px-8 lg:pl-[max(32px,calc((100vw-1520px)/2+32px))] lg:pr-16">
        <div className="w-full max-w-[620px]">
          <Eyebrow data-rv className="text-apc-gold-soft">
            learn → practice → build → ship
          </Eyebrow>
          <h2
            data-rv
            className="mt-3 font-display text-[clamp(40px,min(4.8vw,8vh),76px)] font-extrabold leading-[0.95] tracking-[-0.03em]"
            style={delay(60)}
          >
            Cùng học, <span className="text-apc-gold">cùng làm.</span>
          </h2>
          <p data-rv className="mt-4 max-w-[46ch] text-[clamp(16px,2.2vh,18px)] leading-relaxed text-paper/85" style={delay(120)}>
            Mỗi học kỳ ở APC chạy như một pipeline. Vào ở chặng nào cũng có người đi cùng.
          </p>

          <ol data-rv className="stages mt-[clamp(20px,4vh,40px)] border-t border-paper/20" style={delay(180)}>
            {STAGES.map((item, index) => {
              const on = index === active
              return (
                <li key={item.stage} className="relative border-b border-paper/20">
                  <button
                    type="button"
                    aria-controls={`stage-${item.stage}`}
                    aria-expanded={on}
                    className={`stage-row flex w-full items-baseline gap-4 py-[clamp(10px,1.9vh,18px)] text-left ${on ? 'is-on' : ''}`}
                    onClick={() => setActive(index)}
                  >
                    <span className="w-7 shrink-0 font-code text-[14px] font-bold text-paper/50">{String(index + 1).padStart(2, '0')}</span>
                    <span className="stage-word font-display text-[clamp(28px,min(3.2vw,5.4vh),46px)] font-extrabold leading-none">
                      {item.stage}
                    </span>
                    <span className="ml-auto text-right text-[clamp(14px,1.1vw,17px)] font-bold text-paper/70">{item.title}</span>
                  </button>
                  <div id={`stage-${item.stage}`} className={`stage-body ${on ? 'is-on' : ''}`}>
                    <div className="overflow-hidden">
                      <p className="pb-[clamp(12px,2vh,20px)] pl-11 text-[clamp(15px,2.1vh,17px)] leading-relaxed text-paper/85">{item.desc}</p>
                    </div>
                  </div>
                  {auto && on && (
                    <span
                      aria-hidden
                      className="stage-bar absolute bottom-[-1px] left-0 h-[3px] w-full bg-apc-gold"
                      onAnimationEnd={() => setActive((index + 1) % STAGES.length)}
                    />
                  )}
                </li>
              )
            })}
          </ol>
        </div>
      </div>
    </section>
  )
}

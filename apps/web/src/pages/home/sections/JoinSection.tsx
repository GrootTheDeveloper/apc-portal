import { Button } from './Button'
import { Eyebrow } from './Eyebrow'

const JOIN_PERKS = ['Học qua dự án', 'Mentor đồng hành', 'Sản phẩm thực tế']

export function JoinSection() {
  return (
    <section className="w-full py-24 px-gutter bg-gradient-to-br from-apc-red to-[#7d1a0a] text-white relative overflow-hidden">
      {/* Vệt sáng nhẹ cho chiều sâu */}
      <div className="absolute -top-1/3 left-1/2 -translate-x-1/2 w-[80%] h-[80%] rounded-full bg-white/10 blur-3xl pointer-events-none" />
      <div className="absolute right-[-10%] top-[-20%] w-1/2 opacity-10 pointer-events-none transform -rotate-12">
        <img alt="" className="w-full h-auto object-contain" src="/assets/home/09-decorative-element.png" />
      </div>
      <div className="max-w-container-max mx-auto relative z-10 flex flex-col items-center text-center fade-up w-full">
        <Eyebrow className="text-white/70 justify-center mb-4">Tuyển thành viên</Eyebrow>
        <h2 className="font-display-lg text-4xl md:text-6xl font-bold mb-6">Hãy tham gia cùng APC!</h2>
        <p className="text-white/80 text-xl md:text-2xl mb-8 max-w-2xl font-light">
          Hãy mang ý tưởng của bạn đến đây. Chúng ta sẽ cùng nhau biến nó thành hiện thực.
        </p>
        <div className="flex flex-wrap justify-center gap-3 mb-10">
          {JOIN_PERKS.map((perk) => (
            <span
              key={perk}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 border border-white/20 text-sm font-medium backdrop-blur-sm"
            >
              <span className="material-symbols-outlined text-[18px]">check_circle</span>
              {perk}
            </span>
          ))}
        </div>
        <div className="flex flex-wrap justify-center gap-4">
          <Button
            variant="light"
            className="px-10 py-4 text-lg font-bold shadow-xl hover:shadow-2xl hover:-translate-y-1 transform duration-200"
          >
            Khám phá cơ hội gia nhập
          </Button>
          <a
            className="inline-flex items-center gap-2 px-10 py-4 rounded-apc border border-white/40 text-white font-bold text-lg hover:bg-white/10 transition-colors"
            href="#"
          >
            Xem quy trình <span className="material-symbols-outlined">arrow_forward</span>
          </a>
        </div>
      </div>
    </section>
  )
}

import { Eyebrow } from './Eyebrow'

// Class màu để literal (không nội suy) để Tailwind JIT nhận diện được.
const VALUES = [
  {
    no: '01',
    icon: 'settings_input_component',
    title: 'Adaptive',
    desc: 'Thích ứng nhanh với công nghệ mới và môi trường thay đổi liên tục, linh hoạt trong cách tiếp cận vấn đề.',
    numberClass: 'text-apc-red/5',
    iconClass: 'bg-apc-red/10 text-apc-red',
    titleClass: 'text-apc-red',
    barClass: 'bg-apc-red',
  },
  {
    no: '02',
    icon: 'trending_up',
    title: 'Progressive',
    desc: 'Luôn hướng tới sự tiến bộ, học hỏi liên tục và cải tiến không ngừng trong mọi dự án.',
    numberClass: 'text-apc-blue/5',
    iconClass: 'bg-apc-blue/10 text-apc-blue',
    titleClass: 'text-apc-blue',
    barClass: 'bg-apc-blue',
  },
  {
    no: '03',
    icon: 'lightbulb',
    title: 'Creative',
    desc: 'Sáng tạo trong giải pháp, không ngại phá vỡ giới hạn để đem lại giá trị thực tiễn cho cộng đồng.',
    numberClass: 'text-apc-gold/5',
    iconClass: 'bg-apc-gold/10 text-apc-gold',
    titleClass: 'text-apc-gold',
    barClass: 'bg-apc-gold',
  },
]

export function ValuesSection() {
  return (
    <section className="w-full py-section-padding px-gutter bg-white border-y border-outline-variant/20">
      <div className="max-w-container-max mx-auto fade-up w-full">
        <div className="mb-16">
          <Eyebrow className="text-apc-blue mb-4">GIÁ TRỊ CỐT LÕI</Eyebrow>
          <h2 className="font-display-lg text-5xl md:text-6xl font-bold text-on-surface leading-tight">
            Nơi sinh viên công nghệ
            <br />
            cùng tiến về phía trước.
          </h2>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-12">
          {VALUES.map((value) => (
            <div
              key={value.title}
              className="group relative flex flex-col gap-8 p-8 rounded-2xl bg-white border border-outline-variant/30 shadow-sm hover:shadow-2xl hover:-translate-y-1 transition-all duration-300"
            >
              <div className={`absolute top-4 right-8 text-[120px] font-bold ${value.numberClass} leading-none pointer-events-none select-none`}>
                {value.no}
              </div>
              <div className={`w-16 h-16 rounded-xl ${value.iconClass} flex items-center justify-center`}>
                <span className="material-symbols-outlined text-4xl">{value.icon}</span>
              </div>
              <div className="flex flex-col gap-4">
                <h3 className={`font-display-lg text-4xl font-bold ${value.titleClass} tracking-tight`}>{value.title}</h3>
                <p className="text-on-surface-variant text-lg leading-relaxed">{value.desc}</p>
              </div>
              <div className="mt-auto pt-4">
                <div
                  className={`w-12 h-1 ${value.barClass} rounded-full group-hover:w-full group-hover:bg-gradient-to-r group-hover:from-apc-red group-hover:via-apc-gold group-hover:to-apc-blue transition-all duration-500`}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

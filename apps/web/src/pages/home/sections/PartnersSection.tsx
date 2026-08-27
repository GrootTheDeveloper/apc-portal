import { Eyebrow } from './Eyebrow'

const PARTNERS = ['Đối tác 01', 'Đối tác 02', 'Đối tác 03', 'Đối tác 04', 'Đối tác 05']

export function PartnersSection() {
  return (
    <section className="w-full min-h-0 py-20 px-gutter bg-gradient-to-br from-apc-gold to-[#d18e00] text-apc-dark relative overflow-hidden">
      {/* Vệt sáng nhẹ, đồng bộ với các section gradient khác */}
      <div
        aria-hidden
        className="absolute -top-1/3 left-1/2 -translate-x-1/2 w-[70%] h-[70%] rounded-full bg-white/20 blur-3xl pointer-events-none"
      />
      <div className="max-w-container-max mx-auto fade-up w-full flex flex-col items-center text-center relative z-10">
        <Eyebrow className="text-apc-dark/70 justify-center mb-4">ĐỐI TÁC ĐỒNG HÀNH</Eyebrow>
        <p className="text-apc-dark/80 text-sm mb-10 max-w-md">
          Danh sách đối tác sẽ được cập nhật khi APC công bố chính thức.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 w-full max-w-4xl">
          {PARTNERS.map((name) => (
            <div
              key={name}
              className="group h-24 rounded-xl border border-apc-dark/15 bg-white/40 flex flex-col items-center justify-center gap-2 text-apc-dark/60 hover:bg-white hover:text-apc-dark hover:-translate-y-1 transition-all duration-300"
            >
              <span className="material-symbols-outlined text-3xl">corporate_fare</span>
              <span className="text-[11px] font-medium">{name}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

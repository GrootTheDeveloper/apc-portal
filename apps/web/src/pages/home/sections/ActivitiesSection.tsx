const SLIDER_IMAGES = [
  { src: '/assets/home/03-workshop.jpg', alt: 'Workshop' },
  { src: '/assets/home/04-teamwork.jpg', alt: 'Teamwork' },
  { src: '/assets/home/05-coding.jpg', alt: 'Coding' },
]

const ACTIVITIES = [
  { title: 'Training/Workshop', desc: 'Chia sẻ kiến thức chuyên sâu.' },
  { title: 'UMTOJ', desc: 'Hệ thống chấm bài tự động.' },
  { title: 'UMT TechGen', desc: 'Ươm mầm tài năng công nghệ.' },
  { title: 'Website Development', desc: 'Xây dựng giải pháp web.' },
]

export function ActivitiesSection() {
  return (
    <section className="w-full bg-black text-white relative overflow-hidden flex flex-col items-center justify-center">
      {/* Ảnh nền slider tự chạy */}
      <div className="absolute inset-0 z-0">
        {SLIDER_IMAGES.map((image) => (
          <img key={image.src} alt={image.alt} className="hero-slider-img" src={image.src} />
        ))}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/50 to-black/30" />
      </div>
      <div className="max-w-container-max mx-auto px-gutter w-full relative z-20 py-24 flex flex-col lg:flex-row items-center gap-12">
        <div className="flex-1">
          <h2 className="font-headline-md text-4xl lg:text-5xl font-bold mb-6">
            Cùng học. Cùng làm.
            <br />
            Cùng trưởng thành.
          </h2>
          <p className="text-white/90 max-w-xl text-lg mb-8 leading-relaxed">
            Khám phá các hoạt động đa dạng tại APC, nơi bạn có thể rèn luyện kỹ năng thực chiến và xây dựng portfolio ấn
            tượng. Tham gia ngay để nâng tầm kỹ năng cùng cộng đồng công nghệ UMT.
          </p>
        </div>
        <div className="w-full lg:w-[400px] flex flex-col gap-3">
          {ACTIVITIES.map((activity) => (
            <div
              key={activity.title}
              className="bg-white/10 backdrop-blur-md p-5 rounded-xl border border-white/20 hover:bg-white/20 transition-all cursor-pointer flex items-center justify-between group"
            >
              <div>
                <h4 className="font-bold text-lg mb-1 text-white group-hover:text-apc-gold transition-colors">
                  {activity.title}
                </h4>
                <p className="text-white/70 text-sm">{activity.desc}</p>
              </div>
              <span className="material-symbols-outlined text-xl opacity-50 group-hover:opacity-100 group-hover:translate-x-1 transition-all">
                arrow_forward
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

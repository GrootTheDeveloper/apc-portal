import { Eyebrow } from './Eyebrow'

// Class màu để literal (không nội suy) để Tailwind JIT nhận diện được.
const NEWS = [
  {
    category: 'Chuyên môn',
    chipClass: 'bg-apc-blue/10 text-apc-blue',
    cover: 'from-apc-blue/15 to-surface-container-high',
    iconClass: 'text-apc-blue/50',
    icon: 'database',
    date: '10 Thg 11, 2024',
    title: 'Tối ưu hóa query SQL cho ứng dụng web quy mô lớn',
    excerpt:
      'Tips thực tế từ dự án UMTOJ để giảm thời gian phản hồi của database xuống dưới 50ms khi xử lý hàng ngàn request đồng thời.',
    author: { initials: 'TN', name: 'Trần Nam', role: 'Trưởng ban Kỹ thuật', avatarClass: 'bg-apc-blue text-white' },
  },
  {
    category: 'Thông báo',
    chipClass: 'bg-apc-gold/10 text-apc-gold',
    cover: 'from-apc-gold/20 to-surface-container-high',
    iconClass: 'text-apc-gold/60',
    icon: 'campaign',
    date: '05 Thg 11, 2024',
    title: 'Tổng kết chặng 1 - Khóa đào tạo Tân binh Gen 3',
    excerpt:
      'Nhìn lại 4 tuần đầu tiên đầy thử thách và nhiệt huyết của các thành viên mới. 100% hoàn thành project cá nhân giai đoạn 1.',
    author: { initials: 'MA', name: 'Minh Anh', role: 'Ban Truyền thông', avatarClass: 'bg-apc-red text-white' },
  },
  {
    category: 'Chia sẻ',
    chipClass: 'bg-apc-red/10 text-apc-red',
    cover: 'from-apc-red/15 to-surface-container-high',
    iconClass: 'text-apc-red/50',
    icon: 'lightbulb',
    date: '28 Thg 10, 2024',
    title: 'Kinh nghiệm làm sản phẩm thực tế cho sinh viên năm nhất',
    excerpt:
      'Từ ý tưởng đến bản demo chạy được: cách chọn phạm vi vừa sức, chia việc theo tuần và giữ động lực khi gặp bug khó.',
    author: { initials: 'QH', name: 'Quốc Huy', role: 'Ban Chuyên môn', avatarClass: 'bg-apc-gold text-apc-dark' },
  },
]

export function NewsSection() {
  return (
    <section className="w-full min-h-0 py-12 px-gutter bg-white border-t border-outline-variant/20">
      <div className="max-w-container-max mx-auto fade-up w-full">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-12 border-b border-outline-variant/20 pb-6">
          <div>
            <Eyebrow className="text-apc-blue mb-2">BLOG</Eyebrow>
            <h2 className="font-headline-md text-[32px] font-bold text-on-surface">Tin tức &amp; Cập nhật</h2>
          </div>
          <a className="text-apc-blue font-medium flex items-center gap-1 hover:underline text-sm mt-4 md:mt-0" href="#">
            Đọc thêm trên Blog <span className="material-symbols-outlined text-sm">arrow_forward</span>
          </a>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {NEWS.map((item) => (
            <article
              key={item.title}
              className="group bg-white rounded-2xl overflow-hidden shadow-sm border border-outline-variant/20 flex flex-col hover:shadow-md hover:-translate-y-1 transition-all duration-300 cursor-pointer"
            >
              <div className={`aspect-[16/10] flex items-center justify-center bg-gradient-to-br ${item.cover}`}>
                <span className={`material-symbols-outlined text-5xl ${item.iconClass}`}>{item.icon}</span>
              </div>
              <div className="p-6 flex flex-col gap-3 flex-1">
                <div className="flex items-center justify-between">
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${item.chipClass}`}>{item.category}</span>
                  <span className="text-on-surface-variant text-xs">{item.date}</span>
                </div>
                <h3 className="font-bold text-lg text-on-surface leading-tight group-hover:text-apc-blue transition-colors">
                  {item.title}
                </h3>
                <p className="text-on-surface-variant text-sm line-clamp-2 flex-1">{item.excerpt}</p>
                <div className="pt-4 border-t border-outline-variant/20 flex items-center gap-3">
                  <div
                    className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs ${item.author.avatarClass}`}
                  >
                    {item.author.initials}
                  </div>
                  <div className="text-xs">
                    <p className="font-bold text-on-surface">{item.author.name}</p>
                    <p className="text-on-surface-variant">{item.author.role}</p>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}

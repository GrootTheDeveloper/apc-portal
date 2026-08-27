import { Eyebrow } from './Eyebrow'

const CONTACTS = [
  { icon: 'person', title: 'ThS. Nguyễn Văn A', text: 'Giảng viên Cố vấn' },
  { icon: 'mail', title: 'Email liên hệ', text: 'apc@umt.edu.vn', href: 'mailto:apc@umt.edu.vn' },
  { icon: 'location_on', title: 'Văn phòng CLB', text: 'Phòng Lab Công Nghệ (Tầng 3), Tòa nhà UMT' },
]

export function HostSection() {
  return (
    <section className="w-full py-24 px-gutter bg-gradient-to-br from-apc-blue to-apc-dark text-white relative overflow-hidden">
      {/* Vệt sáng nhẹ cho chiều sâu, đồng bộ với section Gia nhập */}
      <div
        aria-hidden
        className="absolute -top-1/3 left-1/2 -translate-x-1/2 w-[80%] h-[80%] rounded-full bg-white/10 blur-3xl pointer-events-none"
      />
      <div className="max-w-container-max mx-auto flex flex-col lg:flex-row items-center gap-12 relative z-10 w-full">
        {/* Cột trái */}
        <div className="w-full lg:w-[60%] flex flex-col gap-6">
          <Eyebrow className="text-white/60">ĐƠN VỊ CHỦ QUẢN</Eyebrow>
          <h2 className="font-display-lg text-[32px] md:text-[48px] leading-tight font-bold text-white">
            Trực thuộc Khoa Công Nghệ
            <br />
            Trường Đại học Quản lý và Công nghệ TP.HCM (UMT)
          </h2>
          <p className="text-white/80 text-lg leading-relaxed max-w-2xl">
            APC hoạt động dưới sự hướng dẫn chuyên môn và bảo trợ trực tiếp từ Ban Chủ nhiệm Khoa Công Nghệ, đảm bảo định
            hướng phát triển học thuật và ứng dụng thực tiễn chuẩn xác nhất.
          </p>
          <a className="flex items-center gap-2 text-white hover:underline font-medium w-max" href="#">
            Tìm hiểu về Khoa Công Nghệ UMT <span className="material-symbols-outlined text-sm">open_in_new</span>
          </a>
        </div>
        {/* Cột phải: card liên hệ */}
        <div className="w-full lg:w-[40%]">
          <div className="bg-white/10 backdrop-blur-md border border-white/20 p-8 rounded-2xl flex flex-col gap-8">
            <h3 className="font-headline-sm text-xl font-bold">Liên hệ Ban Chủ Nhiệm</h3>
            <div className="flex flex-col gap-6">
              {CONTACTS.map((contact) => (
                <div key={contact.title} className="flex items-start gap-4">
                  <div className="mt-1">
                    <span className="material-symbols-outlined text-white/70">{contact.icon}</span>
                  </div>
                  <div>
                    <p className="font-bold text-white">{contact.title}</p>
                    {contact.href ? (
                      <a className="text-white/60 text-sm hover:text-white transition-colors" href={contact.href}>
                        {contact.text}
                      </a>
                    ) : (
                      <p className="text-white/60 text-sm">{contact.text}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      {/* Ảnh nền trang trí */}
      <div className="absolute right-0 top-0 h-full w-1/3 opacity-5 pointer-events-none">
        <img alt="" className="h-full w-full object-contain object-right" src="/assets/home/08-image-08.png" />
      </div>
    </section>
  )
}

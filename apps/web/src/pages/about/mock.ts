// Dữ liệu giả cho trang Về APC. Hình dạng giống phản hồi GET /public/about ở T2;
// T2 sẽ thay mock bằng useApi('/public/about').

export type OfficialLink = { label: string; url: string }

export type Department = {
  id: string
  name: string
  description: string
  /** Kênh liên hệ chung của ban (email ban / fanpage / chức danh) — KHÔNG phải tên, email, SĐT cá nhân (BR-20, DATA-03). */
  contact: string
  order: number
}

export type AboutData = {
  name: string
  description: string
  mission: string
  contactEmail: string
  fanpage: string
  officialLinks: OfficialLink[]
  departments: Department[]
}

export const MOCK_ABOUT: AboutData = {
  name: 'Câu lạc bộ Lập trình ứng dụng (APC)',
  description:
    'APC – Applied Programming Club – là câu lạc bộ học thuật trực thuộc Khoa Công Nghệ, Trường Đại học Quản lý và Công nghệ TP.HCM (UMT). Thành lập năm 2022, APC quy tụ sinh viên đam mê công nghệ cùng học, cùng làm và cùng trưởng thành qua các dự án thực tế.',
  mission:
    'Xây dựng cộng đồng sinh viên công nghệ nơi mỗi thành viên được rèn luyện kỹ năng lập trình, phát triển tư duy giải quyết vấn đề và chuyển hóa ý tưởng thành sản phẩm có giá trị thực tiễn.',
  contactEmail: 'apc@umt.edu.vn',
  fanpage: 'https://www.facebook.com/apc.umt',
  officialLinks: [
    { label: 'UMT Online Judge', url: 'https://sot.umtoj.edu.vn' },
    { label: 'Trang UMT chính thức', url: 'https://umt.edu.vn' },
    { label: 'Facebook APC', url: 'https://www.facebook.com/apc.umt' },
  ],
  departments: [
    {
      id: 'dept-1',
      name: 'Ban Kỹ thuật',
      description:
        'Nghiên cứu, phát triển sản phẩm phần mềm và hỗ trợ kỹ thuật cho các hoạt động của CLB. Tổ chức workshop, code review và cuộc thi lập trình nội bộ.',
      contact: 'Email: kythuat.apc@umt.edu.vn',
      order: 1,
    },
    {
      id: 'dept-2',
      name: 'Ban Truyền thông',
      description:
        'Quản lý hình ảnh, nội dung truyền thông và vận hành các kênh liên lạc chính thức của CLB trên mạng xã hội.',
      contact: 'Fanpage APC',
      order: 2,
    },
    {
      id: 'dept-3',
      name: 'Ban Sự kiện',
      description:
        'Lên kế hoạch, tổ chức sự kiện và hoạt động ngoại khóa giúp thành viên kết nối, học hỏi và chia sẻ kinh nghiệm.',
      contact: 'Email: sukien.apc@umt.edu.vn',
      order: 3,
    },
    {
      id: 'dept-4',
      name: 'Ban Học thuật',
      description:
        'Xây dựng tài liệu, hướng dẫn tự học và tổ chức các buổi seminar, study group về thuật toán và công nghệ mới.',
      contact: 'Email: hocthuatapc@umt.edu.vn',
      order: 4,
    },
  ],
}

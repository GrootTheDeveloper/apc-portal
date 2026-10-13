export type RecruitmentDepartment = {
  id: string
  name: string
  code: string
  description: string
}

export type RecruitmentRoundStatus = 'DRAFT' | 'OPEN' | 'CLOSED' | 'ARCHIVED'

export type RecruitmentRoundItem = {
  id: string
  title: string
  slug: string
  description: string
  status: RecruitmentRoundStatus
  opensAt: string
  closesAt: string
  audience: string
  requirements: string
  departments: RecruitmentDepartment[]
}

export const MOCK_DEPARTMENTS: RecruitmentDepartment[] = [
  {
    id: 'dept-dev',
    name: 'Ban Kỹ thuật & Phát triển (Software Development)',
    code: 'DEV',
    description: 'Xây dựng website, mobile app, API hệ thống và các sản phẩm công nghệ phục vụ sinh viên.',
  },
  {
    id: 'dept-ai',
    name: 'Ban Trí tuệ nhân tạo & Dữ liệu (AI & Data)',
    code: 'AI',
    description: 'Nghiên cứu ứng dụng Machine Learning, phân tích dữ liệu và các mô hình ngôn ngữ lớn.',
  },
  {
    id: 'dept-media',
    name: 'Ban Truyền thông & Sự kiện (Media & Event)',
    code: 'MEDIA',
    description: 'Sáng tạo nội dung, thiết kế ấn phẩm, quay chụp và tổ chức các workshop, cuộc thi học thuật.',
  },
]

export const MOCK_RECRUITMENT_ROUNDS: RecruitmentRoundItem[] = [
  {
    id: 'round-gen-5',
    title: 'Tuyển thành viên Gen 5 - Khơi nguồn sáng tạo',
    slug: 'tuyen-thanh-vien-gen-5',
    description:
      'Đợt tuyển thành viên chính thức thường niên dành cho sinh viên UMT đam mê công nghệ phần mềm và muốn phát triển dự án thực tế.',
    status: 'OPEN',
    // Đang mở: opensAt quá khứ, closesAt tương lai
    opensAt: '2026-10-01T00:00:00Z',
    closesAt: '2026-10-31T23:59:59Z',
    audience: 'Sinh viên Trường Đại học Quản lý và Công nghệ TP.HCM (UMT), ưu tiên khóa 2024, 2025 và 2026.',
    requirements:
      'Có tinh thần chủ động, trách nhiệm, đam mê học hỏi công nghệ và cam kết tham gia sinh hoạt định kỳ tối thiểu 1 buổi/tuần.',
    departments: MOCK_DEPARTMENTS,
  },
  {
    id: 'round-ai-special',
    title: 'Tuyển thực tập sinh Nghiên cứu AI - Đợt 2',
    slug: 'tuyen-thuc-tap-sinh-ai-dot-2',
    description: 'Đợt tuyển chọn thành viên chuyên sâu cho nhóm dự án nghiên cứu mô hình AI tại phòng Lab APC.',
    status: 'OPEN',
    // Sắp mở: opensAt trong tương lai
    opensAt: '2026-11-15T00:00:00Z',
    closesAt: '2026-11-30T23:59:59Z',
    audience: 'Sinh viên ngành Công nghệ thông tin có kiến thức nền tảng về Python và Toán học.',
    requirements: 'Đã hoàn thành môn Lập trình cơ bản, nắm vững cấu trúc dữ liệu và giải thuật.',
    departments: [MOCK_DEPARTMENTS[1]],
  },
  {
    id: 'round-gen-4',
    title: 'Tuyển thành viên Gen 4 - Vững bước công nghệ',
    slug: 'tuyen-thanh-vien-gen-4',
    description: 'Đợt tuyển thành viên năm học 2025 - 2026 đã hoàn thành xuất sắc giai đoạn tuyển chọn.',
    status: 'CLOSED',
    // Đã đóng
    opensAt: '2025-10-01T00:00:00Z',
    closesAt: '2025-10-25T23:59:59Z',
    audience: 'Sinh viên UMT mọi khóa.',
    requirements: 'Đam mê lập trình và hoạt động câu lạc bộ.',
    departments: MOCK_DEPARTMENTS,
  },
]
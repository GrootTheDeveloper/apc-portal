/**
 * Dữ liệu mẫu (D1). Chạy: pnpm --filter @apc/api db:seed
 *
 * T2: thêm SiteSetting và contactPoint cho các ban.
 * Thay đổi trong cùng PR với migration (T-thanh-vien §T2, dòng "Cập nhật dữ liệu mẫu D1").
 */

import { db } from './client.js'

async function main() {
  // --- SiteSetting (singleton) ---
  await db.siteSetting.upsert({
    where: { id: 'singleton' },
    update: {},
    create: {
      id: 'singleton',
      info: {
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
      },
      termEndsAt: new Date('2027-06-01T00:00:00Z'),
    },
  })

  // --- Departments ---
  const departments = [
    {
      name: 'Ban Kỹ thuật',
      code: 'KT',
      description:
        'Nghiên cứu, phát triển sản phẩm phần mềm và hỗ trợ kỹ thuật cho các hoạt động của CLB. Tổ chức workshop, code review và cuộc thi lập trình nội bộ.',
      contactPoint: 'Email: kythuat.apc@umt.edu.vn',
      order: 1,
    },
    {
      name: 'Ban Truyền thông',
      code: 'TTH',
      description:
        'Quản lý hình ảnh, nội dung truyền thông và vận hành các kênh liên lạc chính thức của CLB trên mạng xã hội.',
      contactPoint: 'Fanpage: facebook.com/apc.umt',
      order: 2,
    },
    {
      name: 'Ban Sự kiện',
      code: 'SK',
      description:
        'Lên kế hoạch, tổ chức sự kiện và hoạt động ngoại khóa giúp thành viên kết nối, học hỏi và chia sẻ kinh nghiệm.',
      contactPoint: 'Email: sukien.apc@umt.edu.vn',
      order: 3,
    },
    {
      name: 'Ban Học thuật',
      code: 'HT',
      description:
        'Xây dựng tài liệu, hướng dẫn tự học và tổ chức các buổi seminar, study group về thuật toán và công nghệ mới.',
      contactPoint: 'Email: hocthuatapc@umt.edu.vn',
      order: 4,
    },
  ]

  for (const dept of departments) {
    await db.department.upsert({
      where: { code: dept.code },
      update: { contactPoint: dept.contactPoint },
      create: dept,
    })
  }

  console.log('✅ Seed hoàn tất.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())

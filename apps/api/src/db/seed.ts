import path from 'node:path'
import { config } from 'dotenv'
import { db } from './client.js'
import { hashPassword } from '../lib/password.js'
import type {
  AccountStatus,
  ApplicationStatus,
  ContentScope,
  ContentStatus,
  EventStatus,
  MemberStatus,
  RecruitmentRoundStatus,
  Role,
  RoleAssignmentStatus,
} from './generated/enums.js'

config({ path: path.resolve(import.meta.dirname, '../../../../.env'), quiet: true })

const isProduction = process.env.NODE_ENV === 'production'
const allowSeed = process.env.ALLOW_SEED === 'true'

if (isProduction && !allowSeed) {
  console.error('Không được chạy seed ở production trừ khi ALLOW_SEED=true')
  process.exit(1)
}

const seedPassword = process.env.SEED_PASSWORD ?? ''
if (!seedPassword) {
  console.error('Thiếu biến môi trường SEED_PASSWORD')
  process.exit(1)
}

type SeedUser = {
  username: string
  status: AccountStatus
  departmentId?: string
  role?: Role
  roleStatus?: RoleAssignmentStatus
  memberStatus?: MemberStatus
  mustChangePassword?: boolean
  isTemporaryPassword?: boolean
  temporaryPasswordExpiresAt?: Date
}

async function main() {
  const passwordHash = await hashPassword(seedPassword)

  // 0. Thông tin CLB (T2). Chạy lại seed không ghi đè chỗ đã sửa trong db:studio.
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

  // 1. Departments (đầu mối liên hệ là kênh chung của ban, không phải thông tin cá nhân — ORG-02, BR-20)
  const banA = await db.department.upsert({
    where: { code: 'ban-a' },
    update: { status: 'ACTIVE', contactPoint: 'Email ban: ban-a@example.com' },
    create: {
      name: 'Ban A',
      code: 'ban-a',
      status: 'ACTIVE',
      contactPoint: 'Email ban: ban-a@example.com',
    },
  })

  const banB = await db.department.upsert({
    where: { code: 'ban-b' },
    update: { status: 'ACTIVE', contactPoint: 'Fanpage APC' },
    create: {
      name: 'Ban B',
      code: 'ban-b',
      status: 'ACTIVE',
      contactPoint: 'Fanpage APC',
    },
  })

  await db.department.upsert({
    where: { code: 'ban-c' },
    update: { status: 'ARCHIVED' },
    create: {
      name: 'Ban C',
      code: 'ban-c',
      status: 'ARCHIVED',
    },
  })

  // 2. Users
  const users: SeedUser[] = [
    { username: 'board', status: 'ACTIVE', role: 'BOARD', roleStatus: 'ACTIVE' },
    { username: 'techadmin', status: 'ACTIVE', role: 'TECH_ADMIN', roleStatus: 'ACTIVE' },
    { username: 'board.pending', status: 'ACTIVE', role: 'BOARD', roleStatus: 'PENDING' },
    { username: 'manager.a', status: 'ACTIVE', role: 'DEPARTMENT_MANAGER', departmentId: banA.id, roleStatus: 'ACTIVE' },
    { username: 'manager.b', status: 'ACTIVE', role: 'DEPARTMENT_MANAGER', departmentId: banB.id, roleStatus: 'ACTIVE' },
    { username: 'member.a', status: 'ACTIVE', departmentId: banA.id },
    { username: 'member.b', status: 'ACTIVE', departmentId: banB.id },
    {
      username: 'pending',
      status: 'PENDING_ACTIVATION',
      departmentId: banA.id,
      mustChangePassword: true,
      isTemporaryPassword: true,
      temporaryPasswordExpiresAt: new Date(Date.now() + 72 * 3600000),
    },
    { username: 'locked', status: 'LOCKED', departmentId: banA.id },
    { username: 'inactive', status: 'INACTIVE', departmentId: banA.id, memberStatus: 'LEFT' },
  ]

  let i = 1
  for (const u of users) {
    const studentId = `20${String(i).padStart(6, '0')}`
    const departmentId = u.departmentId ?? null
    // Chạy lại seed thì cập nhật cả mật khẩu, để đổi SEED_PASSWORD là có hiệu lực ngay.
    const fields = {
      passwordHash,
      status: u.status,
      memberStatus: u.memberStatus ?? 'ACTIVE',
      mustChangePassword: u.mustChangePassword ?? false,
      isTemporaryPassword: u.isTemporaryPassword ?? false,
      temporaryPasswordExpiresAt: u.temporaryPasswordExpiresAt ?? null,
      departmentId,
    } as const

    const user = await db.user.upsert({
      where: { username: u.username },
      update: fields,
      create: {
        ...fields,
        username: u.username,
        email: `${u.username}@example.com`,
        fullName: `User ${u.username}`,
        studentId,
        phoneNumber: `0900${studentId}`,
      },
    })

    if (u.role && u.roleStatus) {
      const existingRole = await db.userRole.findFirst({
        where: { userId: user.id, role: u.role, departmentId },
      })
      const expiresAt = u.role === 'BOARD' || u.role === 'TECH_ADMIN' ? new Date(Date.now() + 365 * 24 * 3600000) : null

      if (!existingRole) {
        await db.userRole.create({
          data: {
            userId: user.id,
            role: u.role,
            departmentId,
            status: u.roleStatus,
            startsAt: new Date(),
            expiresAt,
            reason: 'Dữ liệu mẫu',
          },
        })
      } else {
        await db.userRole.update({
          where: { id: existingRole.id },
          data: { status: u.roleStatus, expiresAt },
        })
      }
    }

    i++
  }

  const boardUser = await db.user.findUnique({ where: { username: 'board' } })
  if (!boardUser) throw new Error('Board user not found')

  // 3. Posts
  const posts: { slug: string; title: string; status: ContentStatus; scope: ContentScope; category: string; departmentId?: string }[] = [
    { slug: 'post-1', title: 'Bài viết công khai 1', status: 'PUBLISHED', scope: 'PUBLIC', category: 'Chuyên môn' },
    { slug: 'post-2', title: 'Bài viết công khai 2', status: 'PUBLISHED', scope: 'PUBLIC', category: 'Thông báo' },
    { slug: 'post-3', title: 'Bài viết công khai 3', status: 'PUBLISHED', scope: 'PUBLIC', category: 'Chia sẻ' },
    { slug: 'post-4', title: 'Bài viết công khai 4', status: 'PUBLISHED', scope: 'PUBLIC', category: 'Chuyên môn' },
    { slug: 'post-draft', title: 'Bài viết nháp', status: 'DRAFT', scope: 'PUBLIC', category: 'Chuyên môn' },
    { slug: 'post-archived', title: 'Bài viết lưu trữ', status: 'ARCHIVED', scope: 'PUBLIC', category: 'Chia sẻ' },
    { slug: 'post-internal', title: 'Thông báo nội bộ Ban A', status: 'PUBLISHED', scope: 'INTERNAL', category: 'Thông báo', departmentId: banA.id },
  ]

  for (const p of posts) {
    await db.post.upsert({
      where: { slug: p.slug },
      update: {
        status: p.status,
        scope: p.scope,
        category: p.category,
      },
      create: {
        slug: p.slug,
        title: p.title,
        summary: `Tóm tắt ${p.title}`,
        content: `Nội dung ${p.title}`,
        category: p.category,
        status: p.status,
        scope: p.scope,
        authorId: boardUser.id,
        departmentId: p.departmentId ?? null,
        publishedById: p.status === 'PUBLISHED' ? boardUser.id : null,
        publishedAt: p.status === 'PUBLISHED' ? new Date() : null,
      },
    })
  }

  // 4. Events
  const events: { slug: string; title: string; status: EventStatus; startAt: Date; endAt: Date }[] = [
    { slug: 'event-upcoming', title: 'Sự kiện sắp diễn ra', status: 'PUBLISHED', startAt: new Date(Date.now() + 86400000), endAt: new Date(Date.now() + 2 * 86400000) },
    { slug: 'event-cancelled', title: 'Sự kiện đã hủy', status: 'CANCELLED', startAt: new Date(Date.now() + 86400000), endAt: new Date(Date.now() + 2 * 86400000) },
    { slug: 'event-ended', title: 'Sự kiện đã kết thúc', status: 'ENDED', startAt: new Date(Date.now() - 2 * 86400000), endAt: new Date(Date.now() - 86400000) },
    { slug: 'event-draft', title: 'Sự kiện nháp', status: 'DRAFT', startAt: new Date(Date.now() + 86400000), endAt: new Date(Date.now() + 2 * 86400000) },
    { slug: 'event-archived', title: 'Sự kiện lưu trữ', status: 'ARCHIVED', startAt: new Date(Date.now() - 2 * 86400000), endAt: new Date(Date.now() - 86400000) },
  ]

  for (const e of events) {
    await db.event.upsert({
      where: { slug: e.slug },
      update: { status: e.status },
      create: {
        slug: e.slug,
        title: e.title,
        description: `Mô tả ${e.title}`,
        eventType: 'Workshop',
        status: e.status,
        createdById: boardUser.id,
        startAt: e.startAt,
        endAt: e.endAt,
      },
    })
  }

  // 5. Projects
  const projects: { slug: string; title: string; status: ContentStatus }[] = [
    { slug: 'project-1', title: 'Dự án 1', status: 'PUBLISHED' },
    { slug: 'project-2', title: 'Dự án 2', status: 'PUBLISHED' },
    { slug: 'project-draft', title: 'Dự án nháp', status: 'DRAFT' },
    { slug: 'project-archived', title: 'Dự án lưu trữ', status: 'ARCHIVED' },
  ]

  for (const p of projects) {
    await db.project.upsert({
      where: { slug: p.slug },
      update: { status: p.status },
      create: {
        slug: p.slug,
        title: p.title,
        description: `Mô tả ${p.title}`,
        status: p.status,
        createdById: boardUser.id,
        publishedAt: p.status === 'PUBLISHED' ? new Date() : null,
      },
    })
  }

  // 6. Recruitment Rounds
  const rounds: { slug: string; title: string; status: RecruitmentRoundStatus; opensAt: Date; closesAt: Date }[] = [
    { slug: 'round-open', title: 'Đợt tuyển đang mở', status: 'OPEN', opensAt: new Date(Date.now() - 86400000), closesAt: new Date(Date.now() + 86400000) },
    { slug: 'round-closed', title: 'Đợt tuyển đã đóng', status: 'CLOSED', opensAt: new Date(Date.now() - 2 * 86400000), closesAt: new Date(Date.now() - 86400000) },
    { slug: 'round-draft', title: 'Đợt tuyển nháp', status: 'DRAFT', opensAt: new Date(Date.now() + 86400000), closesAt: new Date(Date.now() + 2 * 86400000) },
    { slug: 'round-archived', title: 'Đợt tuyển lưu trữ', status: 'ARCHIVED', opensAt: new Date(Date.now() - 4 * 86400000), closesAt: new Date(Date.now() - 3 * 86400000) },
  ]

  for (const r of rounds) {
    await db.recruitmentRound.upsert({
      where: { slug: r.slug },
      update: { status: r.status },
      create: {
        slug: r.slug,
        title: r.title,
        description: `Mô tả ${r.title}`,
        status: r.status,
        opensAt: r.opensAt,
        closesAt: r.closesAt,
        createdById: boardUser.id,
      },
    })
  }

  const openRound = await db.recruitmentRound.findUnique({ where: { slug: 'round-open' } })
  if (openRound) {
    // 7. Applications
    const apps: { profileCode: string; email: string; deptId: string; status: ApplicationStatus }[] = [
      { profileCode: 'app-ban-a-new', email: 'app1@example.com', deptId: banA.id, status: 'NEW' },
      { profileCode: 'app-ban-a-review', email: 'app2@example.com', deptId: banA.id, status: 'REVIEWING' },
      { profileCode: 'app-ban-b-new', email: 'app3@example.com', deptId: banB.id, status: 'NEW' },
      { profileCode: 'app-ban-b-interview', email: 'app4@example.com', deptId: banB.id, status: 'INTERVIEW' },
    ]

    let j = 1
    for (const a of apps) {
      await db.membershipApplication.upsert({
        where: { profileCode: a.profileCode },
        update: { status: a.status },
        create: {
          profileCode: a.profileCode,
          recruitmentRoundId: openRound.id,
          applicantName: `Ứng viên ${j}`,
          applicantEmail: a.email,
          studentId: `24${String(j).padStart(6, '0')}`,
          desiredDepartmentId: a.deptId,
          status: a.status,
        },
      })
      j++
    }
  }

  console.log('Seed dữ liệu mẫu thành công.')
}

main()
  .catch((e) => {
    console.error('Lỗi khi chạy seed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })

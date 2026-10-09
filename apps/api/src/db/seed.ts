import path from 'node:path'
import { config } from 'dotenv'
import { db } from './client.js'
import { hashPassword } from '../lib/password.js'
import { randomBytes, randomUUID } from 'node:crypto'

config({ path: path.resolve(import.meta.dirname, '../../../../.env'), quiet: true })

const isProduction = process.env.NODE_ENV === 'production'
const allowSeed = process.env.ALLOW_SEED === 'true'

if (isProduction && !allowSeed) {
  console.error('Không được chạy seed ở production trừ khi ALLOW_SEED=true')
  process.exit(1)
}

const seedPassword = process.env.SEED_PASSWORD
if (!seedPassword) {
  console.error('Thiếu biến môi trường SEED_PASSWORD')
  process.exit(1)
}

async function main() {
  const passwordHash = await hashPassword(seedPassword as string)

  // 1. Departments
  const banA = await db.department.upsert({
    where: { code: 'ban-a' },
    update: { status: 'ACTIVE' },
    create: {
      name: 'Ban A',
      code: 'ban-a',
      status: 'ACTIVE',
    },
  })

  const banB = await db.department.upsert({
    where: { code: 'ban-b' },
    update: { status: 'ACTIVE' },
    create: {
      name: 'Ban B',
      code: 'ban-b',
      status: 'ACTIVE',
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
  const users = [
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
    
    // @ts-ignore
    const { role, roleStatus, departmentId, ...userData } = u
    
    const user = await db.user.upsert({
      where: { username: u.username },
      update: {
        status: userData.status as any,
        memberStatus: (userData.memberStatus as any) || 'ACTIVE',
        mustChangePassword: userData.mustChangePassword || false,
        isTemporaryPassword: userData.isTemporaryPassword || false,
        temporaryPasswordExpiresAt: userData.temporaryPasswordExpiresAt || null,
        departmentId: departmentId || null,
      },
      create: {
        username: u.username,
        email: `${u.username}@example.com`,
        passwordHash,
        fullName: `User ${u.username}`,
        studentId,
        phoneNumber: `0900${studentId}`,
        status: userData.status as any,
        memberStatus: (userData.memberStatus as any) || 'ACTIVE',
        mustChangePassword: userData.mustChangePassword || false,
        isTemporaryPassword: userData.isTemporaryPassword || false,
        temporaryPasswordExpiresAt: userData.temporaryPasswordExpiresAt || null,
        departmentId: departmentId || null,
      },
    })

    if (role) {
      const existingRole = await db.userRole.findFirst({
        where: { userId: user.id, role: role as any, departmentId: departmentId || null },
      })
      
      const startsAt = new Date()
      const expiresAt = (role === 'BOARD' || role === 'TECH_ADMIN') ? new Date(Date.now() + 365 * 24 * 3600000) : null
      
      if (!existingRole) {
        await db.userRole.create({
          data: {
            userId: user.id,
            role: role as any,
            departmentId: departmentId || null,
            status: roleStatus as any,
            startsAt,
            expiresAt,
            reason: 'Dữ liệu mẫu',
          },
        })
      } else {
        await db.userRole.update({
          where: { id: existingRole.id },
          data: {
            status: roleStatus as any,
            expiresAt,
          },
        })
      }
    }
    
    i++
  }

  const boardUser = await db.user.findUnique({ where: { username: 'board' } })
  if (!boardUser) throw new Error('Board user not found')

  // 3. Posts
  const posts = [
    { slug: 'post-1', title: 'Bài viết công khai 1', status: 'PUBLISHED', scope: 'PUBLIC', category: 'News' },
    { slug: 'post-2', title: 'Bài viết công khai 2', status: 'PUBLISHED', scope: 'PUBLIC', category: 'News' },
    { slug: 'post-3', title: 'Bài viết công khai 3', status: 'PUBLISHED', scope: 'PUBLIC', category: 'News' },
    { slug: 'post-4', title: 'Bài viết công khai 4', status: 'PUBLISHED', scope: 'PUBLIC', category: 'News' },
    { slug: 'post-draft', title: 'Bài viết nháp', status: 'DRAFT', scope: 'PUBLIC', category: 'News' },
    { slug: 'post-archived', title: 'Bài viết lưu trữ', status: 'ARCHIVED', scope: 'PUBLIC', category: 'News' },
    { slug: 'post-internal', title: 'Thông báo nội bộ Ban A', status: 'PUBLISHED', scope: 'INTERNAL', category: 'Notice', departmentId: banA.id },
  ]

  for (const p of posts) {
    await db.post.upsert({
      where: { slug: p.slug },
      update: {
        status: p.status as any,
        scope: p.scope as any,
      },
      create: {
        slug: p.slug,
        title: p.title,
        summary: `Tóm tắt ${p.title}`,
        content: `Nội dung ${p.title}`,
        category: p.category,
        status: p.status as any,
        scope: p.scope as any,
        authorId: boardUser.id,
        departmentId: p.departmentId || null,
        publishedById: p.status === 'PUBLISHED' ? boardUser.id : null,
        publishedAt: p.status === 'PUBLISHED' ? new Date() : null,
      },
    })
  }

  // 4. Events
  const events = [
    { slug: 'event-upcoming', title: 'Sự kiện sắp diễn ra', status: 'PUBLISHED', startAt: new Date(Date.now() + 86400000), endAt: new Date(Date.now() + 2 * 86400000) },
    { slug: 'event-cancelled', title: 'Sự kiện đã hủy', status: 'CANCELLED', startAt: new Date(Date.now() + 86400000), endAt: new Date(Date.now() + 2 * 86400000) },
    { slug: 'event-ended', title: 'Sự kiện đã kết thúc', status: 'ENDED', startAt: new Date(Date.now() - 2 * 86400000), endAt: new Date(Date.now() - 86400000) },
    { slug: 'event-draft', title: 'Sự kiện nháp', status: 'DRAFT', startAt: new Date(Date.now() + 86400000), endAt: new Date(Date.now() + 2 * 86400000) },
    { slug: 'event-archived', title: 'Sự kiện lưu trữ', status: 'ARCHIVED', startAt: new Date(Date.now() - 2 * 86400000), endAt: new Date(Date.now() - 86400000) },
  ]

  for (const e of events) {
    await db.event.upsert({
      where: { slug: e.slug },
      update: { status: e.status as any },
      create: {
        slug: e.slug,
        title: e.title,
        description: `Mô tả ${e.title}`,
        eventType: 'Workshop',
        status: e.status as any,
        createdById: boardUser.id,
        startAt: e.startAt,
        endAt: e.endAt,
      },
    })
  }

  // 5. Projects
  const projects = [
    { slug: 'project-1', title: 'Dự án 1', status: 'PUBLISHED' },
    { slug: 'project-2', title: 'Dự án 2', status: 'PUBLISHED' },
    { slug: 'project-draft', title: 'Dự án nháp', status: 'DRAFT' },
    { slug: 'project-archived', title: 'Dự án lưu trữ', status: 'ARCHIVED' },
  ]

  for (const p of projects) {
    await db.project.upsert({
      where: { slug: p.slug },
      update: { status: p.status as any },
      create: {
        slug: p.slug,
        title: p.title,
        description: `Mô tả ${p.title}`,
        status: p.status as any,
        createdById: boardUser.id,
        publishedAt: p.status === 'PUBLISHED' ? new Date() : null,
      },
    })
  }

  // 6. Recruitment Rounds
  const rounds = [
    { slug: 'round-open', title: 'Đợt tuyển đang mở', status: 'OPEN', opensAt: new Date(Date.now() - 86400000), closesAt: new Date(Date.now() + 86400000) },
    { slug: 'round-closed', title: 'Đợt tuyển đã đóng', status: 'CLOSED', opensAt: new Date(Date.now() - 2 * 86400000), closesAt: new Date(Date.now() - 86400000) },
    { slug: 'round-draft', title: 'Đợt tuyển nháp', status: 'DRAFT', opensAt: new Date(Date.now() + 86400000), closesAt: new Date(Date.now() + 2 * 86400000) },
    { slug: 'round-archived', title: 'Đợt tuyển lưu trữ', status: 'ARCHIVED', opensAt: new Date(Date.now() - 4 * 86400000), closesAt: new Date(Date.now() - 3 * 86400000) },
  ]

  for (const r of rounds) {
    await db.recruitmentRound.upsert({
      where: { slug: r.slug },
      update: { status: r.status as any },
      create: {
        slug: r.slug,
        title: r.title,
        description: `Mô tả ${r.title}`,
        status: r.status as any,
        opensAt: r.opensAt,
        closesAt: r.closesAt,
        createdById: boardUser.id,
      },
    })
  }

  const openRound = await db.recruitmentRound.findUnique({ where: { slug: 'round-open' } })
  if (openRound) {
    // 7. Applications
    const apps = [
      { profileCode: 'app-ban-a-new', email: 'app1@example.com', deptId: banA.id, status: 'NEW' },
      { profileCode: 'app-ban-a-review', email: 'app2@example.com', deptId: banA.id, status: 'REVIEWING' },
      { profileCode: 'app-ban-b-new', email: 'app3@example.com', deptId: banB.id, status: 'NEW' },
      { profileCode: 'app-ban-b-interview', email: 'app4@example.com', deptId: banB.id, status: 'INTERVIEW' },
    ]

    let j = 1
    for (const a of apps) {
      await db.membershipApplication.upsert({
        where: { profileCode: a.profileCode },
        update: { status: a.status as any },
        create: {
          profileCode: a.profileCode,
          recruitmentRoundId: openRound.id,
          applicantName: `Ứng viên ${j}`,
          applicantEmail: a.email,
          studentId: `24${String(j).padStart(6, '0')}`,
          desiredDepartmentId: a.deptId,
          status: a.status as any,
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

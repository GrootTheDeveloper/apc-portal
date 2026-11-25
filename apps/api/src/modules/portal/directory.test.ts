import { randomUUID } from 'node:crypto'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { buildApp } from '../../app.js'
import { loadConfig } from '../../config.js'
import { db } from '../../db/client.js'
import { hashPassword } from '../../lib/password.js'
import { createSession, SESSION_COOKIE } from '../auth/session.js'
import { passTwoFactor } from '../../../test/twoFactor.js'

const config = loadConfig({ NODE_ENV: 'test' })
const app = buildApp(config)
const tag = randomUUID().slice(0, 8)

const createdUserIds: string[] = []
const createdDeptIds: string[] = []

let deptAId = ''
let deptBId = ''
let viewerCookies: Record<string, string>
let pendingCookies: Record<string, string>
let memberAId = ''
let memberBId = ''
let leftMemberId = ''
let inactiveMemberId = ''

const SENSITIVE_EMAIL = `secret-acc-${tag}@test.local`
const SENSITIVE_CONTACT_EMAIL = `secret-contact-${tag}@test.local`
const SENSITIVE_STUDENT_ID = `SV-SECRET-${tag}`
const SENSITIVE_PHONE = `0987${tag.slice(0, 6)}`

const ALLOWED_MEMBER_KEYS = [
  'avatarUrl',
  'department',
  'fullName',
  'id',
  'interestAreas',
  'roles',
  'skills',
].sort()

const FORBIDDEN_MEMBER_KEYS = [
  'studentId',
  'email',
  'contactEmail',
  'phoneNumber',
  'username',
  'faculty',
  'major',
  'cohort',
  'passwordHash',
  'totpSecret',
  'status',
  'memberStatus',
]

async function makeUser(opts: {
  key: string
  fullName: string
  departmentId?: string | null
  status?: 'ACTIVE' | 'PENDING_ACTIVATION' | 'LOCKED' | 'INACTIVE'
  memberStatus?: 'ACTIVE' | 'PAUSED' | 'LEFT'
  mustChangePassword?: boolean
  avatarUrl?: string | null
  skills?: string[]
  interestAreas?: string[]
  email?: string
  contactEmail?: string
  studentId?: string
  phoneNumber?: string
}) {
  const passwordHash = await hashPassword('mat-khau-test-du-15-ky-tu')
  const user = await db.user.create({
    data: {
      username: `dir-${opts.key}-${tag}`,
      email: opts.email ?? `dir-${opts.key}-${tag}@test.local`,
      contactEmail: opts.contactEmail ?? `contact-${opts.key}-${tag}@test.local`,
      passwordHash,
      fullName: opts.fullName,
      studentId: opts.studentId ?? `SV-${opts.key}-${tag}`,
      faculty: 'Công nghệ thông tin',
      major: 'Kỹ thuật phần mềm',
      cohort: 'K28',
      phoneNumber: opts.phoneNumber ?? `0901${randomUUID().slice(0, 6)}`,
      avatarUrl: opts.avatarUrl ?? null,
      skills: opts.skills ?? [],
      interestAreas: opts.interestAreas ?? [],
      departmentId: opts.departmentId ?? null,
      status: opts.status ?? 'ACTIVE',
      memberStatus: opts.memberStatus ?? 'ACTIVE',
      mustChangePassword: opts.mustChangePassword ?? false,
    },
  })
  createdUserIds.push(user.id)
  return user
}

async function sessionCookies(userId: string) {
  const { token } = await createSession(userId, { ipAddress: '127.0.0.1', userAgent: 'vitest' })
  return { [SESSION_COOKIE]: await passTwoFactor(token) }
}

function assertMinimalMemberPayload(member: Record<string, unknown>) {
  expect(Object.keys(member).sort()).toEqual(ALLOWED_MEMBER_KEYS)
  for (const key of FORBIDDEN_MEMBER_KEYS) {
    expect(member).not.toHaveProperty(key)
  }
  const roles = member.roles as Record<string, unknown>[]
  expect(Array.isArray(roles)).toBe(true)
  expect(roles.length).toBeGreaterThanOrEqual(1)
  for (const roleGrant of roles) {
    expect(Object.keys(roleGrant).sort()).toEqual(['department', 'departmentId', 'role'])
    expect(roleGrant).not.toHaveProperty('reason')
    expect(roleGrant).not.toHaveProperty('grantedById')
  }
}

beforeAll(async () => {
  await app.ready()

  const [deptA, deptB] = await Promise.all([
    db.department.create({ data: { name: `Ban Học Thuật ${tag}`, code: `dir-a-${tag}` } }),
    db.department.create({ data: { name: `Ban Truyền Thông ${tag}`, code: `dir-b-${tag}` } }),
  ])
  deptAId = deptA.id
  deptBId = deptB.id
  createdDeptIds.push(deptAId, deptBId)

  const [viewer, pending, memberA, memberB, leftMember, inactiveMember] = await Promise.all([
    makeUser({ key: 'viewer', fullName: `Người Xem Danh Bạ ${tag}`, departmentId: deptAId }),
    makeUser({
      key: 'pending',
      fullName: `Chờ Kích Hoạt ${tag}`,
      departmentId: deptAId,
      status: 'PENDING_ACTIVATION',
      mustChangePassword: true,
    }),
    makeUser({
      key: 'mem-a',
      fullName: `Nguyễn Minh Anh ${tag}`,
      departmentId: deptAId,
      avatarUrl: '/api/portal/files/avatar-clean-1',
      skills: ['TypeScript', 'React'],
      interestAreas: ['Web', 'Thuật toán'],
      email: SENSITIVE_EMAIL,
      contactEmail: SENSITIVE_CONTACT_EMAIL,
      studentId: SENSITIVE_STUDENT_ID,
      phoneNumber: SENSITIVE_PHONE,
    }),
    makeUser({
      key: 'mem-b',
      fullName: `Trần Bảo Bình ${tag}`,
      departmentId: deptBId,
      skills: ['Figma'],
      interestAreas: ['UI/UX'],
    }),
    makeUser({
      key: 'left',
      fullName: `Cựu Thành Viên ${tag}`,
      departmentId: deptAId,
      memberStatus: 'LEFT',
      status: 'INACTIVE',
    }),
    makeUser({
      key: 'inactive',
      fullName: `Ngừng Hoạt Động ${tag}`,
      departmentId: deptAId,
      memberStatus: 'ACTIVE',
      status: 'INACTIVE',
    }),
  ])

  memberAId = memberA.id
  memberBId = memberB.id
  leftMemberId = leftMember.id
  inactiveMemberId = inactiveMember.id

  // Gán thêm vai trò hiệu lực, vai trò đã thu hồi và vai trò quá hạn cho memberA
  await db.userRole.createMany({
    data: [
      {
        userId: memberAId,
        role: 'DEPARTMENT_MANAGER',
        departmentId: deptAId,
        status: 'ACTIVE',
        startsAt: new Date(Date.now() - 60_000),
        reason: 'Lý do nội bộ không được lộ',
      },
      {
        userId: memberAId,
        role: 'BOARD',
        departmentId: null,
        status: 'REVOKED',
        startsAt: new Date(Date.now() - 120_000),
        revokedAt: new Date(Date.now() - 30_000),
        reason: 'Đã thu hồi',
      },
      {
        userId: memberAId,
        role: 'TECH_ADMIN',
        departmentId: null,
        status: 'ACTIVE',
        startsAt: new Date(Date.now() - 120_000),
        expiresAt: new Date(Date.now() - 10_000),
        reason: 'Đã hết hạn',
      },
    ],
  })

  viewerCookies = await sessionCookies(viewer.id)
  pendingCookies = await sessionCookies(pending.id)
})

afterAll(async () => {
  await db.session.deleteMany({ where: { userId: { in: createdUserIds } } })
  await db.userRole.deleteMany({ where: { userId: { in: createdUserIds } } })
  await db.user.deleteMany({ where: { id: { in: createdUserIds } } })
  await db.department.deleteMany({ where: { id: { in: createdDeptIds } } })
  await app.close()
  await db.$disconnect()
})

describe('T6: Danh bạ thành viên (/portal/members)', () => {
  describe('GET /portal/members', () => {
    it('chưa đăng nhập nhận 401; tài khoản chờ kích hoạt nhận 403', async () => {
      const unauth = await app.inject({ method: 'GET', url: '/portal/members' })
      expect(unauth.statusCode).toBe(401)
      expect(unauth.json().error).toBe('unauthenticated')

      const pendingRes = await app.inject({
        method: 'GET',
        url: '/portal/members',
        cookies: pendingCookies,
      })
      expect(pendingRes.statusCode).toBe(403)
      expect(pendingRes.json().error).toBe('forbidden')
    })

    it('chỉ trả họ tên, ảnh đại diện, ban, vai trò hiệu lực, kỹ năng, lĩnh vực; không lộ MSSV, email, SĐT (MEM-10)', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/portal/members?q=${encodeURIComponent(tag)}&pageSize=50`,
        cookies: viewerCookies,
      })

      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.page).toBe(1)
      expect(body.pageSize).toBe(50)

      // Phản hồi JSON tuyệt đối không chứa MSSV, email, contactEmail hay SĐT
      expect(res.body).not.toContain(SENSITIVE_EMAIL)
      expect(res.body).not.toContain(SENSITIVE_CONTACT_EMAIL)
      expect(res.body).not.toContain(SENSITIVE_STUDENT_ID)
      expect(res.body).not.toContain(SENSITIVE_PHONE)

      const memberA = body.items.find((item: { id: string }) => item.id === memberAId)
      expect(memberA).toBeDefined()
      assertMinimalMemberPayload(memberA)
      expect(memberA).toMatchObject({
        id: memberAId,
        fullName: `Nguyễn Minh Anh ${tag}`,
        avatarUrl: '/api/portal/files/avatar-clean-1',
        department: { id: deptAId, name: `Ban Học Thuật ${tag}`, code: `dir-a-${tag}` },
        skills: ['TypeScript', 'React'],
        interestAreas: ['Web', 'Thuật toán'],
      })

      const roleNames = memberA.roles.map((r: { role: string }) => r.role)
      expect(roleNames).toContain('MEMBER')
      expect(roleNames).toContain('DEPARTMENT_MANAGER')
      expect(roleNames).not.toContain('BOARD')
      expect(roleNames).not.toContain('TECH_ADMIN')

      // Thành viên LEFT và INACTIVE không xuất hiện trong danh bạ
      const ids = body.items.map((item: { id: string }) => item.id)
      expect(ids).not.toContain(leftMemberId)
      expect(ids).not.toContain(inactiveMemberId)
    })

    it('tìm theo tên không phân biệt hoa thường; không tìm được bằng MSSV hay email', async () => {
      const byName = await app.inject({
        method: 'GET',
        url: `/portal/members?q=${encodeURIComponent(`minh anh ${tag}`)}`,
        cookies: viewerCookies,
      })
      expect(byName.statusCode).toBe(200)
      expect(byName.json().items.map((i: { id: string }) => i.id)).toEqual([memberAId])

      const byStudentId = await app.inject({
        method: 'GET',
        url: `/portal/members?q=${encodeURIComponent(SENSITIVE_STUDENT_ID)}`,
        cookies: viewerCookies,
      })
      expect(byStudentId.statusCode).toBe(200)
      expect(byStudentId.json().total).toBe(0)

      const byEmail = await app.inject({
        method: 'GET',
        url: `/portal/members?q=${encodeURIComponent(SENSITIVE_EMAIL)}`,
        cookies: viewerCookies,
      })
      expect(byEmail.statusCode).toBe(200)
      expect(byEmail.json().total).toBe(0)
    })

    it('lọc theo ban chuyên môn và phân trang đúng', async () => {
      const deptBRes = await app.inject({
        method: 'GET',
        url: `/portal/members?departmentId=${deptBId}`,
        cookies: viewerCookies,
      })
      expect(deptBRes.statusCode).toBe(200)
      const deptBIds = deptBRes.json().items.map((i: { id: string }) => i.id)
      expect(deptBIds).toContain(memberBId)
      expect(deptBIds).not.toContain(memberAId)

      const page1 = await app.inject({
        method: 'GET',
        url: `/portal/members?q=${encodeURIComponent(tag)}&page=1&pageSize=2`,
        cookies: viewerCookies,
      })
      const page2 = await app.inject({
        method: 'GET',
        url: `/portal/members?q=${encodeURIComponent(tag)}&page=2&pageSize=2`,
        cookies: viewerCookies,
      })
      expect(page1.statusCode).toBe(200)
      expect(page2.statusCode).toBe(200)
      expect(page1.json().total).toBe(4)
      expect(page1.json().items).toHaveLength(2)
      expect(page2.json().items).toHaveLength(2)
    })
  })

  describe('GET /portal/members/:id', () => {
    it('chưa đăng nhập nhận 401; tài khoản chờ kích hoạt nhận 403', async () => {
      const unauth = await app.inject({ method: 'GET', url: `/portal/members/${memberAId}` })
      expect(unauth.statusCode).toBe(401)

      const pendingRes = await app.inject({
        method: 'GET',
        url: `/portal/members/${memberAId}`,
        cookies: pendingCookies,
      })
      expect(pendingRes.statusCode).toBe(403)
    })

    it('trả về thông tin tối thiểu của thành viên, không có MSSV, email, SĐT', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/portal/members/${memberAId}`,
        cookies: viewerCookies,
      })

      expect(res.statusCode).toBe(200)
      const body = res.json()
      assertMinimalMemberPayload(body)
      expect(res.body).not.toContain(SENSITIVE_EMAIL)
      expect(res.body).not.toContain(SENSITIVE_CONTACT_EMAIL)
      expect(res.body).not.toContain(SENSITIVE_STUDENT_ID)
      expect(res.body).not.toContain(SENSITIVE_PHONE)
      expect(body.fullName).toBe(`Nguyễn Minh Anh ${tag}`)
    })

    it('trả 404 khi id không tồn tại hoặc thành viên đã rời CLB / ngừng hoạt động', async () => {
      const missing = await app.inject({
        method: 'GET',
        url: '/portal/members/khong-ton-tai',
        cookies: viewerCookies,
      })
      expect(missing.statusCode).toBe(404)

      const leftRes = await app.inject({
        method: 'GET',
        url: `/portal/members/${leftMemberId}`,
        cookies: viewerCookies,
      })
      expect(leftRes.statusCode).toBe(404)

      const inactiveRes = await app.inject({
        method: 'GET',
        url: `/portal/members/${inactiveMemberId}`,
        cookies: viewerCookies,
      })
      expect(inactiveRes.statusCode).toBe(404)
    })
  })
})

import { randomUUID } from 'node:crypto'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { buildApp } from '../../app.js'
import { loadConfig } from '../../config.js'
import { db } from '../../db/client.js'
import { hashPassword } from '../../lib/password.js'
import { createSession, SESSION_COOKIE } from '../auth/session.js'

const config = loadConfig({ NODE_ENV: 'test' })
const app = buildApp(config)
const ORIGIN = config.WEB_URL
const tag = randomUUID().slice(0, 8)
const createdUserIds: string[] = []
const createdEventIds: string[] = []
const createdFileIds: string[] = []
let testDepartmentId: string

async function createUser(
  name: string,
  data: {
    studentId?: string
    departmentId?: string
    email?: string
    contactEmail?: string
    mustChangePassword?: boolean
  } = {},
) {
  const passwordHash = await hashPassword('mat-khau-test-du-15-ky-tu')
  const user = await db.user.create({
    data: {
      username: `${name}-${tag}`,
      email: data.email ?? `${name}-${tag}@test.local`,
      passwordHash,
      fullName: `Thành viên ${name}`,
      studentId: data.studentId ?? `SV-${randomUUID().slice(0, 6)}`,
      faculty: 'Công nghệ thông tin',
      major: 'Kỹ thuật phần mềm',
      cohort: 'K20',
      status: 'ACTIVE',
      mustChangePassword: data.mustChangePassword ?? false,
      ...(data.contactEmail !== undefined ? { contactEmail: data.contactEmail } : {}),
      ...(data.departmentId !== undefined ? { departmentId: data.departmentId } : {}),
    },
  })
  createdUserIds.push(user.id)
  return user
}

async function userSession(userId: string) {
  const { token } = await createSession(userId, { ipAddress: '127.0.0.1', userAgent: 'test-agent' })
  return { [SESSION_COOKIE]: token }
}

async function createStoredFile(
  userId: string,
  data: {
    purpose?: 'AVATAR' | 'CONTENT_IMAGE' | 'DOCUMENT'
    scanStatus?: 'CLEAN' | 'PENDING' | 'REJECTED'
  } = {},
) {
  const file = await db.storedFile.create({
    data: {
      storageKey: `test-files/${randomUUID()}`,
      originalName: 'avatar.png',
      mimeType: 'image/png',
      size: 1024,
      purpose: data.purpose ?? 'AVATAR',
      visibility: 'INTERNAL',
      scanStatus: data.scanStatus ?? 'CLEAN',
      uploadedById: userId,
    },
  })
  createdFileIds.push(file.id)
  return file
}

beforeAll(async () => {
  await app.ready()
  const dept = await db.department.create({
    data: {
      name: `Ban Chuyên môn ${tag}`,
      code: `bcm-${tag}`,
    },
  })
  testDepartmentId = dept.id
})

afterAll(async () => {
  await db.eventRegistration.deleteMany({ where: { userId: { in: createdUserIds } } })
  await db.event.deleteMany({ where: { id: { in: createdEventIds } } })
  await db.storedFile.deleteMany({ where: { id: { in: createdFileIds } } })
  await db.session.deleteMany({ where: { userId: { in: createdUserIds } } })
  await db.userRole.deleteMany({ where: { userId: { in: createdUserIds } } })
  await db.user.deleteMany({ where: { id: { in: createdUserIds } } })
  await db.department.deleteMany({ where: { id: testDepartmentId } })
  await app.close()
  await db.$disconnect()
})

describe('GET /portal/me/profile', () => {
  it('returns 401 when unauthenticated', async () => {
    const res = await app.inject({ method: 'GET', url: '/portal/me/profile' })
    expect(res.statusCode).toBe(401)
    expect(res.json().error).toBe('unauthenticated')
  })

  it('returns 403 when user must change password (pending activation)', async () => {
    const pendingUser = await createUser('must-change-pass', { mustChangePassword: true })
    const cookies = await userSession(pendingUser.id)

    const res = await app.inject({
      method: 'GET',
      url: '/portal/me/profile',
      cookies,
    })

    expect(res.statusCode).toBe(403)
    expect(res.json().error).toBe('forbidden')
  })

  it('returns full profile with MEM-02 fields, roles, and editable fields marked', async () => {
    const user = await createUser('profile-view', {
      departmentId: testDepartmentId,
      contactEmail: 'contact@local.test',
    })
    const cookies = await userSession(user.id)

    const res = await app.inject({
      method: 'GET',
      url: '/portal/me/profile',
      cookies,
    })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body).toMatchObject({
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      email: user.email,
      contactEmail: 'contact@local.test',
      studentId: user.studentId,
      faculty: 'Công nghệ thông tin',
      major: 'Kỹ thuật phần mềm',
      cohort: 'K20',
      departmentId: testDepartmentId,
      department: { id: testDepartmentId },
      memberStatus: 'ACTIVE',
      editableFields: ['avatarFileId', 'contactEmail', 'skills', 'interestAreas'],
    })
    expect(Array.isArray(body.roles)).toBe(true)
    expect(body.roles.length).toBeGreaterThanOrEqual(1)
    expect(body.roles[0].role).toBe('MEMBER')
    expect(typeof body.updatedAt).toBe('string')
  })
})

describe('PATCH /portal/me/profile', () => {
  it('returns 401 when unauthenticated', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/portal/me/profile',
      headers: { origin: ORIGIN },
      payload: { contactEmail: 'test@local.test', updatedAt: new Date().toISOString() },
    })
    expect(res.statusCode).toBe(401)
  })

  it('returns 403 when Origin header is missing (CSRF check)', async () => {
    const user = await createUser('csrf-check')
    const cookies = await userSession(user.id)
    const res = await app.inject({
      method: 'PATCH',
      url: '/portal/me/profile',
      cookies,
      payload: { contactEmail: 'new@local.test', updatedAt: user.updatedAt.toISOString() },
    })
    expect(res.statusCode).toBe(403)
  })

  it('allows member to update contactEmail, skills, interestAreas and keeps account email unchanged', async () => {
    const user = await createUser('profile-edit', { email: `original-${tag}@test.local` })
    const cookies = await userSession(user.id)

    const payload = {
      contactEmail: 'new-contact@local.test',
      skills: ['TypeScript', 'React', 'Fastify'],
      interestAreas: ['Web Development', 'AI'],
      updatedAt: user.updatedAt.toISOString(),
    }

    const res = await app.inject({
      method: 'PATCH',
      url: '/portal/me/profile',
      cookies,
      headers: { origin: ORIGIN },
      payload,
    })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.contactEmail).toBe('new-contact@local.test')
    expect(body.skills).toEqual(['TypeScript', 'React', 'Fastify'])
    expect(body.interestAreas).toEqual(['Web Development', 'AI'])
    expect(body.email).toBe(`original-${tag}@test.local`) // Email tài khoản không đổi

    const inDb = await db.user.findUniqueOrThrow({ where: { id: user.id } })
    expect(inDb.email).toBe(`original-${tag}@test.local`)
    expect(inDb.contactEmail).toBe('new-contact@local.test')
  })

  it('allows member to set avatar using a CLEAN avatar file from D2', async () => {
    const user = await createUser('avatar-edit')
    const cookies = await userSession(user.id)
    const cleanFile = await createStoredFile(user.id, { purpose: 'AVATAR', scanStatus: 'CLEAN' })

    const res = await app.inject({
      method: 'PATCH',
      url: '/portal/me/profile',
      cookies,
      headers: { origin: ORIGIN },
      payload: {
        avatarFileId: cleanFile.id,
        updatedAt: user.updatedAt.toISOString(),
      },
    })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.avatarUrl).toBe(`/api/portal/files/${cleanFile.id}`)

    const inDb = await db.user.findUniqueOrThrow({ where: { id: user.id } })
    expect(inDb.avatarUrl).toBe(`/api/portal/files/${cleanFile.id}`)
  })

  it('does not change avatarUrl if uploaded file scanStatus is PENDING (FLOW-12)', async () => {
    const user = await createUser('avatar-pending')
    await db.user.update({ where: { id: user.id }, data: { avatarUrl: '/api/portal/files/old-avatar' } })
    const refreshed = await db.user.findUniqueOrThrow({ where: { id: user.id } })

    const cookies = await userSession(user.id)
    const pendingFile = await createStoredFile(user.id, { purpose: 'AVATAR', scanStatus: 'PENDING' })

    const res = await app.inject({
      method: 'PATCH',
      url: '/portal/me/profile',
      cookies,
      headers: { origin: ORIGIN },
      payload: {
        avatarFileId: pendingFile.id,
        updatedAt: refreshed.updatedAt.toISOString(),
      },
    })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.avatarUrl).toBe('/api/portal/files/old-avatar')
    expect(body.avatarProcessing).toBe(true)
  })

  it('rejects avatar upload from another user or with REJECTED scan status', async () => {
    const user = await createUser('avatar-security')
    const otherUser = await createUser('avatar-other')
    const cookies = await userSession(user.id)

    // Other user's file
    const otherFile = await createStoredFile(otherUser.id, { purpose: 'AVATAR', scanStatus: 'CLEAN' })
    const resOther = await app.inject({
      method: 'PATCH',
      url: '/portal/me/profile',
      cookies,
      headers: { origin: ORIGIN },
      payload: {
        avatarFileId: otherFile.id,
        updatedAt: user.updatedAt.toISOString(),
      },
    })
    expect(resOther.statusCode).toBe(422)

    // Infected file
    const infectedFile = await createStoredFile(user.id, { purpose: 'AVATAR', scanStatus: 'REJECTED' })
    const resInfected = await app.inject({
      method: 'PATCH',
      url: '/portal/me/profile',
      cookies,
      headers: { origin: ORIGIN },
      payload: {
        avatarFileId: infectedFile.id,
        updatedAt: user.updatedAt.toISOString(),
      },
    })
    expect(resInfected.statusCode).toBe(422)
  })

  it('allows removing avatar with avatarFileId: null', async () => {
    const user = await createUser('avatar-remove')
    await db.user.update({ where: { id: user.id }, data: { avatarUrl: '/api/portal/files/to-remove' } })
    const refreshed = await db.user.findUniqueOrThrow({ where: { id: user.id } })

    const cookies = await userSession(user.id)
    const res = await app.inject({
      method: 'PATCH',
      url: '/portal/me/profile',
      cookies,
      headers: { origin: ORIGIN },
      payload: {
        avatarFileId: null,
        updatedAt: refreshed.updatedAt.toISOString(),
      },
    })

    expect(res.statusCode).toBe(200)
    expect(res.json().avatarUrl).toBeNull()

    const inDb = await db.user.findUniqueOrThrow({ where: { id: user.id } })
    expect(inDb.avatarUrl).toBeNull()
  })

  it('rejects forbidden fields (studentId, departmentId, role, memberStatus, email) with 422 and does not change anything', async () => {
    const user = await createUser('strict-check', {
      studentId: 'STU-123456',
      departmentId: testDepartmentId,
    })
    const cookies = await userSession(user.id)

    const attempts = [
      { studentId: 'STU-HACKED' },
      { departmentId: 'new-dept-id' },
      { role: 'BOARD' },
      { memberStatus: 'LEFT' },
      { email: 'hacked@email.com' },
      { avatarUrl: 'https://evil.com/track.gif' }, // Direct avatarUrl is rejected! Must use avatarFileId
    ]

    for (const attempt of attempts) {
      const res = await app.inject({
        method: 'PATCH',
        url: '/portal/me/profile',
        cookies,
        headers: { origin: ORIGIN },
        payload: {
          ...attempt,
          updatedAt: user.updatedAt.toISOString(),
        },
      })
      expect(res.statusCode).toBe(422)
      expect(res.json().error).toBe('validation')
    }

    // Verify nothing changed in database
    const unchanged = await db.user.findUniqueOrThrow({ where: { id: user.id } })
    expect(unchanged.studentId).toBe('STU-123456')
    expect(unchanged.departmentId).toBe(testDepartmentId)
    expect(unchanged.memberStatus).toBe('ACTIVE')
  })

  it('rejects payload exceeding size limits for skills, interestAreas, or contactEmail', async () => {
    const user = await createUser('limits-check')
    const cookies = await userSession(user.id)

    // > 20 skills
    const tooManySkills = Array.from({ length: 21 }, (_, i) => `Skill ${i}`)
    const resSkills = await app.inject({
      method: 'PATCH',
      url: '/portal/me/profile',
      cookies,
      headers: { origin: ORIGIN },
      payload: { skills: tooManySkills, updatedAt: user.updatedAt.toISOString() },
    })
    expect(resSkills.statusCode).toBe(422)

    // Skill item > 50 chars
    const longSkill = ['a'.repeat(51)]
    const resLongSkill = await app.inject({
      method: 'PATCH',
      url: '/portal/me/profile',
      cookies,
      headers: { origin: ORIGIN },
      payload: { skills: longSkill, updatedAt: user.updatedAt.toISOString() },
    })
    expect(resLongSkill.statusCode).toBe(422)

    // contactEmail > 254 chars
    const longEmail = `${'a'.repeat(250)}@test.com`
    const resEmail = await app.inject({
      method: 'PATCH',
      url: '/portal/me/profile',
      cookies,
      headers: { origin: ORIGIN },
      payload: { contactEmail: longEmail, updatedAt: user.updatedAt.toISOString() },
    })
    expect(resEmail.statusCode).toBe(422)
  })

  it('detects concurrent edit conflict (409) when updatedAt does not match', async () => {
    const user = await createUser('conflict-check')
    const cookies = await userSession(user.id)

    // Stale timestamp (simulating another tab already updated)
    const staleUpdatedAt = new Date(Date.now() - 60_000).toISOString()

    const res = await app.inject({
      method: 'PATCH',
      url: '/portal/me/profile',
      cookies,
      headers: { origin: ORIGIN },
      payload: {
        contactEmail: 'conflict@test.local',
        updatedAt: staleUpdatedAt,
      },
    })

    expect(res.statusCode).toBe(409)
    expect(res.json().error).toBe('conflict')
  })
})

describe('GET /portal/me/roles', () => {
  it('returns 401 when unauthenticated', async () => {
    const res = await app.inject({ method: 'GET', url: '/portal/me/roles' })
    expect(res.statusCode).toBe(401)
  })

  it('member only sees base MEMBER role', async () => {
    const member = await createUser('member-roles')
    const cookies = await userSession(member.id)

    const res = await app.inject({
      method: 'GET',
      url: '/portal/me/roles',
      cookies,
    })

    expect(res.statusCode).toBe(200)
    const roles = res.json()
    expect(roles).toHaveLength(1)
    expect(roles[0]).toMatchObject({
      role: 'MEMBER',
      status: 'ACTIVE',
      isBaseRole: true,
      expiresAt: null,
    })
  })

  it('marks expired roles as EXPIRED even if database status is still ACTIVE', async () => {
    const user = await createUser('expired-role-user', { departmentId: testDepartmentId })

    // Past expiresAt
    await db.userRole.create({
      data: {
        userId: user.id,
        role: 'DEPARTMENT_MANAGER',
        departmentId: testDepartmentId,
        status: 'ACTIVE',
        startsAt: new Date(Date.now() - 100_000),
        expiresAt: new Date(Date.now() - 10_000), // đã hết hạn
        reason: 'Vai trò thử nghiệm',
      },
    })

    const cookies = await userSession(user.id)
    const res = await app.inject({
      method: 'GET',
      url: '/portal/me/roles',
      cookies,
    })

    expect(res.statusCode).toBe(200)
    const roles = res.json()
    const mgrRole = roles.find((r: { role: string }) => r.role === 'DEPARTMENT_MANAGER')
    expect(mgrRole).toBeDefined()
    expect(mgrRole.status).toBe('EXPIRED') // Phải tính thành EXPIRED trên server
  })

  it('manager sees base MEMBER role and DEPARTMENT_MANAGER role, without other users roles or reason/grantor', async () => {
    const manager = await createUser('manager-roles', { departmentId: testDepartmentId })
    const otherUser = await createUser('other-roles')

    // Role for manager
    await db.userRole.create({
      data: {
        userId: manager.id,
        role: 'DEPARTMENT_MANAGER',
        departmentId: testDepartmentId,
        status: 'ACTIVE',
        startsAt: new Date(Date.now() - 1000),
        reason: 'Lý do bí mật không được trả về',
        grantedById: otherUser.id,
      },
    })

    // Role for other user
    await db.userRole.create({
      data: {
        userId: otherUser.id,
        role: 'BOARD',
        status: 'ACTIVE',
        startsAt: new Date(Date.now() - 1000),
        reason: 'Quyền của người khác',
      },
    })

    const cookies = await userSession(manager.id)
    const res = await app.inject({
      method: 'GET',
      url: '/portal/me/roles',
      cookies,
    })

    expect(res.statusCode).toBe(200)
    const roles = res.json()
    expect(roles).toHaveLength(2)

    // Roles should include MEMBER and DEPARTMENT_MANAGER
    const rolesList = roles.map((r: { role: string }) => r.role)
    expect(rolesList).toContain('MEMBER')
    expect(rolesList).toContain('DEPARTMENT_MANAGER')

    // Must NOT contain otherUser's BOARD role
    expect(rolesList).not.toContain('BOARD')

    // Must NOT contain reason or grantedById (T3 requirement)
    for (const r of roles) {
      expect(r).not.toHaveProperty('reason')
      expect(r).not.toHaveProperty('grantedById')
      expect(r).not.toHaveProperty('grantedBy')
    }
  })
})

describe('GET /portal/me/activity', () => {
  it('returns 401 when unauthenticated', async () => {
    const res = await app.inject({ method: 'GET', url: '/portal/me/activity' })
    expect(res.statusCode).toBe(401)
  })

  it('returns user event registrations with attendance and does not leak other users registrations', async () => {
    const user1 = await createUser('activity-user-1')
    const user2 = await createUser('activity-user-2')

    // Create events
    const event1 = await db.event.create({
      data: {
        title: `Workshop React ${tag}`,
        slug: `workshop-react-${tag}`,
        description: 'Mô tả',
        eventType: 'Workshop',
        location: 'Phòng 401',
        startAt: new Date(Date.now() + 86400000),
        endAt: new Date(Date.now() + 90000000),
        createdById: user1.id,
        departmentId: testDepartmentId,
      },
    })
    createdEventIds.push(event1.id)

    const event2 = await db.event.create({
      data: {
        title: `Seminar AI ${tag}`,
        slug: `seminar-ai-${tag}`,
        description: 'Mô tả',
        eventType: 'Seminar',
        onlineUrl: 'https://zoom.us/j/123456789',
        startAt: new Date(Date.now() + 186400000),
        endAt: new Date(Date.now() + 190000000),
        createdById: user1.id,
        departmentId: testDepartmentId,
      },
    })
    createdEventIds.push(event2.id)

    // User 1 registered for event 1 (PRESENT)
    const reg1 = await db.eventRegistration.create({
      data: {
        eventId: event1.id,
        userId: user1.id,
        registrationCode: `REG1-${randomUUID().slice(0, 8)}`,
        status: 'REGISTERED',
        attendanceStatus: 'PRESENT',
      },
    })

    // User 2 registered for event 2
    await db.eventRegistration.create({
      data: {
        eventId: event2.id,
        userId: user2.id,
        registrationCode: `REG2-${randomUUID().slice(0, 8)}`,
        status: 'REGISTERED',
        attendanceStatus: 'ABSENT',
      },
    })

    const cookies = await userSession(user1.id)
    const res = await app.inject({
      method: 'GET',
      url: '/portal/me/activity?page=1&pageSize=10',
      cookies,
    })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.total).toBe(1)
    expect(body.items).toHaveLength(1)
    expect(body.items[0]).toMatchObject({
      id: reg1.id,
      registrationCode: reg1.registrationCode,
      status: 'REGISTERED',
      attendanceStatus: 'PRESENT',
      event: {
        id: event1.id,
        title: `Workshop React ${tag}`,
        slug: `workshop-react-${tag}`,
        location: 'Phòng 401',
      },
    })

    // User 1 cannot see User 2's registration
    const codes = body.items.map((i: { registrationCode: string }) => i.registrationCode)
    expect(codes).not.toContain(reg1.registrationCode.replace('REG1', 'REG2'))
  })
})

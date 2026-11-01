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
let testDepartmentId: string

async function createUser(
  name: string,
  data: {
    studentId?: string
    departmentId?: string
    email?: string
    contactEmail?: string
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
      mustChangePassword: false,
      ...(data.contactEmail !== undefined ? { contactEmail: data.contactEmail } : {}),
      ...(data.departmentId !== undefined ? { departmentId: data.departmentId } : {}),
    },
  })
  createdUserIds.push(user.id)
  return user
}

async function userSession(userId: string) {
  const token = await createSession(userId, { ipAddress: '127.0.0.1', userAgent: 'test-agent' })
  return { [SESSION_COOKIE]: token }
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

  it('returns full profile with editable fields marked', async () => {
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
      editableFields: ['avatarUrl', 'contactEmail', 'skills', 'interestAreas'],
    })
    expect(typeof body.updatedAt).toBe('string')
  })
})

describe('PATCH /portal/me/profile', () => {
  it('returns 401 when unauthenticated', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/portal/me/profile',
      headers: { origin: ORIGIN },
      payload: { contactEmail: 'test@local.test' },
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
      payload: { contactEmail: 'new@local.test' },
    })
    expect(res.statusCode).toBe(403)
  })

  it('allows member to update avatarUrl, contactEmail, skills, interestAreas and keeps account email unchanged', async () => {
    const user = await createUser('profile-edit', { email: `original-${tag}@test.local` })
    const cookies = await userSession(user.id)

    const payload = {
      avatarUrl: 'https://cdn.example.com/avatars/clean.jpg',
      contactEmail: 'new-contact@local.test',
      skills: ['TypeScript', 'React', 'Fastify'],
      interestAreas: ['Web Development', 'AI'],
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
    expect(body.avatarUrl).toBe('https://cdn.example.com/avatars/clean.jpg')
    expect(body.contactEmail).toBe('new-contact@local.test')
    expect(body.skills).toEqual(['TypeScript', 'React', 'Fastify'])
    expect(body.interestAreas).toEqual(['Web Development', 'AI'])
    expect(body.email).toBe(`original-${tag}@test.local`) // Email tài khoản không đổi

    const inDb = await db.user.findUniqueOrThrow({ where: { id: user.id } })
    expect(inDb.email).toBe(`original-${tag}@test.local`)
    expect(inDb.contactEmail).toBe('new-contact@local.test')
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
    ]

    for (const attempt of attempts) {
      const res = await app.inject({
        method: 'PATCH',
        url: '/portal/me/profile',
        cookies,
        headers: { origin: ORIGIN },
        payload: attempt,
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

  it('returns activity page structure', async () => {
    const user = await createUser('activity-user')
    const cookies = await userSession(user.id)

    const res = await app.inject({
      method: 'GET',
      url: '/portal/me/activity',
      cookies,
    })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body).toMatchObject({
      items: [],
      total: 0,
      page: 1,
      pageSize: 20,
    })
  })
})

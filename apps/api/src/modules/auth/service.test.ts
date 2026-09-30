import { randomUUID } from 'node:crypto'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { db } from '../../db/client.js'
import { loadAuthUser } from './service.js'

// Test với Postgres thật (CI chạy db:deploy trước). Dữ liệu có hậu tố ngẫu nhiên và được dọn ở afterAll.
const tag = randomUUID().slice(0, 8)
const DAY = 24 * 60 * 60 * 1000
const now = new Date()
const createdUserIds: string[] = []
const createdDepartmentIds: string[] = []

async function createDepartment(code: string) {
  const department = await db.department.create({ data: { name: `Ban ${code}`, code: `${code}-${tag}` } })
  createdDepartmentIds.push(department.id)
  return department
}

async function createUser(name: string, data: { status?: 'ACTIVE' | 'LOCKED' | 'INACTIVE'; departmentId?: string } = {}) {
  const user = await db.user.create({
    data: {
      username: `${name}-${tag}`,
      email: `${name}-${tag}@test.local`,
      passwordHash: 'khong-dung-trong-test-nay',
      fullName: name,
      status: data.status ?? 'ACTIVE',
      departmentId: data.departmentId ?? null,
    },
  })
  createdUserIds.push(user.id)
  return user
}

let deptA: { id: string }
let deptB: { id: string }

beforeAll(async () => {
  deptA = await createDepartment('A')
  deptB = await createDepartment('B')
})

afterAll(async () => {
  await db.userRole.deleteMany({ where: { userId: { in: createdUserIds } } })
  await db.user.deleteMany({ where: { id: { in: createdUserIds } } })
  await db.department.deleteMany({ where: { id: { in: createdDepartmentIds } } })
  await db.$disconnect()
})

describe('loadAuthUser', () => {
  it('returns a plain MEMBER with no stored roles', async () => {
    const user = await createUser('member', { departmentId: deptA.id })
    expect(await loadAuthUser(user.id, now)).toEqual({ id: user.id, departmentId: deptA.id, roles: [] })
  })

  it('keeps only ACTIVE, started and not-expired rows from user_roles', async () => {
    const user = await createUser('manager', { departmentId: deptA.id })
    const base = { userId: user.id, reason: 'test', startsAt: new Date(now.getTime() - DAY) }
    await db.userRole.createMany({
      data: [
        { ...base, role: 'DEPARTMENT_MANAGER', departmentId: deptA.id, status: 'ACTIVE' },
        { ...base, role: 'DEPARTMENT_MANAGER', departmentId: deptB.id, status: 'REVOKED' },
        { ...base, role: 'BOARD', status: 'PENDING' }, // chưa cài 2 lớp (RP-13)
        { ...base, role: 'TECH_ADMIN', status: 'ACTIVE', expiresAt: new Date(now.getTime() - 1000) }, // đã hết hạn
        { ...base, role: 'DEPARTMENT_MANAGER', departmentId: deptB.id, status: 'ACTIVE', startsAt: new Date(now.getTime() + DAY) }, // chưa tới ngày
      ],
    })

    expect(await loadAuthUser(user.id, now)).toEqual({
      id: user.id,
      departmentId: deptA.id,
      roles: [{ role: 'DEPARTMENT_MANAGER', departmentId: deptA.id }],
    })
  })

  it('returns every active department a manager holds', async () => {
    const user = await createUser('manager2')
    const base = { userId: user.id, reason: 'test', startsAt: new Date(now.getTime() - DAY), status: 'ACTIVE' as const }
    await db.userRole.createMany({
      data: [
        { ...base, role: 'DEPARTMENT_MANAGER', departmentId: deptA.id },
        { ...base, role: 'DEPARTMENT_MANAGER', departmentId: deptB.id, expiresAt: new Date(now.getTime() + DAY) },
      ],
    })

    const authUser = await loadAuthUser(user.id, now)
    expect(authUser?.roles).toHaveLength(2)
    expect(authUser?.roles.map((grant) => grant.departmentId).sort()).toEqual([deptA.id, deptB.id].sort())
  })

  it('rejects locked or inactive accounts and unknown ids', async () => {
    const locked = await createUser('locked', { status: 'LOCKED' })
    const inactive = await createUser('inactive', { status: 'INACTIVE' })
    expect(await loadAuthUser(locked.id, now)).toBeNull()
    expect(await loadAuthUser(inactive.id, now)).toBeNull()
    expect(await loadAuthUser('khong-ton-tai', now)).toBeNull()
  })
})

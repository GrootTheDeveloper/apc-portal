import { randomUUID } from 'node:crypto'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { buildApp } from '../../app.js'
import { loadConfig } from '../../config.js'
import { db } from '../../db/client.js'

const config = loadConfig({ NODE_ENV: 'test' })
const app = buildApp(config)
// Mã ban ngẫu nhiên để chạy song song / chạy lại không đụng nhau.
const run = randomUUID().slice(0, 8)

let activeDeptId: string
let archivedDeptId: string

beforeAll(async () => {
  await app.ready()

  // Đảm bảo SiteSetting singleton tồn tại (DB test có thể chưa seed)
  await db.siteSetting.upsert({
    where: { id: 'singleton' },
    update: {},
    create: {
      id: 'singleton',
      info: {
        name: 'APC Test',
        description: 'Mô tả test',
        mission: 'Sứ mệnh test',
        contactEmail: 'test@umt.edu.vn',
        fanpage: 'https://www.facebook.com/apc.umt',
        officialLinks: [{ label: 'UMTOJ', url: 'https://sot.umtoj.edu.vn' }],
      },
      termEndsAt: new Date('2027-06-01T00:00:00Z'),
    },
  })

  const activeDept = await db.department.create({
    data: { name: 'Ban Test Active', code: `test-active-${run}`, contactPoint: 'Email ban: test@example.com', order: 99 },
  })
  activeDeptId = activeDept.id

  const archivedDept = await db.department.create({
    data: { name: 'Ban Test Archived', code: `test-arch-${run}`, status: 'ARCHIVED', order: 100 },
  })
  archivedDeptId = archivedDept.id
})

afterAll(async () => {
  await db.department.deleteMany({ where: { id: { in: [activeDeptId, archivedDeptId] } } })
  await app.close()
})

describe('GET /public/about', () => {
  it('trả thông tin CLB và ban ACTIVE, chỉ các trường công khai (không termEndsAt, không thông tin cá nhân)', async () => {
    const res = await app.inject({ method: 'GET', url: '/public/about' })
    expect(res.statusCode).toBe(200)

    const body = res.json()
    expect(Object.keys(body).sort()).toEqual(
      ['contactEmail', 'departments', 'description', 'fanpage', 'mission', 'name', 'officialLinks'].sort(),
    )
    const dept = body.departments.find((d: { id: string }) => d.id === activeDeptId)
    // Ban chỉ có đầu mối liên hệ chung, không có trường thành viên (BR-20)
    expect(dept).toEqual({
      id: activeDeptId,
      name: 'Ban Test Active',
      description: '',
      contact: 'Email ban: test@example.com',
      order: 99,
    })
    const orders = body.departments.map((d: { order: number }) => d.order)
    expect(orders).toEqual([...orders].sort((a, b) => a - b))
  })

  it('ban ARCHIVED bị loại khỏi danh sách departments', async () => {
    const res = await app.inject({ method: 'GET', url: '/public/about' })
    expect(res.statusCode).toBe(200)
    expect(res.json().departments.some((d: { id: string }) => d.id === archivedDeptId)).toBe(false)
  })

  it('chưa có SiteSetting thì 404', async () => {
    const saved = await db.siteSetting.findUniqueOrThrow({ where: { id: 'singleton' } })
    await db.siteSetting.delete({ where: { id: 'singleton' } })
    try {
      const res = await app.inject({ method: 'GET', url: '/public/about' })
      expect(res.statusCode).toBe(404)
      expect(res.json().error).toBe('not_found')
    } finally {
      await db.siteSetting.create({ data: { id: saved.id, info: saved.info ?? {}, termEndsAt: saved.termEndsAt } })
    }
  })
})

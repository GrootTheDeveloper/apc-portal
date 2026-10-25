import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { buildApp } from '../../app.js'
import { loadConfig } from '../../config.js'
import { db } from '../../db/client.js'

const config = loadConfig({ NODE_ENV: 'test' })
const app = buildApp(config)

// Lưu id để dọn sau test
let activeDeptId: string
let archivedDeptId: string

beforeAll(async () => {
  await app.ready()

  // Đảm bảo SiteSetting singleton tồn tại
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

  // Tạo một ban ACTIVE
  const activeDept = await db.department.create({
    data: { name: 'Ban Test Active', code: 'TEST-ACTIVE', contactPoint: 'test@apc.vn', order: 99 },
  })
  activeDeptId = activeDept.id

  // Tạo một ban ARCHIVED — phải bị loại khỏi kết quả
  const archivedDept = await db.department.create({
    data: { name: 'Ban Test Archived', code: 'TEST-ARCH', status: 'ARCHIVED', order: 100 },
  })
  archivedDeptId = archivedDept.id
})

afterAll(async () => {
  await db.department.deleteMany({ where: { id: { in: [activeDeptId, archivedDeptId] } } })
  await app.close()
})

describe('GET /public/about', () => {
  it('trả thông tin CLB và chỉ ban ACTIVE, không có termEndsAt', async () => {
    const res = await app.inject({ method: 'GET', url: '/public/about' })
    expect(res.statusCode).toBe(200)

    const body = res.json<Record<string, unknown>>()
    // Có các trường thông tin CLB
    expect(body).toHaveProperty('name')
    expect(body).toHaveProperty('description')
    expect(body).toHaveProperty('mission')
    expect(body).toHaveProperty('contactEmail')
    expect(body).toHaveProperty('fanpage')
    expect(body).toHaveProperty('officialLinks')
    // Có departments
    expect(Array.isArray(body['departments'])).toBe(true)
    // Ban ACTIVE test xuất hiện
    const depts = body['departments'] as { id: string }[]
    expect(depts.some((d) => d.id === activeDeptId)).toBe(true)
    // termEndsAt KHÔNG được trả ra (QĐ-6)
    expect(body).not.toHaveProperty('termEndsAt')
  })

  it('ban ARCHIVED bị loại khỏi danh sách departments', async () => {
    const res = await app.inject({ method: 'GET', url: '/public/about' })
    expect(res.statusCode).toBe(200)

    const body = res.json<Record<string, unknown>>()
    const depts = body['departments'] as { id: string }[]
    expect(depts.some((d) => d.id === archivedDeptId)).toBe(false)
  })
})

import { randomUUID } from 'node:crypto'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { buildApp } from '../../app.js'
import { loadConfig } from '../../config.js'
import { db } from '../../db/client.js'
import { hashPassword } from '../../lib/password.js'
import { SESSION_COOKIE } from '../auth/session.js'

const config = loadConfig({ NODE_ENV: 'test' })
const app = buildApp(config)
const origin = { origin: config.WEB_URL }
const PASSWORD = 'mat-khau-test-members-t5'
const tag = randomUUID().slice(0, 8)
const userIds: string[] = []
const departmentIds: string[] = []
let passwordHash: string
let ip = 0
const tokens: Record<'board' | 'managerA' | 'managerB' | 'memberA' | 'memberB', string> = {
  board: '',
  managerA: '',
  managerB: '',
  memberA: '',
  memberB: '',
}

async function createUser(
  name: string,
  role?: 'BOARD' | 'TECH_ADMIN' | 'DEPARTMENT_MANAGER',
  departmentId?: string,
  studentId?: string,
) {
  const user = await db.user.create({
    data: {
      username: `${name}-${tag}`,
      email: `${name}-${tag}@test.local`,
      passwordHash,
      fullName: `Thành viên ${name}`,
      studentId: studentId ?? `SV-${name}-${tag}`,
      status: 'ACTIVE',
      mustChangePassword: false,
      departmentId: departmentId ?? null,
      memberStatus: 'ACTIVE',
    },
  })
  userIds.push(user.id)
  if (role) {
    await db.userRole.create({
      data: {
        userId: user.id,
        role,
        departmentId: role === 'DEPARTMENT_MANAGER' ? (departmentId ?? null) : null,
        status: 'ACTIVE',
        startsAt: new Date(Date.now() - 1000),
        reason: 'test gán quyền',
      },
    })
  }
  return user
}

async function login(username: string, password = PASSWORD) {
  const response = await app.inject({
    method: 'POST',
    url: '/auth/login',
    payload: { username, password },
    headers: origin,
    remoteAddress: `10.5.1.${++ip % 250}`,
  })
  return { status: response.statusCode, token: response.cookies.find((c) => c.name === SESSION_COOKIE)?.value ?? '' }
}

async function call(method: 'GET' | 'POST' | 'PATCH', url: string, token: string, payload?: Record<string, unknown>) {
  return app.inject({
    method,
    url,
    cookies: token ? { [SESSION_COOKIE]: token } : {},
    headers: origin,
    ...(payload ? { payload } : {}),
  })
}

let deptA: { id: string }
let deptB: { id: string }
let deptArchived: { id: string }
let memberAUser: { id: string; username: string }
let memberBUser: { id: string; username: string }
let managerAUser: { id: string; username: string }
let managerBUser: { id: string; username: string }
let boardUser: { id: string; username: string }

beforeAll(async () => {
  passwordHash = await hashPassword(PASSWORD)
  await app.ready()

  deptA = await db.department.create({ data: { name: `Ban A-${tag}`, code: `a-${tag}` } })
  deptB = await db.department.create({ data: { name: `Ban B-${tag}`, code: `b-${tag}` } })
  deptArchived = await db.department.create({ data: { name: `Ban C Cu-${tag}`, code: `c-old-${tag}`, status: 'ARCHIVED' } })
  departmentIds.push(deptA.id, deptB.id, deptArchived.id)

  boardUser = await createUser('board', 'BOARD')
  managerAUser = await createUser('mng-a', 'DEPARTMENT_MANAGER', deptA.id)
  managerBUser = await createUser('mng-b', 'DEPARTMENT_MANAGER', deptB.id)
  memberAUser = await createUser('mem-a', undefined, deptA.id)
  memberBUser = await createUser('mem-b', undefined, deptB.id)

  tokens.board = (await login(boardUser.username)).token
  tokens.managerA = (await login(managerAUser.username)).token
  tokens.managerB = (await login(managerBUser.username)).token
  tokens.memberA = (await login(memberAUser.username)).token
  tokens.memberB = (await login(memberBUser.username)).token
})

afterAll(async () => {
  const created = await db.user.findMany({ where: { username: { endsWith: `-${tag}` } }, select: { id: true } })
  const ids = created.map((u) => u.id)
  await db.auditLog.deleteMany({ where: { actorId: { in: ids } } })
  await db.auditLog.deleteMany({ where: { targetId: { in: ids } } })
  await db.session.deleteMany({ where: { userId: { in: ids } } })
  await db.userRole.deleteMany({ where: { userId: { in: ids } } })
  await db.user.deleteMany({ where: { id: { in: ids } } })
  await db.department.deleteMany({ where: { id: { in: departmentIds } } })
  await app.close()
})

describe('T5: Quản lý thành viên (FLOW-13, RP-08, QĐ-3, QĐ-8)', () => {
  describe('GET /admin/members', () => {
    it('từ chối khi chưa đăng nhập (401) hoặc là thành viên thường (403)', async () => {
      const unauth = await call('GET', '/admin/members', '')
      expect(unauth.statusCode).toBe(401)

      const forbidden = await call('GET', '/admin/members', tokens.memberA)
      expect(forbidden.statusCode).toBe(403)
    })

    it('BOARD xem được thành viên ở tất cả các ban', async () => {
      const res = await call('GET', '/admin/members', tokens.board)
      expect(res.statusCode).toBe(200)
      const data = res.json()
      expect(data).toHaveProperty('items')
      expect(data).toHaveProperty('total')
      const ids = data.items.map((i: any) => i.id)
      expect(ids).toContain(memberAUser.id)
      expect(ids).toContain(memberBUser.id)
    })

    it('manager.a chỉ thấy thành viên Ban A, không thấy thành viên Ban B', async () => {
      const res = await call('GET', '/admin/members', tokens.managerA)
      expect(res.statusCode).toBe(200)
      const data = res.json()
      const ids = data.items.map((i: any) => i.id)
      expect(ids).toContain(memberAUser.id)
      expect(ids).not.toContain(memberBUser.id)
    })

    it('tìm kiếm và lọc theo trạng thái hoạt động', async () => {
      const searchRes = await call('GET', `/admin/members?q=mem-a`, tokens.board)
      expect(searchRes.statusCode).toBe(200)
      const data = searchRes.json()
      expect(data.items.some((i: any) => i.id === memberAUser.id)).toBe(true)
      expect(data.items.some((i: any) => i.id === memberBUser.id)).toBe(false)
    })
  })

  describe('GET /admin/members/:id', () => {
    it('BOARD mở chi tiết bất kỳ thành viên nào đều được 200', async () => {
      const res = await call('GET', `/admin/members/${memberAUser.id}`, tokens.board)
      expect(res.statusCode).toBe(200)
      const json = res.json()
      expect(json).toHaveProperty('profile')
      expect(json).toHaveProperty('organization')
      expect(json).toHaveProperty('activity')
      expect(json.profile.email).toBeDefined()
    })

    it('manager.a mở thành viên Ban A nhận 200', async () => {
      const res = await call('GET', `/admin/members/${memberAUser.id}`, tokens.managerA)
      expect(res.statusCode).toBe(200)
    })

    it('manager.a mở thành viên Ban B nhận 404 (bảo mật phạm vi ban, docs/02 §12)', async () => {
      const res = await call('GET', `/admin/members/${memberBUser.id}`, tokens.managerA)
      expect(res.statusCode).toBe(404)
    })
  })

  describe('PATCH /admin/members/:id', () => {
    it('manager.a gọi PATCH nhận 403', async () => {
      const res = await call('PATCH', `/admin/members/${memberAUser.id}`, tokens.managerA, {
        studentId: 'NEW-ID',
        reason: 'Sửa thử',
      })
      expect(res.statusCode).toBe(403)
    })

    it('yêu cầu lý do và ít nhất một trường thay đổi (422)', async () => {
      const missingReason = await call('PATCH', `/admin/members/${memberAUser.id}`, tokens.board, {
        studentId: 'NEW-ID',
      })
      expect(missingReason.statusCode).toBe(422)

      const noFields = await call('PATCH', `/admin/members/${memberAUser.id}`, tokens.board, {
        reason: 'Chỉ có lý do',
      })
      expect(noFields.statusCode).toBe(422)
    })

    it('QĐ-8: đổi email trùng email của thành viên khác trả 409', async () => {
      const userB = await db.user.findUnique({ where: { id: memberBUser.id }, select: { email: true } })
      const res = await call('PATCH', `/admin/members/${memberAUser.id}`, tokens.board, {
        email: userB?.email,
        reason: 'Đổi trùng email',
      })
      expect(res.statusCode).toBe(409)
    })

    it('đổi studentId trùng sinh viên khác trả 409', async () => {
      const userB = await db.user.findUnique({ where: { id: memberBUser.id }, select: { studentId: true } })
      const res = await call('PATCH', `/admin/members/${memberAUser.id}`, tokens.board, {
        studentId: userB?.studentId,
        reason: 'Đổi trùng MSSV',
      })
      expect(res.statusCode).toBe(409)
    })

    it('đổi ban: không chuyển vào ban ARCHIVED (409)', async () => {
      const res = await call('PATCH', `/admin/members/${memberAUser.id}`, tokens.board, {
        departmentId: deptArchived.id,
        reason: 'Chuyển vào ban cũ đã lưu trữ',
      })
      expect(res.statusCode).toBe(409)
    })

    it('RP-08: chuyển manager.a sang Ban B thì vai trò quản lý Ban A chuyển REVOKED trong cùng tx', async () => {
      const target = await createUser('mng-test-transfer', 'DEPARTMENT_MANAGER', deptA.id)
      const res = await call('PATCH', `/admin/members/${target.id}`, tokens.board, {
        departmentId: deptB.id,
        reason: 'Điều động sang ban B',
      })
      expect(res.statusCode).toBe(200)

      const updatedUser = await db.user.findUnique({ where: { id: target.id }, select: { departmentId: true } })
      expect(updatedUser?.departmentId).toBe(deptB.id)

      const oldRole = await db.userRole.findFirst({
        where: { userId: target.id, role: 'DEPARTMENT_MANAGER', departmentId: deptA.id },
      })
      expect(oldRole?.status).toBe('REVOKED')
      expect(oldRole?.revokeReason).toContain('Đổi ban')

      const audit = await db.auditLog.findFirst({
        where: { targetId: target.id, action: 'member.change_department' },
      })
      expect(audit).toBeTruthy()
      expect(audit?.reason).toBe('Điều động sang ban B')
    })

    it('đổi trạng thái hợp lệ: ACTIVE ↔ PAUSED; tài khoản vẫn đăng nhập được', async () => {
      const target = await createUser('state-test', undefined, deptA.id)
      const tokenTarget = (await login(target.username)).token

      // Chuyển sang PAUSED
      const pauseRes = await call('PATCH', `/admin/members/${target.id}`, tokens.board, {
        memberStatus: 'PAUSED',
        reason: 'Nghỉ tạm thời 1 học kỳ',
      })
      expect(pauseRes.statusCode).toBe(200)

      const pausedUser = await db.user.findUnique({ where: { id: target.id }, select: { memberStatus: true, status: true } })
      expect(pausedUser?.memberStatus).toBe('PAUSED')
      expect(pausedUser?.status).toBe('ACTIVE')

      // Tài khoản vẫn đăng nhập được
      const checkAuth = await call('GET', '/auth/me', tokenTarget)
      expect(checkAuth.statusCode).toBe(200)

      // Chuyển lại sang ACTIVE
      const activeRes = await call('PATCH', `/admin/members/${target.id}`, tokens.board, {
        memberStatus: 'ACTIVE',
        reason: 'Quay lại hoạt động',
      })
      expect(activeRes.statusCode).toBe(200)
    })

    it('bước chuyển sai (LEFT → ACTIVE) trả 409', async () => {
      const target = await createUser('left-state-test', undefined, deptA.id)
      // Chuyển sang LEFT hợp lệ
      const leftRes = await call('PATCH', `/admin/members/${target.id}`, tokens.board, {
        memberStatus: 'LEFT',
        reason: 'Rời câu lạc bộ',
      })
      expect(leftRes.statusCode).toBe(200)

      // Cố tình chuyển LEFT -> ACTIVE
      const invalidRes = await call('PATCH', `/admin/members/${target.id}`, tokens.board, {
        memberStatus: 'ACTIVE',
        reason: 'Cố kích hoạt lại',
      })
      expect(invalidRes.statusCode).toBe(409)
    })

    it('QĐ-3, RP-09: chuyển Ngừng tham gia (LEFT) → tài khoản INACTIVE, phiên bị thu hồi (401), vai trò REVOKED', async () => {
      const target = await createUser('mng-left-test', 'DEPARTMENT_MANAGER', deptB.id)
      const targetToken = (await login(target.username)).token

      // Trước khi chuyển: gọi /auth/me thành công
      const beforeAuth = await call('GET', '/auth/me', targetToken)
      expect(beforeAuth.statusCode).toBe(200)

      // Chuyển sang LEFT
      const res = await call('PATCH', `/admin/members/${target.id}`, tokens.board, {
        memberStatus: 'LEFT',
        reason: 'Tốt nghiệp ra trường',
      })
      expect(res.statusCode).toBe(200)

      // Kiểm tra user: memberStatus = LEFT, status = INACTIVE, deactivatedAt có giá trị
      const userAfter = await db.user.findUnique({
        where: { id: target.id },
        select: { memberStatus: true, status: true, deactivatedAt: true },
      })
      expect(userAfter?.memberStatus).toBe('LEFT')
      expect(userAfter?.status).toBe('INACTIVE')
      expect(userAfter?.deactivatedAt).not.toBeNull()

      // Phiên đang mở bị 401
      const afterAuth = await call('GET', '/auth/me', targetToken)
      expect(afterAuth.statusCode).toBe(401)

      // Vai trò quản lý chuyển REVOKED
      const roleAfter = await db.userRole.findFirst({
        where: { userId: target.id, role: 'DEPARTMENT_MANAGER' },
      })
      expect(roleAfter?.status).toBe('REVOKED')

      // Audit log ACCOUNT_DEACTIVATE và MEMBER_CHANGE_STATUS được ghi
      const statusAudit = await db.auditLog.findFirst({
        where: { targetId: target.id, action: 'member.change_status' },
      })
      expect(statusAudit).toBeTruthy()
      expect(statusAudit?.reason).toBe('Tốt nghiệp ra trường')

      const deactivateAudit = await db.auditLog.findFirst({
        where: { targetId: target.id, action: 'account.deactivate' },
      })
      expect(deactivateAudit).toBeTruthy()
    })
  })
})

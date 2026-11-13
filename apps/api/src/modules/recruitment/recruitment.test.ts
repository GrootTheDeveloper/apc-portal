import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { buildApp } from '../../app.js'
import { loadConfig } from '../../config.js'
import { db } from '../../db/client.js'
import { AUDIT_ACTIONS } from '../audit/service.js'
import { createSession, SESSION_COOKIE } from '../auth/session.js'
import { closeExpiredRecruitmentRounds } from './service.js'
import { APPLICATION_STATUS_LABELS, EMAIL_TEMPLATES } from '../email/templates.js'
import { publicCode } from '../../lib/ids.js'


let ipCounter = 200
const nextIp = () => `10.8.${Math.floor(++ipCounter / 250)}.${ipCounter % 250}`
const config = loadConfig({ NODE_ENV: 'test' })
const app = buildApp(config)
const tag = randomUUID().slice(0, 8)
const ORIGIN = config.WEB_URL

let boardToken: string
let boardUserId: string
let managerAToken: string
let memberToken: string // Đã dùng cho các test 403
let deptAId: string
let deptBId: string


const createdRoundIds: string[] = []
const createdUserIds: string[] = []
const createdDeptIds: string[] = []

beforeAll(async () => {
  await app.ready()

  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000)

  // 1. Tạo 2 ban test
  const deptA = await db.department.create({
    data: { name: `Ban Kỹ thuật ${tag}`, code: `DEV-${tag}` },
  })
  const deptB = await db.department.create({
    data: { name: `Ban AI ${tag}`, code: `AI-${tag}` },
  })
  deptAId = deptA.id
  deptBId = deptB.id
  createdDeptIds.push(deptA.id, deptB.id)

  // 2. Tạo User BOARD
  const boardUser = await db.user.create({
    data: {
      username: `board-${tag}`,
      email: `board-${tag}@test.local`,
      fullName: 'Board Test',
      passwordHash: 'dummy',
      status: 'ACTIVE',
      mustChangePassword: false,
      roles: {
        create: {
          role: 'BOARD',
          status: 'ACTIVE',
          startsAt: yesterday,
          reason: 'test',
        },
      },
    },
  })
  createdUserIds.push(boardUser.id)
  boardUserId = boardUser.id
  boardToken = (await createSession(boardUser.id, { ipAddress: '127.0.0.1', userAgent: 'test' })).token

  // 3. Tạo User DEPARTMENT_MANAGER Ban A
  const managerAUser = await db.user.create({
    data: {
      username: `manager-${tag}`,
      email: `manager-${tag}@test.local`,
      fullName: 'Manager Test',
      passwordHash: 'dummy',
      status: 'ACTIVE',
      mustChangePassword: false,
      roles: {
        create: {
          role: 'DEPARTMENT_MANAGER',
          departmentId: deptAId,
          status: 'ACTIVE',
          startsAt: yesterday,
          reason: 'test',
        },
      },
    },
  })
  createdUserIds.push(managerAUser.id)
  managerAToken = (await createSession(managerAUser.id, { ipAddress: '127.0.0.1', userAgent: 'test' })).token

  // 4. Tạo User MEMBER bình thường
  const memberUser = await db.user.create({
    data: {
      username: `member-${tag}`,
      email: `member-${tag}@test.local`,
      fullName: 'Member Test',
      passwordHash: 'dummy',
      status: 'ACTIVE',
      mustChangePassword: false,
    },
  })
  createdUserIds.push(memberUser.id)
  memberToken = (await createSession(memberUser.id, { ipAddress: '127.0.0.1', userAgent: 'test' })).token
})

afterAll(async () => {
  if (createdRoundIds.length > 0) {
    // Lấy danh sách hồ sơ test đã tạo để dọn consent và email
    const apps = await db.membershipApplication.findMany({
      where: { recruitmentRoundId: { in: createdRoundIds } },
      select: { id: true },
    })
    const appIds = apps.map((a) => a.id)
    await db.auditLog.deleteMany({
      where: {
        OR: [
          { targetId: { in: createdRoundIds } },
          { targetId: { in: appIds } },
        ],
      },
    })
    if (appIds.length > 0) {
      await db.membershipApplication.updateMany({
        where: { id: { in: appIds } },
        data: { convertedUserId: null },
      })
      await db.consentRecord.deleteMany({
        where: { subjectType: 'APPLICATION', subjectId: { in: appIds } },
      })
      await db.notificationDelivery.deleteMany({
        where: { refType: 'APPLICATION', refId: { in: appIds } },
      })
      await db.membershipApplication.deleteMany({
        where: { id: { in: appIds } },
      })
    }
    await db.recruitmentRound.deleteMany({
      where: { id: { in: createdRoundIds } },
    })
  }
  if (createdUserIds.length > 0) {
    await db.auditLog.deleteMany({ where: { actorId: { in: createdUserIds } } })
    await db.session.deleteMany({ where: { userId: { in: createdUserIds } } })
    await db.userRole.deleteMany({ where: { userId: { in: createdUserIds } } })
    await db.user.deleteMany({ where: { id: { in: createdUserIds } } })
  }
  if (createdDeptIds.length > 0) {
    await db.department.deleteMany({ where: { id: { in: createdDeptIds } } })
  }
  await app.close()
  await db.$disconnect()
})

describe('Recruitment Module (R2)', () => {
  let createdRoundId: string
  const roundSlug = `round-${tag}`

  // ─── 1. API CÔNG KHAI ──────────────────────────────────────────────────
  it('GET /public/recruitment-rounds chỉ trả các đợt OPEN hoặc CLOSED', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/public/recruitment-rounds',
    })
    expect(res.statusCode).toBe(200)
    const data = res.json()
    expect(data).toHaveProperty('items')
    for (const item of data.items) {
      expect(['OPEN', 'CLOSED']).toContain(item.status)
      // Không lộ createdById ở API công khai (Reviewer Item 5)
      expect(item).not.toHaveProperty('createdById')
    }
  })

  // ─── 2. QUẢN TRỊ: TẠO ĐỢT TUYỂN (POST /admin/recruitment) ───────────────
  it('Từ chối khi chưa đăng nhập (401) hoặc sai vai trò (403 cho manager/member)', async () => {
    const noAuth = await app.inject({
      method: 'POST',
      url: '/admin/recruitment',
      headers: { origin: ORIGIN },
      payload: {},
    })
    expect(noAuth.statusCode).toBe(401)

    const forbiddenRes = await app.inject({
      method: 'POST',
      url: '/admin/recruitment',
      cookies: { [SESSION_COOKIE]: managerAToken },
      headers: { origin: ORIGIN },
      payload: {},
    })
    expect(forbiddenRes.statusCode).toBe(403)
  })

  it('Từ chối khi closesAt trước opensAt (422)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/admin/recruitment',
      cookies: { [SESSION_COOKIE]: boardToken },
      headers: { origin: ORIGIN },
      payload: {
        title: 'Đợt sai ngày',
        slug: `invalid-date-${tag}`,
        description: 'Mô tả đợt tuyển hợp lệ đủ dài',
        audience: 'Sinh viên UMT',
        requirements: 'Đam mê lập trình',
        opensAt: '2026-11-10T00:00:00.000Z',
        closesAt: '2026-11-05T00:00:00.000Z',
        departmentIds: [deptAId],
      },
    })
    expect(res.statusCode).toBe(422)
  })

  it('BOARD tạo thành công đợt tuyển ở trạng thái DRAFT (201)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/admin/recruitment',
      cookies: { [SESSION_COOKIE]: boardToken },
      headers: { origin: ORIGIN },
      payload: {
        title: 'Đợt tuyển Gen 5 Test',
        slug: roundSlug,
        description: 'Mô tả tuyển thành viên chính thức',
        audience: 'Sinh viên khóa 2024 - 2026',
        requirements: 'Tinh thần trách nhiệm và học hỏi',
        opensAt: '2026-11-01T00:00:00.000Z',
        closesAt: '2026-11-30T00:00:00.000Z',
        departmentIds: [deptAId, deptBId],
        questions: [
          {
            id: 'q1',
            type: 'short_text',
            label: 'Link Github của bạn?',
            required: true,
          },
          {
            id: 'q2',
            type: 'single_choice',
            label: 'Bạn biết tới APC qua đâu?',
            options: [
              { id: 'opt1', label: 'Fanpage' },
              { id: 'opt2', label: 'Bạn bè giới thiệu' },
            ],
          },
        ],
      },
    })

    expect(res.statusCode).toBe(201)
    const body = res.json()
    expect(body.status).toBe('DRAFT')
    expect(body.slug).toBe(roundSlug)
    expect(body.departments).toHaveLength(2)
    createdRoundId = body.id
    createdRoundIds.push(createdRoundId)
  })

  it('Đợt DRAFT không xuất hiện ở API công khai (404 khi truy cập slug)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/public/recruitment-rounds/${roundSlug}`,
    })
    expect(res.statusCode).toBe(404)
  })

  // ─── 3. CÁC ENDPOINT QUẢN TRỊ: DANH SÁCH, CHI TIẾT, XEM TRƯỚC ───────────
  it('GET /admin/recruitment: BOARD 200, MEMBER 403, chưa đăng nhập 401', async () => {
    const noAuth = await app.inject({ method: 'GET', url: '/admin/recruitment' })
    expect(noAuth.statusCode).toBe(401)

    const memberRes = await app.inject({
      method: 'GET',
      url: '/admin/recruitment',
      cookies: { [SESSION_COOKIE]: memberToken },
    })
    expect(memberRes.statusCode).toBe(403)

    const boardRes = await app.inject({
      method: 'GET',
      url: '/admin/recruitment?status=DRAFT',
      cookies: { [SESSION_COOKIE]: boardToken },
    })
    expect(boardRes.statusCode).toBe(200)
    expect(boardRes.json()).toHaveProperty('items')
  })

  it('GET /admin/recruitment/:id/preview: BOARD 200, MEMBER 403', async () => {
    const memberRes = await app.inject({
      method: 'GET',
      url: `/admin/recruitment/${createdRoundId}/preview`,
      cookies: { [SESSION_COOKIE]: memberToken },
    })
    expect(memberRes.statusCode).toBe(403)

    const boardRes = await app.inject({
      method: 'GET',
      url: `/admin/recruitment/${createdRoundId}/preview`,
      cookies: { [SESSION_COOKIE]: boardToken },
    })
    expect(boardRes.statusCode).toBe(200)
    expect(boardRes.json().id).toBe(createdRoundId)
  })

  // ─── 4. CẬP NHẬT ĐỢT TUYỂN (PATCH) VÀ RÀNG BUỘC (REC-15) ────────────────
  it('PATCH /admin/recruitment/:id: chưa đăng nhập 401, MEMBER 403', async () => {
    const noAuth = await app.inject({
      method: 'PATCH',
      url: `/admin/recruitment/${createdRoundId}`,
      headers: { origin: ORIGIN },
      payload: { title: 'Tên mới' },
    })
    expect(noAuth.statusCode).toBe(401)

    const memberRes = await app.inject({
      method: 'PATCH',
      url: `/admin/recruitment/${createdRoundId}`,
      cookies: { [SESSION_COOKIE]: memberToken },
      headers: { origin: ORIGIN },
      payload: { title: 'Tên mới' },
    })
    expect(memberRes.statusCode).toBe(403)
  })

  it('PATCH ngày sai thứ tự trả 422 validation', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/admin/recruitment/${createdRoundId}`,
      cookies: { [SESSION_COOKIE]: boardToken },
      headers: { origin: ORIGIN },
      payload: {
        closesAt: '2026-10-01T00:00:00.000Z', // Trước opensAt
      },
    })
    expect(res.statusCode).toBe(422)
  })

  // ─── 5. CHUYỂN TRẠNG THÁI VÀ BẢO VỆ DỮ LIỆU ───────────────────────────
  it('POST /admin/recruitment/:id/status: chưa đăng nhập 401, MEMBER 403', async () => {
    const noAuth = await app.inject({
      method: 'POST',
      url: `/admin/recruitment/${createdRoundId}/status`,
      headers: { origin: ORIGIN },
      payload: { status: 'OPEN' },
    })
    expect(noAuth.statusCode).toBe(401)

    const memberRes = await app.inject({
      method: 'POST',
      url: `/admin/recruitment/${createdRoundId}/status`,
      cookies: { [SESSION_COOKIE]: memberToken },
      headers: { origin: ORIGIN },
      payload: { status: 'OPEN' },
    })
    expect(memberRes.statusCode).toBe(403)
  })

  it('Chuyển trạng thái sai (DRAFT -> CLOSED) bị từ chối 409', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/admin/recruitment/${createdRoundId}/status`,
      cookies: { [SESSION_COOKIE]: boardToken },
      headers: { origin: ORIGIN },
      payload: { status: 'CLOSED' },
    })
    expect(res.statusCode).toBe(409)
  })

  it('Mở đợt tuyển hợp lệ (DRAFT -> OPEN)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/admin/recruitment/${createdRoundId}/status`,
      cookies: { [SESSION_COOKIE]: boardToken },
      headers: { origin: ORIGIN },
      payload: { status: 'OPEN' },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().status).toBe('OPEN')

    // API công khai xem được và lọc bỏ câu hỏi ẩn nếu có
    const pubRes = await app.inject({
      method: 'GET',
      url: `/public/recruitment-rounds/${roundSlug}`,
    })
    expect(pubRes.statusCode).toBe(200)
  })

  it('Khi đợt đang OPEN: khóa slug không cho sửa (409)', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/admin/recruitment/${createdRoundId}`,
      cookies: { [SESSION_COOKIE]: boardToken },
      headers: { origin: ORIGIN },
      payload: { slug: `new-slug-${tag}` },
    })
    expect(res.statusCode).toBe(409)
  })

  // ─── 6. PHÂN QUYỀN XEM VÀ QUY TẮC CÂU HỎI KHI CÓ HỒ SƠ ─────────────────
  it('Manager Ban A chỉ xem được đợt khi có hồ sơ nộp vào Ban A', async () => {
    // Ban đầu chưa có hồ sơ nào nộp vào Ban A -> Manager truy cập nhận 404
    const resBefore = await app.inject({
      method: 'GET',
      url: `/admin/recruitment/${createdRoundId}`,
      cookies: { [SESSION_COOKIE]: managerAToken },
    })
    expect(resBefore.statusCode).toBe(404)

    // Tạo 1 hồ sơ nộp vào Ban A
    await db.membershipApplication.create({
      data: {
        profileCode: `app-test-${tag}`,
        recruitmentRoundId: createdRoundId,
        applicantName: 'Ứng viên Test A',
        applicantEmail: `test-app-${tag}@example.com`,
        studentId: `24000${tag.slice(0, 4)}`,
        desiredDepartmentId: deptAId,
        status: 'NEW',
      },
    })

    // Sau khi có hồ sơ Ban A -> Manager Ban A xem được
    const resAfter = await app.inject({
      method: 'GET',
      url: `/admin/recruitment/${createdRoundId}`,
      cookies: { [SESSION_COOKIE]: managerAToken },
    })
    expect(resAfter.statusCode).toBe(200)
    expect(resAfter.json().id).toBe(createdRoundId)
  })

  it('Khi đã có hồ sơ: Xóa lựa chọn (option) đã có người chọn bị từ chối 409', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/admin/recruitment/${createdRoundId}`,
      cookies: { [SESSION_COOKIE]: boardToken },
      headers: { origin: ORIGIN },
      payload: {
        questions: [
          {
            id: 'q1',
            type: 'short_text',
            label: 'Link Github của bạn?',
          },
          {
            id: 'q2',
            type: 'single_choice',
            label: 'Bạn biết tới APC qua đâu?',
            options: [{ id: 'opt1', label: 'Fanpage' }], // Xóa mất opt2
          },
        ],
      },
    })
    expect(res.statusCode).toBe(409)
  })

  it('Ẩn câu hỏi (hidden: true) được phép thành công khi đã có hồ sơ', async () => {
    const hideQ = await app.inject({
      method: 'PATCH',
      url: `/admin/recruitment/${createdRoundId}`,
      cookies: { [SESSION_COOKIE]: boardToken },
      headers: { origin: ORIGIN },
      payload: {
        questions: [
          {
            id: 'q1',
            type: 'short_text',
            label: 'Link Github của bạn?',
            hidden: true, // Ẩn câu
          },
          {
            id: 'q2',
            type: 'single_choice',
            label: 'Bạn biết tới APC qua đâu?',
            options: [
              { id: 'opt1', label: 'Fanpage' },
              { id: 'opt2', label: 'Bạn bè giới thiệu' },
            ],
          },
        ],
      },
    })
    expect(hideQ.statusCode).toBe(200)

    // Kiểm tra câu ẩn không xuất hiện ở API công khai
    const pubRes = await app.inject({
      method: 'GET',
      url: `/public/recruitment-rounds/${roundSlug}`,
    })
    expect(pubRes.statusCode).toBe(200)
    const questions = pubRes.json().questions
    expect(questions.find((q: { id: string }) => q.id === 'q1')).toBeUndefined()
  })

  // ─── 7. ĐÓNG SỚM, LƯU TRỮ VÀ KIỂM TRA AUDIT LOG ────────────────────────
  it('Đóng sớm đợt tuyển cập nhật closesAt = hiện tại và ghi audit đóng đợt', async () => {
    const closeRes = await app.inject({
      method: 'POST',
      url: `/admin/recruitment/${createdRoundId}/status`,
      cookies: { [SESSION_COOKIE]: boardToken },
      headers: { origin: ORIGIN },
      payload: { status: 'CLOSED' },
    })
    expect(closeRes.statusCode).toBe(200)
    const closedRound = closeRes.json()
    expect(closedRound.status).toBe('CLOSED')
    expect(new Date(closedRound.closesAt).getTime()).toBeLessThanOrEqual(Date.now() + 1000)

    // Chuyển tiếp CLOSED -> ARCHIVED
    const archiveRes = await app.inject({
      method: 'POST',
      url: `/admin/recruitment/${createdRoundId}/status`,
      cookies: { [SESSION_COOKIE]: boardToken },
      headers: { origin: ORIGIN },
      payload: { status: 'ARCHIVED' },
    })
    expect(archiveRes.statusCode).toBe(200)
    expect(archiveRes.json().status).toBe('ARCHIVED')

    // Đợt ARCHIVED không xuất hiện ở API công khai (404)
    const pubRes = await app.inject({
      method: 'GET',
      url: `/public/recruitment-rounds/${roundSlug}`,
    })
    expect(pubRes.statusCode).toBe(404)

    // Kiểm tra đã ghi nhận nhật ký audit lưu trữ đợt tuyển
    const auditRecord = await db.auditLog.findFirst({
      where: {
        targetId: createdRoundId,
        action: AUDIT_ACTIONS.RECRUITMENT_ARCHIVE_ROUND,
      },
    })
    expect(auditRecord).not.toBeNull()
  })

  // ─── 8. TÁC VỤ NỀN: TỰ ĐỘNG ĐÓNG ĐỢT QUÁ HẠN ───────────────────────────
  it('Tác vụ đóng đợt tự động chuyển OPEN quá hạn sang CLOSED trong database', async () => {
    // Tạo 1 đợt OPEN riêng cho test tác vụ nền
    const autoRound = await db.recruitmentRound.create({
      data: {
        title: `Đợt test auto close ${tag}`,
        slug: `auto-close-${tag}`,
        description: 'Mô tả',
        audience: 'Sinh viên',
        requirements: 'Laptop',
        status: 'OPEN',
        opensAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
        closesAt: new Date(Date.now() - 1000), // Đã quá hạn
        createdById: createdUserIds[0]!,
        departments: { connect: [{ id: deptAId }] },
      },
    })
    createdRoundIds.push(autoRound.id)

    // Chạy tác vụ nền
    await closeExpiredRecruitmentRounds()

    // Chỉ kiểm tra đợt tuyển của test này
    const roundInDb = await db.recruitmentRound.findUnique({
      where: { id: autoRound.id },
    })
    expect(roundInDb?.status).toBe('CLOSED')
  })

  // ─── 7. NỘP ĐƠN ỨNG TUYỂN (R3)
  //  ──────────────────────────────────────────
  describe('Nộp đơn ứng tuyển (R3)', () => {
    let _applyRoundSlug: string

    beforeAll(async () => {
      _applyRoundSlug = `apply-round-${tag}`
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000)
      const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

      // Tạo đợt tuyển OPEN có câu hỏi bắt buộc và câu hỏi ẩn
      const round = await db.recruitmentRound.create({
        data: {
          title: `Đợt tuyển nộp đơn ${tag}`,
          slug: _applyRoundSlug,
          description: 'Mô tả đợt tuyển thử nghiệm nộp đơn',
          audience: 'Sinh viên năm 1, năm 2',
          requirements: 'Có laptop cá nhân',
          status: 'OPEN',
          opensAt: yesterday,
          closesAt: nextWeek,
          createdById : createdUserIds[0]!,
          departments: { connect: [{ id: deptAId }] },
          questions: [
            {
              id: 'q_github',
              type: 'short_text',
              label: 'Link Github của bạn',
              required: true,
              hidden: false,
            },
            {
              id: 'q_role',
              type: 'single_choice',
              label: 'Vị trí ứng tuyển',
              required: false,
              hidden: false,
              options: [
                { id: 'opt_fe', label: 'Frontend' },
                { id: 'opt_be', label: 'Backend' },
              ],
            },
            {
              id: 'q_draft_hidden',
              type: 'long_text',
              label: 'Câu hỏi nháp đã ẩn',
              required: true,
              hidden: true, // Câu này bị ẩn, không được chặn nộp đơn
            },
          ],
        },
      })
      createdRoundIds.push(round.id)
    })

    const basePayload = {
      applicantName: 'Nguyễn Văn Test',
      applicantEmail: `applicant-${tag}@example.com`,
      studentId: `24${tag.slice(0, 6)}`,
      faculty: 'Công nghệ thông tin',
      major: 'Kỹ thuật phần mềm',
      cohort: 'K24',
      skills: 'TypeScript, React',
      experience: 'Đã làm một số project nhỏ',
      consent: true,
    }

    it('Người dùng đã đăng nhập (MEMBER) nộp đơn bị từ chối 403', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/public/recruitment-rounds/${_applyRoundSlug}/applications`,
        cookies: { [SESSION_COOKIE]: memberToken },
        headers: { origin: ORIGIN },
        payload: {
          ...basePayload,
          desiredDepartmentId: deptAId,
          answers: { q_github: 'https://github.com/test' },
        },
      })
      expect(res.statusCode).toBe(403)
    })

    it('Chưa đồng ý chính sách xử lý dữ liệu (consent = false) trả 422', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/public/recruitment-rounds/${_applyRoundSlug}/applications`,
        headers: { origin: ORIGIN },
        payload: {
          ...basePayload,
          consent: false,
          desiredDepartmentId: deptAId,
          answers: { q_github: 'https://github.com/test' },
        },
      })
      expect(res.statusCode).toBe(422)
    })

    it('Chọn ban không thuộc đợt tuyển trả 422', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/public/recruitment-rounds/${_applyRoundSlug}/applications`,
        headers: { origin: ORIGIN },
        payload: {
          ...basePayload,
          desiredDepartmentId: deptBId, // deptB không có trong đợt này
          answers: { q_github: 'https://github.com/test' },
        },
      })
      expect(res.statusCode).toBe(422)
    })

    it('Bỏ trống câu hỏi bắt buộc trả 422', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/public/recruitment-rounds/${_applyRoundSlug}/applications`,
        headers: { origin: ORIGIN },
        payload: {
          ...basePayload,
          desiredDepartmentId: deptAId,
          answers: {}, // Thiếu câu q_github
        },
      })
      expect(res.statusCode).toBe(422)
    })

    it('Gửi header Idempotency-Key không đúng chuẩn UUID trả 422', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/public/recruitment-rounds/${_applyRoundSlug}/applications`,
        headers: {
          origin: ORIGIN,
          'idempotency-key': 'not-a-valid-uuid',
        },
        payload: {
          ...basePayload,
          applicantEmail: `invalid-uuid-${tag}@example.com`,
          studentId: `IU${tag.slice(0, 6)}`,
          desiredDepartmentId: deptAId,
          answers: { q_github: 'https://github.com/test' },
        },
      })
      expect(res.statusCode).toBe(422)
      expect(res.json().issues[0].message).toContain('Header Idempotency-Key')
    })

    it('Nộp đơn thành công 201; câu hidden bắt buộc không chặn nộp đơn; gửi lặp Idempotency-Key trả kết quả cũ', async () => {
      const idempotencyKey = randomUUID()

      // Lần 1: Nộp thành công (bỏ qua câu q_draft_hidden)
      const res1 = await app.inject({
        method: 'POST',
        url: `/public/recruitment-rounds/${_applyRoundSlug}/applications`,
        headers: {
          origin: ORIGIN,
          'idempotency-key': idempotencyKey,
        },
        payload: {
          ...basePayload,
          desiredDepartmentId: deptAId,
          answers: { q_github: 'https://github.com/test' },
        },
      })

      expect(res1.statusCode).toBe(201)
      const data1 = res1.json()
      expect(data1).toHaveProperty('profileCode')
      expect(data1.applicantName).toBe(basePayload.applicantName)

      // Lần 2: Gửi lặp cùng Idempotency-Key
      const res2 = await app.inject({
        method: 'POST',
        url: `/public/recruitment-rounds/${_applyRoundSlug}/applications`,
        headers: {
          origin: ORIGIN,
          'idempotency-key': idempotencyKey,
        },
        payload: {
          ...basePayload,
          desiredDepartmentId: deptAId,
          answers: { q_github: 'https://github.com/test' },
        },
      })

      expect(res2.statusCode).toBe(201)
      const data2 = res2.json()
      expect(data2.profileCode).toBe(data1.profileCode) // Trả đúng mã cũ

      // Chỉ có duy nhất 1 bản ghi được tạo trong database
      const count = await db.membershipApplication.count({
        where: { idempotencyKey },
      })
      expect(count).toBe(1)

            // Lấy bản ghi đơn ứng tuyển vừa tạo trong database
      const appRecord = await db.membershipApplication.findUniqueOrThrow({
        where: { profileCode: data1.profileCode },
      })

      // Kiểm tra ConsentRecord được tạo kèm: PHẢI gắn đúng subjectId là id của đơn ứng tuyển
      const consent = await db.consentRecord.findFirst({
        where: {
          purpose: 'RECRUITMENT_PROCESSING',
          subjectType: 'APPLICATION',
          subjectId: appRecord.id, // <-- Kiểm tra đúng theo subjectId
        },
      })
      expect(consent).not.toBeNull()

      // Kiểm tra Email xác nhận có trong hàng đợi
      const emailDelivery = await db.notificationDelivery.findFirst({
        where: {
          type: 'APPLICATION_SUBMITTED',
          recipient: basePayload.applicantEmail.toLowerCase(),
          refId: appRecord.id,
        },
      })
      expect(emailDelivery).not.toBeNull()
      expect(emailDelivery?.status).toBe('PENDING')

      // Kiểm tra nội dung email: phải chứa mã hồ sơ và link tra cứu không kèm mã trên URL (OPS-11)
      const renderedEmail = await EMAIL_TEMPLATES.APPLICATION_SUBMITTED(appRecord.id)
      expect(renderedEmail).not.toBeNull()
      expect(renderedEmail?.text).toContain(data1.profileCode)
      expect(renderedEmail?.html).toContain(data1.profileCode)
      expect(renderedEmail?.html).toMatch(/href="[^"]*\/recruitment\/application-lookup"/)
      expect(renderedEmail?.html).not.toContain(data1.profileCode + '/') // Không để mã lên query hay URL
    })

    it('Hai request gửi song song cùng Idempotency-Key đều trả về 201 với cùng một mã hồ sơ', async () => {
      const parallelKey = randomUUID()
      const parallelEmail = `parallel-${tag}@example.com`
      const parallelPayload = {
        ...basePayload,
        applicantEmail: parallelEmail,
        studentId: `66${tag.slice(0, 6)}`,
        desiredDepartmentId: deptAId,
        answers: { q_github: 'https://github.com/parallel-test' },
      }

      // Bắn 2 request hoàn toàn song song
      const [resA, resB] = await Promise.all([
        app.inject({
          method: 'POST',
          url: `/public/recruitment-rounds/${_applyRoundSlug}/applications`,
          headers: { origin: ORIGIN, 'idempotency-key': parallelKey },
          payload: parallelPayload,
        }),
        app.inject({
          method: 'POST',
          url: `/public/recruitment-rounds/${_applyRoundSlug}/applications`,
          headers: { origin: ORIGIN, 'idempotency-key': parallelKey },
          payload: parallelPayload,
        }),
      ])

      // Cả 2 đều phải 201 thành công
      expect(resA.statusCode).toBe(201)
      expect(resB.statusCode).toBe(201)
      // Cả 2 phải trả về cùng một mã hồ sơ
      expect(resA.json().profileCode).toBe(resB.json().profileCode)

      // Database chỉ được tạo đúng 1 bản ghi
      const count = await db.membershipApplication.count({
        where: { idempotencyKey: parallelKey },
      })
      expect(count).toBe(1)
    })

    it('Nộp đơn trùng email trong đợt trả 409 với câu thông báo bảo mật chung', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/public/recruitment-rounds/${_applyRoundSlug}/applications`,
        headers: { origin: ORIGIN },
        payload: {
          ...basePayload,
          studentId: `99${tag.slice(0, 6)}`, // MSSV khác
          desiredDepartmentId: deptAId,
          answers: { q_github: 'https://github.com/test' },
        },
      })

      expect(res.statusCode).toBe(409)
      expect(res.json().message).toBe(
        'Không thể nộp đơn với thông tin này. Nếu đã nộp, vui lòng dùng trang tra cứu.',
      )
    })

    it('Nộp đơn trùng MSSV trong đợt trả 409 với câu thông báo bảo mật chung', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/public/recruitment-rounds/${_applyRoundSlug}/applications`,
        headers: { origin: ORIGIN },
        payload: {
          ...basePayload,
          applicantEmail: `different-${tag}@example.com`, // Email khác
          desiredDepartmentId: deptAId,
          answers: { q_github: 'https://github.com/test' },
        },
      })

      expect(res.statusCode).toBe(409)
      expect(res.json().message).toBe(
        'Không thể nộp đơn với thông tin này. Nếu đã nộp, vui lòng dùng trang tra cứu.',
      )
    })
        it('Nộp đơn vào đợt ở trạng thái DRAFT trả 404', async () => {
      const draftRound = await db.recruitmentRound.create({
        data: {
          title: `Đợt nháp ${tag}`,
          slug: `draft-round-${tag}`,
          description: 'Mô tả đợt nháp',
          audience: 'Sinh viên',
          requirements: 'Yêu cầu',
          status: 'DRAFT',
          opensAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
          closesAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          createdById: createdUserIds[0]!,
          departments: { connect: [{ id: deptAId }] },
        },
      })
      createdRoundIds.push(draftRound.id)

      const res = await app.inject({
        method: 'POST',
        url: `/public/recruitment-rounds/${draftRound.slug}/applications`,
        headers: { origin: ORIGIN },
        payload: {
          ...basePayload,
          applicantEmail: `draft-${tag}@example.com`,
          studentId: `DR${tag.slice(0, 6)}`,
          desiredDepartmentId: deptAId,
        },
      })
      expect(res.statusCode).toBe(404)
    })

    it('Nộp đơn vào đợt OPEN nhưng chưa tới ngày mở nhận đơn trả 409', async () => {
      const futureRound = await db.recruitmentRound.create({
        data: {
          title: `Đợt tương lai ${tag}`,
          slug: `future-round-${tag}`,
          description: 'Mô tả đợt tương lai',
          audience: 'Sinh viên',
          requirements: 'Yêu cầu',
          status: 'OPEN',
          opensAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // Mở sau 2 ngày
          closesAt: new Date(Date.now() + 9 * 24 * 60 * 60 * 1000),
          createdById: createdUserIds[0]!,
          departments: { connect: [{ id: deptAId }] },
        },
      })
      createdRoundIds.push(futureRound.id)

      const res = await app.inject({
        method: 'POST',
        url: `/public/recruitment-rounds/${futureRound.slug}/applications`,
        headers: { origin: ORIGIN },
        payload: {
          ...basePayload,
          applicantEmail: `future-${tag}@example.com`,
          studentId: `FU${tag.slice(0, 6)}`,
          desiredDepartmentId: deptAId,
        },
      })
      expect(res.statusCode).toBe(409)
      expect(res.json().message).toContain('không trong thời gian nhận đơn')
    })

    it('Nộp đơn vào đợt OPEN nhưng đã quá hạn đóng nhận đơn trả 409', async () => {
      const expiredRound = await db.recruitmentRound.create({
        data: {
          title: `Đợt hết hạn ${tag}`,
          slug: `expired-round-${tag}`,
          description: 'Mô tả đợt hết hạn',
          audience: 'Sinh viên',
          requirements: 'Yêu cầu',
          status: 'OPEN',
          opensAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          closesAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // Đã đóng hôm qua
          createdById: createdUserIds[0]!,
          departments: { connect: [{ id: deptAId }] },
        },
      })
      createdRoundIds.push(expiredRound.id)

      const res = await app.inject({
        method: 'POST',
        url: `/public/recruitment-rounds/${expiredRound.slug}/applications`,
        headers: { origin: ORIGIN },
        payload: {
          ...basePayload,
          applicantEmail: `expired-${tag}@example.com`,
          studentId: `EX${tag.slice(0, 6)}`,
          desiredDepartmentId: deptAId,
        },
      })
      expect(res.statusCode).toBe(409)
      expect(res.json().message).toContain('không trong thời gian nhận đơn')
    })

        it('Chọn lựa chọn không nằm trong danh sách câu hỏi trắc nghiệm trả 422', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/public/recruitment-rounds/${_applyRoundSlug}/applications`,
        headers: { origin: ORIGIN },
        payload: {
          ...basePayload,
          applicantEmail: `invalid-opt-${tag}@example.com`,
          studentId: `IO${tag.slice(0, 6)}`,
          desiredDepartmentId: deptAId,
          answers: {
            q_github: 'https://github.com/test',
            q_role: 'opt_khong_ton_tai', // Lựa chọn không hợp lệ
          },
        },
      })
      expect(res.statusCode).toBe(422)
      expect(res.json().issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ path: ['answers', 'q_role'] }),
        ]),
      )
    })

        it('Hai request gửi song song cùng email (không có key) chỉ 1 request thành công 201, request kia 409', async () => {
      const concurrentEmail = `concurrent-${tag}@example.com`
      const payload = {
        ...basePayload,
        applicantEmail: concurrentEmail,
        studentId: `CC${tag.slice(0, 6)}`,
        desiredDepartmentId: deptAId,
        answers: { q_github: 'https://github.com/test' },
      }

      const [resA, resB] = await Promise.all([
        app.inject({
          method: 'POST',
          url: `/public/recruitment-rounds/${_applyRoundSlug}/applications`,
          headers: { origin: ORIGIN },
          payload,
        }),
        app.inject({
          method: 'POST',
          url: `/public/recruitment-rounds/${_applyRoundSlug}/applications`,
          headers: { origin: ORIGIN },
          payload,
        }),
      ])

      const codes = [resA.statusCode, resB.statusCode].sort()
      expect(codes).toEqual([201, 409])
    })

        it('Gửi quá 10 lần trong 15 phút từ cùng cặp (IP, email) nhận 429 rate_limited (SEC-05)', async () => {
      const ip = nextIp()
      const floodEmail = `flood-${tag}@example.com`
      const floodPayload = {
        ...basePayload,
        applicantEmail: floodEmail,
        studentId: `FL${tag.slice(0, 6)}`,
        desiredDepartmentId: deptAId,
        answers: { q_github: 'https://github.com/flood' },
      }

      const statuses: number[] = []
      for (let i = 0; i < 11; i++) {
        const res = await app.inject({
          method: 'POST',
          url: `/public/recruitment-rounds/${_applyRoundSlug}/applications`,
          remoteAddress: ip,
          headers: { origin: ORIGIN },
          payload: floodPayload,
        })
        statuses.push(res.statusCode)
      }

      expect(statuses[0]).toBe(201)
      expect(statuses[10]).toBe(429) // Lần thứ 11 chạm ngưỡng rate limit
    })
  })
  // ─── 8. TRA CỨU VÀ RÚT ĐƠN (R4) ───────────────────────────
  describe('Tra cứu và rút đơn (R4)', () => {
    let testAppCode: string
    let lookupRoundId: string
    let lookupRoundSlug: string
    const applicantEmail = `lookup-${tag}@example.com`

    const postLookup = (payload: Record<string, unknown>, options?: { ip?: string }) =>
      app.inject({
        method: 'POST',
        url: '/public/applications/lookup',
        headers: { origin: ORIGIN },
        remoteAddress: options?.ip ?? nextIp(),
        payload,
      })

    const postWithdraw = (payload: Record<string, unknown>, options?: { ip?: string }) =>
      app.inject({
        method: 'POST',
        url: '/public/applications/withdraw',
        headers: { origin: ORIGIN },
        remoteAddress: options?.ip ?? nextIp(),
        payload,
      })

    beforeAll(async () => {
      lookupRoundSlug = `lookup-round-${tag}`
      const round = await db.recruitmentRound.create({
        data: {
          title: `Đợt tuyển tra cứu ${tag}`,
          slug: lookupRoundSlug,
          description: 'Mô tả đợt tuyển thử nghiệm tra cứu',
          audience: 'Sinh viên',
          requirements: 'Không yêu cầu',
          status: 'OPEN',
          opensAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
          closesAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          createdById: createdUserIds[0]!,
          departments: { connect: [{ id: deptAId }] },
        },
      })
      lookupRoundId = round.id
      createdRoundIds.push(round.id)

      // Nộp 1 hồ sơ hợp lệ để dùng cho test tra cứu và rút đơn
      const res = await app.inject({
        method: 'POST',
        url: `/public/recruitment-rounds/${lookupRoundSlug}/applications`,
        headers: { origin: ORIGIN },
        payload: {
          applicantName: 'Nguyễn Văn Tra Cứu',
          applicantEmail,
          studentId: `88${tag.slice(0, 6)}`,
          desiredDepartmentId: deptAId,
          consent: true,
        },
      })
      expect(res.statusCode).toBe(201)
      testAppCode = res.json().profileCode
    })

    it('Tra cứu đúng trả về 200, đúng trạng thái và KHÔNG để lộ ghi chú nội bộ (BR-07)', async () => {
      const res = await postLookup({
        email: applicantEmail,
        code: testAppCode,
      })

      expect(res.statusCode).toBe(200)
      const data = res.json()
      expect(data.profileCode).toBe(testAppCode)
      expect(data.status).toBe('NEW')
      expect(data.canWithdraw).toBe(true)
      expect(data.roundSlug).toBe(lookupRoundSlug)

      // Kiểm tra bảo mật: Không được lộ ghi chú, đánh giá, câu trả lời
      expect(data.internalNote).toBeUndefined()
      expect(data.reviewedById).toBeUndefined()
      expect(data.answers).toBeUndefined()
    })

    it('Tra cứu thành công kể cả khi nhập mã hồ sơ bằng chữ thường hoặc thừa khoảng trắng', async () => {
      const res = await postLookup({
        email: applicantEmail.toUpperCase(),
        code: `  ${testAppCode.toLowerCase()}  `,
      })

      expect(res.statusCode).toBe(200)
      expect(res.json().profileCode).toBe(testAppCode)
    })

    it('Tra cứu với mã hồ sơ quá 32 ký tự hoặc email quá 254 ký tự trả về 422', async () => {
      const resLongCode = await postLookup({
        email: applicantEmail,
        code: 'A'.repeat(33),
      })
      expect(resLongCode.statusCode).toBe(422)

      const resLongEmail = await postLookup({
        email: `${'a'.repeat(250)}@test.com`,
        code: testAppCode,
      })
      expect(resLongEmail.statusCode).toBe(422)
    })

    it('Tra cứu với email sai kiểu (số 12345) trả về 422 chứ không lỗi 500', async () => {
      const res = await postLookup({
        email: 12345,
        code: testAppCode,
      })
      expect(res.statusCode).toBe(422)
    })

    it('Rút đơn với email sai kiểu (số 12345) trả về 422 chứ không lỗi 500', async () => {
      const res = await postWithdraw({
        email: 12345,
        code: testAppCode,
      })
      expect(res.statusCode).toBe(422)
    })

    it('Tra cứu sai email hoặc sai mã đều trả 404 với cùng một thông báo chung (FLOW-05)', async () => {
      const expectedMessage = 'Không tìm thấy hồ sơ với thông tin đã cung cấp.'

      // Case 1: Đúng mã nhưng sai email
      const resWrongEmail = await postLookup({
        email: `wrong-email-${tag}@example.com`,
        code: testAppCode,
      })
      expect(resWrongEmail.statusCode).toBe(404)
      expect(resWrongEmail.json().message).toBe(expectedMessage)

      // Case 2: Đúng email nhưng sai mã
      const resWrongCode = await postLookup({
        email: applicantEmail,
        code: 'WRONGCODE999',
      })
      expect(resWrongCode.statusCode).toBe(404)
      expect(resWrongCode.json().message).toBe(expectedMessage)
    })

    it('Rút đơn sai email hoặc sai mã đều trả 404 với cùng một thông báo chung (FLOW-05)', async () => {
      const expectedMessage = 'Không tìm thấy hồ sơ với thông tin đã cung cấp.'

      // Case 1: Đúng mã nhưng sai email
      const resWrongEmail = await postWithdraw({
        email: `wrong-email-${tag}@example.com`,
        code: testAppCode,
      })
      expect(resWrongEmail.statusCode).toBe(404)
      expect(resWrongEmail.json().message).toBe(expectedMessage)

      // Case 2: Đúng email nhưng sai mã
      const resWrongCode = await postWithdraw({
        email: applicantEmail,
        code: 'WRONGCODE999',
      })
      expect(resWrongCode.statusCode).toBe(404)
      expect(resWrongCode.json().message).toBe(expectedMessage)
    })

    it('Tra cứu sai lần thứ 6 trong 15 phút (cùng IP + email) nhận 429 rate_limited (SEC-05)', async () => {
      const ip = nextIp()
      const lookupFloodEmail = `lookup-flood-${tag}@test.local`

      const statuses: number[] = []
      for (let i = 0; i < 6; i++) {
        const res = await app.inject({
          method: 'POST',
          url: '/public/applications/lookup',
          remoteAddress: ip,
          headers: { origin: ORIGIN },
          payload: {
            email: lookupFloodEmail,
            code: 'WRONGCODE123',
          },
        })
        statuses.push(res.statusCode)
        if (i === 5) {
          expect(res.json().error).toBe('rate_limited')
        }
      }

      expect(statuses.slice(0, 5)).toEqual([404, 404, 404, 404, 404])
      expect(statuses[5]).toBe(429) // Lần thứ 6 chạm ngưỡng 5 lượt/15p
    })

    it('Lượt tra cứu ĐÚNG giải tỏa ô đếm: sai 4 lần, tra cứu đúng, rồi được sai thêm 5 lượt mới bị chặn (chỉ tính lượt sai)', async () => {
      const ip = nextIp()
      const wrong = { email: applicantEmail, code: 'WRONGCODE999' }
      for (let attempt = 0; attempt < 4; attempt++) {
        const res = await postLookup(wrong, { ip })
        expect(res.statusCode).toBe(404)
      }

      // Lượt đúng không tốn hạn mức và giải tỏa ô đếm
      const correctRes = await postLookup({ email: applicantEmail, code: testAppCode }, { ip })
      expect(correctRes.statusCode).toBe(200)

      // Sau khi giải tỏa, lại được sai đủ 5 lượt (nếu đếm cả lượt đúng thì đã dính 429)
      for (let attempt = 0; attempt < 5; attempt++) {
        const res = await postLookup(wrong, { ip })
        expect(res.statusCode).toBe(404)
      }
      const blockedRes = await postLookup(wrong, { ip })
      expect(blockedRes.statusCode).toBe(429)
    })

    it('Một IP spam nhiều email khác nhau trên tra cứu: lượt thứ 31 trong 15 phút nhận 429 theo địa chỉ nguồn (SEC-05)', async () => {
      const ip = nextIp()
      const statuses: number[] = []
      for (let attempt = 0; attempt < 31; attempt++) {
        const res = await postLookup(
          { email: `ip-flood-${attempt}-${tag}@test.local`, code: 'XXXXXXXXXXXX' },
          { ip },
        )
        statuses.push(res.statusCode)
      }
      expect(statuses.slice(0, 30).every((status) => status === 404)).toBe(true)
      expect(statuses[30]).toBe(429)
    })

    it('Ngưỡng đọc từ cấu hình: LOOKUP_MAX_ATTEMPTS=2 thì sai lần thứ 3 nhận 429 trên tra cứu hồ sơ', async () => {
      const testApp = buildApp(loadConfig({ NODE_ENV: 'test', LOOKUP_MAX_ATTEMPTS: '2' }))
      await testApp.ready()
      try {
        const testIp = nextIp()
        const wrongLookup = (email: string) =>
          testApp.inject({
            method: 'POST',
            url: '/public/applications/lookup',
            payload: { email, code: 'XXXXXXXXXXXX' },
            headers: { origin: ORIGIN },
            remoteAddress: testIp,
          })
        expect((await wrongLookup(`cfg-${tag}@test.local`)).statusCode).toBe(404)
        expect((await wrongLookup(`cfg-${tag}@test.local`)).statusCode).toBe(404)
        expect((await wrongLookup(`cfg-${tag}@test.local`)).statusCode).toBe(429)
      } finally {
        await testApp.close()
      }
    })

    it('Rút đơn bị từ chối 409 khi hồ sơ đã ở trạng thái ACCEPTED (kết quả cuối)', async () => {
      const acceptedCode = publicCode(12)
      const acceptedEmail = `accepted-${tag}@test.local`

      await db.membershipApplication.create({
        data: {
          profileCode: acceptedCode,
          recruitmentRoundId: lookupRoundId,
          applicantName: 'Ứng viên Đã Trúng Tuyển',
          applicantEmail: acceptedEmail,
          studentId: `AC${tag.slice(0, 6)}`,
          status: 'ACCEPTED',
        },
      })

      const res = await postWithdraw({
        email: acceptedEmail,
        code: acceptedCode,
      })

      expect(res.statusCode).toBe(409)
      expect(res.json().message).toContain('không ở trạng thái có thể rút')
    })

    it('Rút đơn thành công chuyển status sang WITHDRAWN, ghi audit không lộ mã và gửi email thông báo', async () => {
      const res = await postWithdraw({
        email: applicantEmail,
        code: testAppCode,
      })

      expect(res.statusCode).toBe(200)
      expect(res.json().status).toBe('WITHDRAWN')

      // Database được cập nhật
      const updated = await db.membershipApplication.findUniqueOrThrow({
        where: { profileCode: testAppCode },
      })
      expect(updated.status).toBe('WITHDRAWN')

      // Audit log được ghi, metadata không được chứa mã hồ sơ
      const auditLog = await db.auditLog.findFirst({
        where: {
          action: AUDIT_ACTIONS.APPLICATION_WITHDRAW,
          targetId: updated.id,
        },
      })
      expect(auditLog).not.toBeNull()
      expect(JSON.stringify(auditLog?.metadata)).not.toContain(testAppCode)

      // Email thông báo rút đơn có trong queue
      const email = await db.notificationDelivery.findFirst({
        where: {
          type: 'APPLICATION_STATUS',
          refId: updated.id,
        },
      })
      expect(email).not.toBeNull()
      expect(email?.status).toBe('PENDING')
      expect(email?.departmentId).toBe(deptAId) // Truyền đúng departmentId vào hàng đợi

      // Kiểm tra nội dung email: không để mã trên URL hay thông báo rút (QĐ-7 & OPS-11), nhãn tiếng Việt
      const renderedEmail = await EMAIL_TEMPLATES.APPLICATION_STATUS(updated.id)
      expect(renderedEmail).not.toBeNull()
      expect(renderedEmail?.html).toMatch(/href="https?:\/\/[^"]*\/recruitment\/application-lookup"/)
      expect(renderedEmail?.html).toContain('Đã rút đơn')
      expect(renderedEmail?.text).toContain('Đã rút đơn')
      expect(renderedEmail?.html).not.toContain(testAppCode)
    })

    it('Template APPLICATION_STATUS đổi các trạng thái sang nhãn tiếng Việt và link tuyệt đối', async () => {
      const dummyApp = await db.membershipApplication.create({
        data: {
          profileCode: publicCode(12),
          recruitmentRoundId: lookupRoundId,
          applicantName: 'Nguyễn Ứng Viên Test',
          applicantEmail: `template-test-${tag}@test.local`,
          studentId: `TT${tag.slice(0, 6)}`,
          status: 'INTERVIEW',
        },
      })

      const rendered = await EMAIL_TEMPLATES.APPLICATION_STATUS(dummyApp.id)
      expect(rendered).not.toBeNull()
      expect(rendered?.text).toContain('Mời phỏng vấn')
      expect(rendered?.html).toContain('Mời phỏng vấn')
      expect(rendered?.text).not.toContain('INTERVIEW') // Không in nguyên enum tiếng Anh
      expect(rendered?.html).toMatch(/href="https?:\/\/[^"]*\/recruitment\/application-lookup"/)

      // REC-08: REJECTED hiển thị "Không chấp nhận"
      expect(APPLICATION_STATUS_LABELS.REJECTED).toBe('Không chấp nhận')
      expect(APPLICATION_STATUS_LABELS.ACCEPTED).toBe('Đã chấp nhận')
    })

    it('Hồ sơ đã ở trạng thái WITHDRAWN không được rút tiếp (409)', async () => {
      const res = await postWithdraw({
        email: applicantEmail,
        code: testAppCode,
      })

      expect(res.statusCode).toBe(409)
      expect(res.json().message).toContain('không ở trạng thái có thể rút')
    })

    it('Hai request rút đơn gửi song song chỉ 1 request thành công 200, request kia trả 409, chỉ ghi 1 dòng audit và 1 email', async () => {
      const concurrentCode = publicCode(12)
      const concurrentEmail = `withdraw-concurrent-${tag}@test.local`

      const appRecord = await db.membershipApplication.create({
        data: {
          profileCode: concurrentCode,
          recruitmentRoundId: lookupRoundId,
          applicantName: 'Ứng viên Song Song',
          applicantEmail: concurrentEmail,
          studentId: `CC${tag.slice(0, 6)}`,
          status: 'NEW',
        },
      })

      const payload = { email: concurrentEmail, code: concurrentCode }
      const testIp = nextIp()

      const [resA, resB] = await Promise.all([
        postWithdraw(payload, { ip: testIp }),
        postWithdraw(payload, { ip: testIp }),
      ])

      const statusCodes = [resA.statusCode, resB.statusCode].sort()
      expect(statusCodes).toEqual([200, 409])

      // Database cập nhật sang WITHDRAWN
      const updated = await db.membershipApplication.findUniqueOrThrow({
        where: { id: appRecord.id },
      })
      expect(updated.status).toBe('WITHDRAWN')

      // Chỉ có duy nhất 1 dòng audit log
      const auditCount = await db.auditLog.count({
        where: {
          action: AUDIT_ACTIONS.APPLICATION_WITHDRAW,
          targetId: appRecord.id,
        },
      })
      expect(auditCount).toBe(1)

      // Chỉ có duy nhất 1 email trong hàng đợi
      const emailCount = await db.notificationDelivery.count({
        where: {
          type: 'APPLICATION_STATUS',
          refId: appRecord.id,
        },
      })
      expect(emailCount).toBe(1)
    })
  })

  describe('Xét hồ sơ ứng tuyển (R5)', () => {
    let r5RoundId: string
    let appDeptAId: string
    let appDeptBId: string

    beforeAll(async () => {
      // Tạo một đợt tuyển OPEN có cả 2 ban deptAId và deptBId
      const round = await db.recruitmentRound.create({
        data: {
          title: `Đợt R5 Test ${tag}`,
          slug: `r5-round-${tag}`,
          description: 'Mô tả đợt tuyển R5',
          status: 'OPEN',
          opensAt: new Date(Date.now() - 3600000),
          closesAt: new Date(Date.now() + 86400000 * 7),
          createdById: createdUserIds[0] as string,
          departments: {
            connect: [{ id: deptAId }, { id: deptBId }],
          },
        },
      })
      r5RoundId = round.id
      createdRoundIds.push(round.id)

      // Tạo hồ sơ nộp vào Ban A
      const appA = await db.membershipApplication.create({
        data: {
          profileCode: publicCode(),
          recruitmentRoundId: r5RoundId,
          applicantName: 'Ứng viên Ban A',
          applicantEmail: `applicant-a-${tag}@test.local`,
          studentId: `SV-A-${tag}`,
          desiredDepartmentId: deptAId,
          status: 'NEW',
        },
      })
      appDeptAId = appA.id

      // Tạo hồ sơ nộp vào Ban B
      const appB = await db.membershipApplication.create({
        data: {
          profileCode: publicCode(),
          recruitmentRoundId: r5RoundId,
          applicantName: 'Ứng viên Ban B',
          applicantEmail: `applicant-b-${tag}@test.local`,
          studentId: `SV-B-${tag}`,
          desiredDepartmentId: deptBId,
          status: 'NEW',
        },
      })
      appDeptBId = appB.id
    })

    it('GET /admin/recruitment/:id/applications: từ chối 401 khi chưa đăng nhập, 403 cho MEMBER', async () => {
      const resUnauth = await app.inject({
        method: 'GET',
        url: `/admin/recruitment/${r5RoundId}/applications`,
      })
      expect(resUnauth.statusCode).toBe(401)

      const resMember = await app.inject({
        method: 'GET',
        url: `/admin/recruitment/${r5RoundId}/applications`,
        cookies: { [SESSION_COOKIE]: memberToken },
      })
      expect(resMember.statusCode).toBe(403)
    })

    it('GET /admin/recruitment/:id/applications: BOARD thấy tất cả, Manager Ban A chỉ thấy hồ sơ Ban A', async () => {
      // BOARD
      const resBoard = await app.inject({
        method: 'GET',
        url: `/admin/recruitment/${r5RoundId}/applications`,
        cookies: { [SESSION_COOKIE]: boardToken },
      })
      expect(resBoard.statusCode).toBe(200)
      const dataBoard = resBoard.json()
      expect(dataBoard.total).toBe(2)
      expect(dataBoard.items.some((i: any) => i.id === appDeptAId)).toBe(true)
      expect(dataBoard.items.some((i: any) => i.id === appDeptBId)).toBe(true)

      // Manager Ban A
      const resManager = await app.inject({
        method: 'GET',
        url: `/admin/recruitment/${r5RoundId}/applications`,
        cookies: { [SESSION_COOKIE]: managerAToken },
      })
      expect(resManager.statusCode).toBe(200)
      const dataManager = resManager.json()
      expect(dataManager.total).toBe(1)
      expect(dataManager.items[0]?.id).toBe(appDeptAId)
      expect(dataManager.items[0]?.desiredDepartmentId).toBe(deptAId)
    })

    it('GET /admin/recruitment/:id/applications: hỗ trợ lọc từ khóa và trạng thái', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/admin/recruitment/${r5RoundId}/applications?search=SV-A-${tag}&status=NEW`,
        cookies: { [SESSION_COOKIE]: boardToken },
      })
      expect(res.statusCode).toBe(200)
      const data = res.json()
      expect(data.total).toBe(1)
      expect(data.items[0]?.id).toBe(appDeptAId)
    })

    it('GET /admin/recruitment/:id/applications/:applicationId: Manager Ban A mở hồ sơ Ban B nhận 404 (docs/02 §12)', async () => {
      // Manager Ban A mở hồ sơ Ban A -> 200
      const resA = await app.inject({
        method: 'GET',
        url: `/admin/recruitment/${r5RoundId}/applications/${appDeptAId}`,
        cookies: { [SESSION_COOKIE]: managerAToken },
      })
      expect(resA.statusCode).toBe(200)
      expect(resA.json().id).toBe(appDeptAId)

      // Manager Ban A mở hồ sơ Ban B -> 404
      const resB = await app.inject({
        method: 'GET',
        url: `/admin/recruitment/${r5RoundId}/applications/${appDeptBId}`,
        cookies: { [SESSION_COOKIE]: managerAToken },
      })
      expect(resB.statusCode).toBe(404)
    })

    it('PATCH /admin/recruitment/:id/applications/:applicationId/review: cập nhật ghi chú nội bộ và chống xung đột đồng thời', async () => {
      // Manager Ban A mở hồ sơ Ban B sửa ghi chú -> 404
      const resScopeFail = await app.inject({
        method: 'PATCH',
        url: `/admin/recruitment/${r5RoundId}/applications/${appDeptBId}/review`,
        cookies: { [SESSION_COOKIE]: managerAToken },
        headers: { origin: ORIGIN },
        payload: { internalNote: 'Ghi chú thử nghiệm' },
      })
      expect(resScopeFail.statusCode).toBe(404)

      // Gửi sai updatedAt -> 409
      const resConflict = await app.inject({
        method: 'PATCH',
        url: `/admin/recruitment/${r5RoundId}/applications/${appDeptAId}/review`,
        cookies: { [SESSION_COOKIE]: managerAToken },
        headers: { origin: ORIGIN },
        payload: {
          internalNote: 'Ghi chú thử nghiệm',
          updatedAt: new Date(Date.now() - 100000).toISOString(),
        },
      })
      expect(resConflict.statusCode).toBe(409)

      // Cập nhật thành công
      const resSuccess = await app.inject({
        method: 'PATCH',
        url: `/admin/recruitment/${r5RoundId}/applications/${appDeptAId}/review`,
        cookies: { [SESSION_COOKIE]: managerAToken },
        headers: { origin: ORIGIN },
        payload: { internalNote: 'Ứng viên có kỹ năng tốt' },
      })
      expect(resSuccess.statusCode).toBe(200)
      const data = resSuccess.json()
      expect(data.internalNote).toBe('Ứng viên có kỹ năng tốt')
      expect(data.reviewedById).toBeDefined()
      expect(data.reviewedAt).toBeDefined()
    })

    it('POST /admin/recruitment/:id/applications/:applicationId/status: bước chuyển sai trả 409 (BR-16)', async () => {
      // NEW -> ACCEPTED (bước chuyển sai, phải qua REVIEWING hoặc WITHDRAWN)
      const res = await app.inject({
        method: 'POST',
        url: `/admin/recruitment/${r5RoundId}/applications/${appDeptAId}/status`,
        cookies: { [SESSION_COOKIE]: boardToken },
        headers: { origin: ORIGIN },
        payload: { status: 'ACCEPTED' },
      })
      expect(res.statusCode).toBe(409)
    })

    it('POST /admin/recruitment/:id/applications/:applicationId/status: Manager Ban A chuyển NEW -> REVIEWING thành công, ghi lịch sử và KHÔNG gửi email', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/admin/recruitment/${r5RoundId}/applications/${appDeptAId}/status`,
        cookies: { [SESSION_COOKIE]: managerAToken },
        headers: { origin: ORIGIN },
        payload: { status: 'REVIEWING' },
      })
      expect(res.statusCode).toBe(200)
      const data = res.json()
      expect(data.status).toBe('REVIEWING')
      expect(data.history).toBeDefined()
      expect(data.history.fromStatus).toBe('NEW')
      expect(data.history.toStatus).toBe('REVIEWING')

      // Kiểm tra database có lịch sử
      const histories = await db.applicationStatusHistory.findMany({
        where: { applicationId: appDeptAId },
      })
      expect(histories.length).toBe(1)
      expect(histories[0]?.toStatus).toBe('REVIEWING')

      // NEW -> REVIEWING KHÔNG gửi email
      const emails = await db.notificationDelivery.findMany({
        where: { refType: 'APPLICATION', refId: appDeptAId, type: 'APPLICATION_STATUS' },
      })
      expect(emails.length).toBe(0)
    })

    it('POST /admin/recruitment/:id/applications/:applicationId/status: Manager Ban A chuyển REVIEWING -> INTERVIEW gửi email thông báo', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/admin/recruitment/${r5RoundId}/applications/${appDeptAId}/status`,
        cookies: { [SESSION_COOKIE]: managerAToken },
        headers: { origin: ORIGIN },
        payload: { status: 'INTERVIEW', reason: 'Hồ sơ đạt yêu cầu phỏng vấn' },
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().status).toBe('INTERVIEW')

      // CÓ gửi email thông báo cho ứng viên
      const emails = await db.notificationDelivery.findMany({
        where: { refType: 'APPLICATION', refId: appDeptAId, type: 'APPLICATION_STATUS' },
      })
      expect(emails.length).toBe(1)
    })

    it('POST /admin/recruitment/:id/applications/:applicationId/status: Manager cố chốt ACCEPTED hoặc REJECTED bị từ chối 403 (docs/02 §8.1)', async () => {
      const resAccepted = await app.inject({
        method: 'POST',
        url: `/admin/recruitment/${r5RoundId}/applications/${appDeptAId}/status`,
        cookies: { [SESSION_COOKIE]: managerAToken },
        headers: { origin: ORIGIN },
        payload: { status: 'ACCEPTED' },
      })
      expect(resAccepted.statusCode).toBe(403)

      const resRejected = await app.inject({
        method: 'POST',
        url: `/admin/recruitment/${r5RoundId}/applications/${appDeptAId}/status`,
        cookies: { [SESSION_COOKIE]: managerAToken },
        headers: { origin: ORIGIN },
        payload: { status: 'REJECTED' },
      })
      expect(resRejected.statusCode).toBe(403)
    })

    it('POST /admin/recruitment/:id/applications/:applicationId/status: BOARD chốt ACCEPTED thành công và ghi audit RECRUITMENT_FINALIZE', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/admin/recruitment/${r5RoundId}/applications/${appDeptAId}/status`,
        cookies: { [SESSION_COOKIE]: boardToken },
        headers: { origin: ORIGIN },
        payload: { status: 'ACCEPTED' },
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().status).toBe('ACCEPTED')

      // Audit log chốt kết quả
      const auditLog = await db.auditLog.findFirst({
        where: {
          action: AUDIT_ACTIONS.RECRUITMENT_FINALIZE,
          targetId: appDeptAId,
        },
      })
      expect(auditLog).toBeDefined()

      // Hồ sơ ACCEPTED là trạng thái cuối, cố chuyển tiếp nhận 409
      const resPostTerminal = await app.inject({
        method: 'POST',
        url: `/admin/recruitment/${r5RoundId}/applications/${appDeptAId}/status`,
        cookies: { [SESSION_COOKIE]: boardToken },
        headers: { origin: ORIGIN },
        payload: { status: 'REJECTED' },
      })
      expect(resPostTerminal.statusCode).toBe(409)
    })

    it('POST /admin/recruitment/:id/applications/:applicationId/status: BOARD rút đơn thay ứng viên bắt buộc lý do (reason)', async () => {
      // Rút đơn trên appDeptB (đang ở NEW) nhưng không có lý do -> 422
      const resNoReason = await app.inject({
        method: 'POST',
        url: `/admin/recruitment/${r5RoundId}/applications/${appDeptBId}/status`,
        cookies: { [SESSION_COOKIE]: boardToken },
        headers: { origin: ORIGIN },
        payload: { status: 'WITHDRAWN', reason: '' },
      })
      expect(resNoReason.statusCode).toBe(422)

      // Rút đơn kèm lý do -> 200
      const resWithReason = await app.inject({
        method: 'POST',
        url: `/admin/recruitment/${r5RoundId}/applications/${appDeptBId}/status`,
        cookies: { [SESSION_COOKIE]: boardToken },
        headers: { origin: ORIGIN },
        payload: { status: 'WITHDRAWN', reason: 'Ứng viên gửi email yêu cầu rút đơn' },
      })
      expect(resWithReason.statusCode).toBe(200)
      expect(resWithReason.json().status).toBe('WITHDRAWN')

      // Kiểm tra lịch sử có ghi lý do
      const history = await db.applicationStatusHistory.findFirst({
        where: { applicationId: appDeptBId, toStatus: 'WITHDRAWN' },
      })
      expect(history?.reason).toBe('Ứng viên gửi email yêu cầu rút đơn')
    })

    it('POST /admin/recruitment/:id/applications/export: xuất CSV danh sách hồ sơ trong phạm vi quyền', async () => {
      // Manager Ban A chỉ xuất hồ sơ Ban A
      const resManager = await app.inject({
        method: 'POST',
        url: `/admin/recruitment/${r5RoundId}/applications/export`,
        cookies: { [SESSION_COOKIE]: managerAToken },
        headers: { origin: ORIGIN },
      })
      expect(resManager.statusCode).toBe(200)
      const dataManager = resManager.json()
      expect(dataManager.rowCount).toBe(1)
      expect(dataManager.csv).toContain('Ứng viên Ban A')
      expect(dataManager.csv).not.toContain('Ứng viên Ban B')
      expect(dataManager.csv.startsWith('\uFEFF')).toBe(true)

      // BOARD xuất được cả Ban A và Ban B
      const resBoard = await app.inject({
        method: 'POST',
        url: `/admin/recruitment/${r5RoundId}/applications/export`,
        cookies: { [SESSION_COOKIE]: boardToken },
        headers: { origin: ORIGIN },
      })
      expect(resBoard.statusCode).toBe(200)
      const dataBoard = resBoard.json()
      expect(dataBoard.rowCount).toBe(2)
      expect(dataBoard.csv).toContain('Ứng viên Ban A')
      expect(dataBoard.csv).toContain('Ứng viên Ban B')

      // GET export tải trực tiếp file CSV với Content-Disposition
      const resGet = await app.inject({
        method: 'GET',
        url: `/admin/recruitment/${r5RoundId}/applications/export`,
        cookies: { [SESSION_COOKIE]: boardToken },
      })
      expect(resGet.statusCode).toBe(200)
      expect(resGet.headers['content-type']).toContain('text/csv')
      expect(resGet.headers['content-disposition']).toContain('attachment; filename=')
      expect(resGet.payload).toContain('Ứng viên Ban A')
    })

    it('Tích hợp Email & Audit (QĐ-7, NTF-01, B1): mẫu email tiếng Việt không lộ mã hồ sơ, audit không lưu thông tin nhạy cảm', async () => {
      // 1. Kiểm tra mẫu email APPLICATION_STATUS
      const emailContent = await EMAIL_TEMPLATES.APPLICATION_STATUS(appDeptAId)
      expect(emailContent).toBeDefined()
      expect(emailContent?.subject).toContain('Cập nhật trạng thái hồ sơ tuyển thành viên')
      expect(emailContent?.text).toContain('Đã chấp nhận')
      expect(emailContent?.text).toContain('/recruitment/application-lookup')
      // Tuyệt đối không chứa mã tra cứu profileCode hay ghi chú nội bộ (BR-07, QĐ-7)
      const appRecord = await db.membershipApplication.findUniqueOrThrow({
        where: { id: appDeptAId },
        select: { profileCode: true, internalNote: true },
      })
      expect(emailContent?.text).not.toContain(appRecord.profileCode)
      expect(emailContent?.html).not.toContain(appRecord.profileCode)
      if (appRecord.internalNote) {
        expect(emailContent?.text).not.toContain(appRecord.internalNote)
        expect(emailContent?.html).not.toContain(appRecord.internalNote)
      }

      // 2. Kiểm tra Audit logs liên quan đến hồ sơ: không chứa mã hồ sơ trong metadata (B1, docs/02 §11)
      const audits = await db.auditLog.findMany({
        where: {
          targetType: 'APPLICATION',
          targetId: appDeptAId,
        },
      })
      expect(audits.length).toBeGreaterThan(0)
      for (const a of audits) {
        const metaStr = JSON.stringify(a.metadata ?? {})
        expect(metaStr).not.toContain(appRecord.profileCode)
        if (appRecord.internalNote) {
          expect(metaStr).not.toContain(appRecord.internalNote)
        }
      }
    })

    it('Mỗi bước chuyển hợp lệ tạo đúng một dòng lịch sử trong database với đầy đủ thông tin', async () => {
      const histories = await db.applicationStatusHistory.findMany({
        where: { applicationId: appDeptAId },
        orderBy: { changedAt: 'asc' },
      })
      // 3 bước chuyển: NEW -> REVIEWING -> INTERVIEW -> ACCEPTED
      expect(histories.length).toBe(3)
      expect(histories[0]?.fromStatus).toBe('NEW')
      expect(histories[0]?.toStatus).toBe('REVIEWING')
      expect(histories[1]?.fromStatus).toBe('REVIEWING')
      expect(histories[1]?.toStatus).toBe('INTERVIEW')
      expect(histories[2]?.fromStatus).toBe('INTERVIEW')
      expect(histories[2]?.toStatus).toBe('ACCEPTED')
      expect(histories.every((h) => Boolean(h.changedById))).toBe(true)
    })

    it('Ghi chú nội bộ và thông tin đánh giá không bị lộ trong API tra cứu công khai POST /public/applications/lookup (BR-07)', async () => {
      const appRecord = await db.membershipApplication.findUniqueOrThrow({
        where: { id: appDeptAId },
        select: { applicantEmail: true, profileCode: true, internalNote: true },
      })
      expect(appRecord.internalNote).toBeTruthy()

      const res = await app.inject({
        method: 'POST',
        url: '/public/applications/lookup',
        headers: { origin: ORIGIN, 'x-forwarded-for': nextIp() },
        payload: {
          email: appRecord.applicantEmail,
          code: appRecord.profileCode,
        },
      })

      expect(res.statusCode).toBe(200)
      const data = res.json()
      expect(data.internalNote).toBeUndefined()
      expect(data.reviewedById).toBeUndefined()
      expect(data.reviewedAt).toBeUndefined()
      expect(data.answers).toBeUndefined()
      expect(Object.keys(data)).not.toContain('internalNote')
    })

    it('Hai người cùng sửa một hồ sơ đồng thời: người lưu sau nhận 409 (chuyển trạng thái & ghi chú)', async () => {
      // 1. Race condition trên chuyển trạng thái (POST /status)
      const concurrentApp = await db.membershipApplication.create({
        data: {
          profileCode: publicCode(),
          recruitmentRoundId: r5RoundId,
          applicantName: 'Ứng viên Concurrency',
          applicantEmail: `applicant-race-${tag}@test.local`,
          studentId: `SV-RACE-${tag}`,
          desiredDepartmentId: deptAId,
          status: 'NEW',
        },
      })

      // Cả hai người đồng thời gửi request chuyển NEW -> REVIEWING
      const [statusRes1, statusRes2] = await Promise.all([
        app.inject({
          method: 'POST',
          url: `/admin/recruitment/${r5RoundId}/applications/${concurrentApp.id}/status`,
          cookies: { [SESSION_COOKIE]: boardToken },
          headers: { origin: ORIGIN },
          payload: { status: 'REVIEWING' },
        }),
        app.inject({
          method: 'POST',
          url: `/admin/recruitment/${r5RoundId}/applications/${concurrentApp.id}/status`,
          cookies: { [SESSION_COOKIE]: boardToken },
          headers: { origin: ORIGIN },
          payload: { status: 'REVIEWING' },
        }),
      ])

      const statusCodes = [statusRes1.statusCode, statusRes2.statusCode].sort()
      // Một người thành công (200), người lưu sau nhận xung đột (409)
      expect(statusCodes).toEqual([200, 409])

      // 2. Concurrency trên sửa ghi chú nội bộ (PATCH /review)
      const freshApp = await db.membershipApplication.findUniqueOrThrow({
        where: { id: concurrentApp.id },
      })
      const staleUpdatedAt = freshApp.updatedAt.toISOString()

      // Người thứ nhất lưu ghi chú thành công
      const reviewRes1 = await app.inject({
        method: 'PATCH',
        url: `/admin/recruitment/${r5RoundId}/applications/${concurrentApp.id}/review`,
        cookies: { [SESSION_COOKIE]: managerAToken },
        headers: { origin: ORIGIN },
        payload: {
          internalNote: 'Ghi chú của người 1',
          updatedAt: staleUpdatedAt,
        },
      })
      expect(reviewRes1.statusCode).toBe(200)

      // Người thứ hai gửi lưu ghi chú dựa trên dữ liệu cũ trước khi tải lại -> nhận 409
      const reviewRes2 = await app.inject({
        method: 'PATCH',
        url: `/admin/recruitment/${r5RoundId}/applications/${concurrentApp.id}/review`,
        cookies: { [SESSION_COOKIE]: managerAToken },
        headers: { origin: ORIGIN },
        payload: {
          internalNote: 'Ghi chú của người 2',
          updatedAt: staleUpdatedAt,
        },
      })
      expect(reviewRes2.statusCode).toBe(409)
      expect(reviewRes2.json().error).toBe('conflict')
    })
  })

  // ─── R6: CHUYỂN HỒ SƠ THÀNH THÀNH VIÊN (FLOW-08, BR-06, STATE-03) ───────────
  describe('R6: Chuyển hồ sơ thành thành viên (FLOW-08, BR-06, STATE-03)', () => {
    let r6RoundId: string
    let acceptedAppId: string
    let r6AppEmail: string
    let r6AppStudentId: string
    let r6TempPassword = ''

    beforeAll(async () => {
      // Tạo một đợt tuyển riêng cho test R6
      const round = await db.recruitmentRound.create({
        data: {
          title: `Đợt tuyển R6 ${tag}`,
          slug: `round-r6-${tag}`,
          description: 'Mô tả đợt tuyển R6',
          audience: 'Sinh viên UMT',
          requirements: 'Yêu thích lập trình',
          opensAt: new Date(Date.now() - 3600000),
          closesAt: new Date(Date.now() + 86400000),
          status: 'OPEN',
          createdById: boardUserId,
          departments: { connect: [{ id: deptAId }, { id: deptBId }] },
        },
      })
      r6RoundId = round.id
      createdRoundIds.push(round.id)

      r6AppEmail = `candidate-r6-${tag}@test.local`
      r6AppStudentId = `SV-R6-${tag}`

      // Hồ sơ ACCEPTED
      const acceptedApp = await db.membershipApplication.create({
        data: {
          profileCode: publicCode(),
          recruitmentRoundId: r6RoundId,
          applicantName: 'Nguyễn Văn An',
          applicantEmail: r6AppEmail,
          studentId: r6AppStudentId,
          faculty: 'Công nghệ thông tin',
          major: 'Kỹ thuật phần mềm',
          cohort: 'K2024',
          desiredDepartmentId: deptAId,
          skills: 'TypeScript, React, Node.js',
          answers: { phone: '0901234567' },
          status: 'ACCEPTED',
        },
      })
      acceptedAppId = acceptedApp.id
    })

    // ─── 1. PHÂN QUYỀN RBAC ─────────────────────────────────────────────────
    it('Chỉ BOARD mới có quyền gọi suggest-username; Manager và Member nhận 403, khách nhận 401', async () => {
      // Khách không phiên -> 401
      const resGuest = await app.inject({
        method: 'GET',
        url: `/admin/recruitment/${r6RoundId}/applications/${acceptedAppId}/suggest-username`,
        headers: { origin: ORIGIN },
      })
      expect(resGuest.statusCode).toBe(401)

      // Member -> 403
      const resMember = await app.inject({
        method: 'GET',
        url: `/admin/recruitment/${r6RoundId}/applications/${acceptedAppId}/suggest-username`,
        cookies: { [SESSION_COOKIE]: memberToken },
        headers: { origin: ORIGIN },
      })
      expect(resMember.statusCode).toBe(403)

      // Manager -> 403
      const resManager = await app.inject({
        method: 'GET',
        url: `/admin/recruitment/${r6RoundId}/applications/${acceptedAppId}/suggest-username`,
        cookies: { [SESSION_COOKIE]: managerAToken },
        headers: { origin: ORIGIN },
      })
      expect(resManager.statusCode).toBe(403)

      // BOARD -> 200
      const resBoard = await app.inject({
        method: 'GET',
        url: `/admin/recruitment/${r6RoundId}/applications/${acceptedAppId}/suggest-username`,
        cookies: { [SESSION_COOKIE]: boardToken },
        headers: { origin: ORIGIN },
      })
      expect(resBoard.statusCode).toBe(200)
    })

    it('Chỉ BOARD mới có quyền convert hồ sơ; Manager và Member nhận 403, khách nhận 401', async () => {
      const payload = { username: `user-test-${tag}` }

      // Khách -> 401
      const resGuest = await app.inject({
        method: 'POST',
        url: `/admin/recruitment/${r6RoundId}/applications/${acceptedAppId}/convert`,
        headers: { origin: ORIGIN },
        payload,
      })
      expect(resGuest.statusCode).toBe(401)

      // Member -> 403
      const resMember = await app.inject({
        method: 'POST',
        url: `/admin/recruitment/${r6RoundId}/applications/${acceptedAppId}/convert`,
        cookies: { [SESSION_COOKIE]: memberToken },
        headers: { origin: ORIGIN },
        payload,
      })
      expect(resMember.statusCode).toBe(403)

      // Manager -> 403
      const resManager = await app.inject({
        method: 'POST',
        url: `/admin/recruitment/${r6RoundId}/applications/${acceptedAppId}/convert`,
        cookies: { [SESSION_COOKIE]: managerAToken },
        headers: { origin: ORIGIN },
        payload,
      })
      expect(resManager.statusCode).toBe(403)
    })

    // ─── 2. ĐỀ XUẤT TÊN ĐĂNG NHẬP (API 1) ──────────────────────────────────
    it('Đề xuất tên đăng nhập chuẩn hóa họ tên không dấu và tự động thêm số nếu đã trùng trong bảng User', async () => {
      // Ứng viên Nguyễn Văn An -> nguyen.van.an
      const res1 = await app.inject({
        method: 'GET',
        url: `/admin/recruitment/${r6RoundId}/applications/${acceptedAppId}/suggest-username`,
        cookies: { [SESSION_COOKIE]: boardToken },
        headers: { origin: ORIGIN },
      })
      expect(res1.statusCode).toBe(200)
      expect(res1.json()).toEqual({ suggestedUsername: 'nguyen.van.an' })

      // Tạo một user đã có tên nguyen.van.an
      const conflictUser1 = await db.user.create({
        data: {
          username: 'nguyen.van.an',
          email: `temp-an1-${tag}@test.local`,
          fullName: 'Nguyen Van An Da Co',
          passwordHash: 'dummy',
          status: 'ACTIVE',
        },
      })
      createdUserIds.push(conflictUser1.id)

      // Gọi lại -> đề xuất nguyen.van.an1
      const res2 = await app.inject({
        method: 'GET',
        url: `/admin/recruitment/${r6RoundId}/applications/${acceptedAppId}/suggest-username`,
        cookies: { [SESSION_COOKIE]: boardToken },
        headers: { origin: ORIGIN },
      })
      expect(res2.statusCode).toBe(200)
      expect(res2.json()).toEqual({ suggestedUsername: 'nguyen.van.an1' })

      // Tạo tiếp nguyen.van.an1
      const conflictUser2 = await db.user.create({
        data: {
          username: 'nguyen.van.an1',
          email: `temp-an2-${tag}@test.local`,
          fullName: 'Nguyen Van An 1 Da Co',
          passwordHash: 'dummy',
          status: 'ACTIVE',
        },
      })
      createdUserIds.push(conflictUser2.id)

      // Gọi lại -> đề xuất nguyen.van.an2
      const res3 = await app.inject({
        method: 'GET',
        url: `/admin/recruitment/${r6RoundId}/applications/${acceptedAppId}/suggest-username`,
        cookies: { [SESSION_COOKIE]: boardToken },
        headers: { origin: ORIGIN },
      })
      expect(res3.statusCode).toBe(200)
      expect(res3.json()).toEqual({ suggestedUsername: 'nguyen.van.an2' })

      // Test ứng viên có tên chữ đ: Đỗ Đức Đạt
      const datApp = await db.membershipApplication.create({
        data: {
          profileCode: publicCode(),
          recruitmentRoundId: r6RoundId,
          applicantName: 'Đỗ Đức Đạt',
          applicantEmail: `dat-${tag}@test.local`,
          studentId: `SV-DAT-${tag}`,
          desiredDepartmentId: deptAId,
          status: 'ACCEPTED',
        },
      })
      const resDat = await app.inject({
        method: 'GET',
        url: `/admin/recruitment/${r6RoundId}/applications/${datApp.id}/suggest-username`,
        cookies: { [SESSION_COOKIE]: boardToken },
        headers: { origin: ORIGIN },
      })
      expect(resDat.statusCode).toBe(200)
      expect(resDat.json().suggestedUsername).toBe('do.duc.dat')
    })

    // ─── 3. VALIDATION VÀ ĐIỀU KIỆN LỖI CHUYỂN THÀNH VIÊN (API 2) ───────────
    it('Chuyển hồ sơ không ở trạng thái ACCEPTED (NEW, REVIEWING, INTERVIEW, REJECTED, WITHDRAWN) trả 409 Conflict (BR-06)', async () => {
      const nonAcceptedStatuses = ['NEW', 'REVIEWING', 'INTERVIEW', 'REJECTED', 'WITHDRAWN'] as const

      for (const st of nonAcceptedStatuses) {
        const testApp = await db.membershipApplication.create({
          data: {
            profileCode: publicCode(),
            recruitmentRoundId: r6RoundId,
            applicantName: `Ứng viên test status ${st}`,
            applicantEmail: `status-${st.toLowerCase()}-${tag}@test.local`,
            studentId: `SV-${st}-${tag}`,
            desiredDepartmentId: deptAId,
            status: st,
          },
        })

        const res = await app.inject({
          method: 'POST',
          url: `/admin/recruitment/${r6RoundId}/applications/${testApp.id}/convert`,
          cookies: { [SESSION_COOKIE]: boardToken },
          headers: { origin: ORIGIN },
          payload: { username: `user.${st.toLowerCase()}-${tag}` },
        })
        expect(res.statusCode).toBe(409)
        expect(res.json().error).toBe('conflict')
        expect(res.json().message).toContain('Chỉ hồ sơ ở trạng thái Đã chấp nhận mới có thể chuyển thành viên.')
      }
    })

    it('Chống trùng thành viên: Email hoặc MSSV đã thuộc User khác trả 409 kèm existingUserId', async () => {
      // 1. Trùng email: tạo user có email trùng với applicantEmail của hồ sơ
      const dupEmailUser = await db.user.create({
        data: {
          username: `dup-email-${tag}`,
          email: `dup-candidate-${tag}@test.local`,
          studentId: `SV-OTHER-${tag}`,
          fullName: 'Duplicate Email User',
          passwordHash: 'dummy',
          status: 'ACTIVE',
        },
      })
      createdUserIds.push(dupEmailUser.id)

      const dupEmailApp = await db.membershipApplication.create({
        data: {
          profileCode: publicCode(),
          recruitmentRoundId: r6RoundId,
          applicantName: 'Ứng viên Trùng Email',
          applicantEmail: `dup-candidate-${tag}@test.local`,
          studentId: `SV-UNIQUE-1-${tag}`,
          desiredDepartmentId: deptAId,
          status: 'ACCEPTED',
        },
      })

      const resEmail = await app.inject({
        method: 'POST',
        url: `/admin/recruitment/${r6RoundId}/applications/${dupEmailApp.id}/convert`,
        cookies: { [SESSION_COOKIE]: boardToken },
        headers: { origin: ORIGIN },
        payload: { username: `valid.user-${tag}` },
      })
      expect(resEmail.statusCode).toBe(409)
      expect(resEmail.json().existingUserId).toBe(dupEmailUser.id)
      expect(resEmail.json().message).toContain(dupEmailUser.username)

      // 2. Trùng studentId: tạo user có studentId trùng với hồ sơ
      const dupStudentUser = await db.user.create({
        data: {
          username: `dup-student-${tag}`,
          email: `other-email-${tag}@test.local`,
          studentId: `SV-DUP-${tag}`,
          fullName: 'Duplicate Student User',
          passwordHash: 'dummy',
          status: 'ACTIVE',
        },
      })
      createdUserIds.push(dupStudentUser.id)

      const dupStudentApp = await db.membershipApplication.create({
        data: {
          profileCode: publicCode(),
          recruitmentRoundId: r6RoundId,
          applicantName: 'Ứng viên Trùng MSSV',
          applicantEmail: `unique-email-${tag}@test.local`,
          studentId: `SV-DUP-${tag}`,
          desiredDepartmentId: deptAId,
          status: 'ACCEPTED',
        },
      })

      const resStudent = await app.inject({
        method: 'POST',
        url: `/admin/recruitment/${r6RoundId}/applications/${dupStudentApp.id}/convert`,
        cookies: { [SESSION_COOKIE]: boardToken },
        headers: { origin: ORIGIN },
        payload: { username: `valid.user2-${tag}` },
      })
      expect(resStudent.statusCode).toBe(409)
      expect(resStudent.json().existingUserId).toBe(dupStudentUser.id)
      expect(resStudent.json().message).toContain(dupStudentUser.username)
    })

    it('Validate input username không hợp lệ (có dấu tiếng Việt, chữ hoa, ký tự lạ) trả 422', async () => {
      const invalidApp = await db.membershipApplication.create({
        data: {
          profileCode: publicCode(),
          recruitmentRoundId: r6RoundId,
          applicantName: 'Ứng viên Test Validation',
          applicantEmail: `val-${tag}@test.local`,
          studentId: `SV-VAL-${tag}`,
          desiredDepartmentId: deptAId,
          status: 'ACCEPTED',
        },
      })

      const invalidUsernames = [
        'NguyễnVănAn', // có dấu
        'NGUYEN_AN', // chữ hoa
        'an', // quá ngắn (< 3)
        'an@name', // ký tự @ không hợp lệ
        'an space', // có khoảng trắng
      ]

      for (const username of invalidUsernames) {
        const res = await app.inject({
          method: 'POST',
          url: `/admin/recruitment/${r6RoundId}/applications/${invalidApp.id}/convert`,
          cookies: { [SESSION_COOKIE]: boardToken },
          headers: { origin: ORIGIN },
          payload: { username },
        })
        expect(res.statusCode).toBe(422)
      }
    })

    // ─── 4. CHUYỂN THÀNH VIÊN THÀNH CÔNG VÀ KIỂM TRA MẬT KHẨU TẠM (STATE-03) ──
    it('Chuyển thành viên thành công: User được tạo ở PENDING_ACTIVATION, trả mật khẩu tạm một lần, ghi audit log an toàn', async () => {
      const convertPayload = {
        username: `an.nguyen.${tag}`,
        departmentId: deptAId,
      }

      const res = await app.inject({
        method: 'POST',
        url: `/admin/recruitment/${r6RoundId}/applications/${acceptedAppId}/convert`,
        cookies: { [SESSION_COOKIE]: boardToken },
        headers: { origin: ORIGIN },
        payload: convertPayload,
      })

      expect(res.statusCode).toBe(200)
      const data = res.json()
      expect(data.alreadyConverted).toBe(false)
      expect(data.user).toBeDefined()
      expect(data.user.username).toBe(convertPayload.username)
      expect(data.user.email).toBe(r6AppEmail)

      // Kiểm tra mật khẩu tạm được trả về trong API response
      expect(data.temporaryPassword).toBeDefined()
      expect(typeof data.temporaryPassword).toBe('string')
      expect(data.temporaryPassword).toMatch(/^[a-zA-Z0-9]{5}-[a-zA-Z0-9]{5}-[a-zA-Z0-9]{5}-[a-zA-Z0-9]{5}$/)
      r6TempPassword = data.temporaryPassword

      const createdUserId = data.user.id
      createdUserIds.push(createdUserId)

      // Kiểm tra User trong database
      const dbUser = await db.user.findUniqueOrThrow({
        where: { id: createdUserId },
      })
      expect(dbUser.status).toBe('PENDING_ACTIVATION')
      expect(dbUser.isTemporaryPassword).toBe(true)
      expect(dbUser.mustChangePassword).toBe(true)
      expect(dbUser.temporaryPasswordExpiresAt).toBeDefined()
      expect(dbUser.studentId).toBe(r6AppStudentId)
      expect(dbUser.faculty).toBe('Công nghệ thông tin')
      expect(dbUser.major).toBe('Kỹ thuật phần mềm')
      expect(dbUser.cohort).toBe('K2024')
      expect(dbUser.departmentId).toBe(deptAId)
      expect(dbUser.phoneNumber).toBe('0901234567')
      expect(dbUser.skills).toEqual(['TypeScript', 'React', 'Node.js'])

      // Kiểm tra đơn ứng tuyển đã được liên kết
      const dbApp = await db.membershipApplication.findUniqueOrThrow({
        where: { id: acceptedAppId },
      })
      expect(dbApp.convertedUserId).toBe(createdUserId)
      expect(dbApp.convertedAt).not.toBeNull()

      // Kiểm tra Audit Log: có action 'application.convert_user' và 'account.create'
      const convertAudits = await db.auditLog.findMany({
        where: {
          targetType: 'APPLICATION',
          targetId: acceptedAppId,
          action: AUDIT_ACTIONS.APPLICATION_CONVERT_USER,
        },
      })
      expect(convertAudits.length).toBe(1)
      expect(convertAudits[0]?.metadata).toEqual({
        userId: createdUserId,
        username: convertPayload.username,
      })

      // STATE-03: Tuyệt đối không lưu mật khẩu tạm vào bất kỳ audit log nào
      const allAudits = await db.auditLog.findMany({
        where: {
          OR: [
            { targetId: acceptedAppId },
            { targetId: createdUserId },
          ],
        },
      })
      for (const a of allAudits) {
        const metaStr = JSON.stringify(a.metadata ?? {})
        expect(metaStr).not.toContain(data.temporaryPassword)
      }

      // NTF-05 & STATE-03: Tuyệt đối không enqueue email chứa mật khẩu tạm thời
      const allNotificationDeliveries = await db.notificationDelivery.findMany()
      for (const delivery of allNotificationDeliveries) {
        const deliveryStr = JSON.stringify(delivery)
        expect(deliveryStr).not.toContain(data.temporaryPassword)
      }
    })

    it('Đăng nhập bằng mật khẩu tạm: Tài khoản PENDING_ACTIVATION đăng nhập được, có mustChangePassword: true, bị chặn tại route bảo vệ và kích hoạt thành công qua /auth/activate', async () => {
      // 1. Đăng nhập bằng username và mật khẩu tạm vừa được cấp
      const loginRes = await app.inject({
        method: 'POST',
        url: '/auth/login',
        headers: { origin: ORIGIN },
        payload: {
          username: `an.nguyen.${tag}`,
          password: r6TempPassword,
        },
      })
      expect(loginRes.statusCode).toBe(200)
      const loginData = loginRes.json()
      expect(loginData.status).toBe('PENDING_ACTIVATION')
      expect(loginData.mustChangePassword).toBe(true)

      const memberCookie = loginRes.headers['set-cookie']
      expect(memberCookie).toBeDefined()
      const rawCookie = Array.isArray(memberCookie) ? memberCookie[0]! : memberCookie!
      const memberSessionToken = rawCookie.split(';')[0]!.split('=')[1]!

      // 2. Chặn quyền khi truy cập route thành viên /portal/me/profile (403 Forbidden do pendingActivation)
      const portalRes = await app.inject({
        method: 'GET',
        url: '/portal/me/profile',
        cookies: { [SESSION_COOKIE]: memberSessionToken },
        headers: { origin: ORIGIN },
      })
      expect(portalRes.statusCode).toBe(403)
      expect(portalRes.json().error).toBe('forbidden')
      expect(portalRes.json().message).toContain('Bạn cần đổi mật khẩu tạm thời')

      // 3. /auth/me vẫn cho phép truy cập để lấy thông tin phiên
      const meRes = await app.inject({
        method: 'GET',
        url: '/auth/me',
        cookies: { [SESSION_COOKIE]: memberSessionToken },
      })
      expect(meRes.statusCode).toBe(200)
      expect(meRes.json().status).toBe('PENDING_ACTIVATION')
      expect(meRes.json().mustChangePassword).toBe(true)

      // 4. Kích hoạt tài khoản qua /auth/activate: đổi mật khẩu mới (yêu cầu ít nhất 15 ký tự và confirmPassword)
      const newPassword = 'MatKhauMoiCucKyBaoMat2026!'
      const activateRes = await app.inject({
        method: 'POST',
        url: '/auth/activate',
        cookies: { [SESSION_COOKIE]: memberSessionToken },
        headers: { origin: ORIGIN },
        payload: {
          newPassword,
          confirmPassword: newPassword,
        },
      })
      expect(activateRes.statusCode).toBe(200)
      const activateData = activateRes.json()
      expect(activateData.status).toBe('ACTIVE')
      expect(activateData.mustChangePassword).toBe(false)

      const newCookie = activateRes.headers['set-cookie']
      const activeRawCookie = Array.isArray(newCookie) ? newCookie[0]! : newCookie!
      const activeSessionToken = activeRawCookie.split(';')[0]!.split('=')[1]!

      // 5. Sau khi kích hoạt: truy cập route thành viên /portal/me/profile thành công
      const portalResAfter = await app.inject({
        method: 'GET',
        url: '/portal/me/profile',
        cookies: { [SESSION_COOKIE]: activeSessionToken },
        headers: { origin: ORIGIN },
      })
      expect(portalResAfter.statusCode).toBe(200)
      expect(portalResAfter.json().username).toBe(`an.nguyen.${tag}`)
    })

    it('Nếu có lỗi xảy ra trong quá trình tạo (vd ban không ACTIVE): rollback toàn bộ transaction, không tạo dở dang bản ghi', async () => {
      // Tạo một ban ARCHIVED
      const archivedDept = await db.department.create({
        data: {
          name: `Ban Luu Tru ${tag}`,
          code: `ARC-${tag}`,
          status: 'ARCHIVED',
        },
      })
      createdDeptIds.push(archivedDept.id)

      const rollbackApp = await db.membershipApplication.create({
        data: {
          profileCode: publicCode(),
          recruitmentRoundId: r6RoundId,
          applicantName: 'Ứng viên Test Rollback',
          applicantEmail: `rollback-${tag}@test.local`,
          studentId: `SV-ROLLBACK-${tag}`,
          desiredDepartmentId: deptAId,
          status: 'ACCEPTED',
        },
      })

      const targetUsername = `rollback.user.${tag}`

      const res = await app.inject({
        method: 'POST',
        url: `/admin/recruitment/${r6RoundId}/applications/${rollbackApp.id}/convert`,
        cookies: { [SESSION_COOKIE]: boardToken },
        headers: { origin: ORIGIN },
        payload: {
          username: targetUsername,
          departmentId: archivedDept.id, // Ban ARCHIVED -> createAccount ném lỗi
        },
      })

      expect(res.statusCode).toBe(422)

      // Kiểm tra User không hề tồn tại trong database (đã rollback)
      const userInDb = await db.user.findUnique({
        where: { username: targetUsername },
      })
      expect(userInDb).toBeNull()

      // Kiểm tra hồ sơ không bị cập nhật dở dang
      const appInDb = await db.membershipApplication.findUniqueOrThrow({
        where: { id: rollbackApp.id },
      })
      expect(appInDb.convertedUserId).toBeNull()
      expect(appInDb.convertedAt).toBeNull()

      // Kiểm tra không có audit log dở dang
      const auditInDb = await db.auditLog.findFirst({
        where: {
          targetType: 'APPLICATION',
          targetId: rollbackApp.id,
          action: AUDIT_ACTIONS.APPLICATION_CONVERT_USER,
        },
      })
      expect(auditInDb).toBeNull()
    })

    // ─── 5. IDEMPOTENT KHI GỌI LẠI CONVERT ──────────────────────────────────
    it('Gọi lại convert trên đơn đã chuyển: trả alreadyConverted: true kèm thông tin User, không tạo tài khoản mới', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/admin/recruitment/${r6RoundId}/applications/${acceptedAppId}/convert`,
        cookies: { [SESSION_COOKIE]: boardToken },
        headers: { origin: ORIGIN },
        payload: {
          username: `an.nguyen.different.${tag}`,
        },
      })

      expect(res.statusCode).toBe(200)
      const data = res.json()
      expect(data.alreadyConverted).toBe(true)
      expect(data.user).toBeDefined()
      expect(data.user.username).toBe(`an.nguyen.${tag}`)
      // Không cấp lại mật khẩu tạm khi đã convert
      expect(data.temporaryPassword).toBeUndefined()
    })
  })
})

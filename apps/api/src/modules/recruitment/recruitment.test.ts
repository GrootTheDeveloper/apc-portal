import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { buildApp } from '../../app.js'
import { loadConfig } from '../../config.js'
import { db } from '../../db/client.js'
import { AUDIT_ACTIONS } from '../audit/service.js'
import { createSession, SESSION_COOKIE } from '../auth/session.js'
import { closeExpiredRecruitmentRounds } from './service.js'
import { EMAIL_TEMPLATES } from '../email/templates.js'


let ipCounter = 200
const nextIp = () => `10.8.${Math.floor(++ipCounter / 250)}.${ipCounter % 250}`
const config = loadConfig({ NODE_ENV: 'test' })
const app = buildApp(config)
const tag = randomUUID().slice(0, 8)
const ORIGIN = config.WEB_URL

let boardToken: string
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
    await db.auditLog.deleteMany({
      where: { targetId: { in: createdRoundIds } },
    })

    // Lấy danh sách hồ sơ test đã tạo để dọn consent và email
    const apps = await db.membershipApplication.findMany({
      where: { recruitmentRoundId: { in: createdRoundIds } },
      select: { id: true },
    })
    const appIds = apps.map((a) => a.id)
    if (appIds.length > 0) {
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

    it('Nộp đơn thành công 201; câu hidden bắt buộc không chặn nộp đơn; gửi lặp Idempotency-Key trả kết quả cũ', async () => {
      const idempotencyKey = `idem-${randomUUID()}`

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
})
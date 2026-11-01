import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { buildApp } from '../../app.js'
import { loadConfig } from '../../config.js'
import { db } from '../../db/client.js'
import { createSession, SESSION_COOKIE } from '../auth/session.js'
import { closeExpiredRecruitmentRounds } from './service.js'

const config = loadConfig({ NODE_ENV: 'test' })
const app = buildApp(config)
const tag = randomUUID().slice(0, 8)
const ORIGIN = config.WEB_URL

let boardToken: string
let managerAToken: string
let _memberToken: string
let deptAId: string
let deptBId: string

const createdRoundIds: string[] = []
const createdUserIds: string[] = []
const createdDeptIds: string[] = []

beforeAll(async () => {
  await app.ready()

  const yesterday = new Date(Date.now() - 24*60*60*1000)

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
  boardToken = await createSession(boardUser.id, { ipAddress: '127.0.0.1', userAgent: 'test' })

  // 3. Tạo User DEPARTMENT_MANAGER Ban A
  const managerAUser = await db.user.create({
    data: {
      username: `manager-${tag}`,
      email: `manager-${tag}@test.local`,
      fullName: 'Manager Test',
      passwordHash: 'dummy',
      status: 'ACTIVE',
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
  managerAToken = await createSession(managerAUser.id, { ipAddress: '127.0.0.1', userAgent: 'test' })

  // 4. Tạo User MEMBER bình thường
  const memberUser = await db.user.create({
    data: {
      username: `member-${tag}`,
      email: `member-${tag}@test.local`,
      fullName: 'Member Test',
      passwordHash: 'dummy',
      status: 'ACTIVE',
    },
  })
  createdUserIds.push(memberUser.id)
  _memberToken = await createSession(memberUser.id, { ipAddress: '127.0.0.1', userAgent: 'test' })
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
    }
  })

  // ─── 2. QUẢN TRỊ: TẠO ĐỢT TUYỂN (POST /admin/recruitment) ───────────────
  it('Từ chối khi chưa đăng nhập (401) hoặc sai vai trò (403 cho manager/member)', async () => {
    // 401 khi chưa đăng nhập
    const noAuth = await app.inject({
      method: 'POST',
      url: '/admin/recruitment',
      headers: { origin: ORIGIN },
      payload: {},
    })
    expect(noAuth.statusCode).toBe(401)

    // 403 khi manager hoặc member gọi
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
        closesAt: '2026-11-05T00:00:00.000Z', // Trước opensAt
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

  // ─── 3. CHUYỂN TRẠNG THÁI ───────────────────────────────────────────────
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

    // Bây giờ API công khai xem được
    const pubRes = await app.inject({
      method: 'GET',
      url: `/public/recruitment-rounds/${roundSlug}`,
    })
    expect(pubRes.statusCode).toBe(200)
  })

  // ─── 4. PHÂN QUYỀN XEM ĐỢT TUYỂN CỦA QUẢN LÝ BAN ───────────────────────
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

  // ─── 5. QUY TẮC CÂU HỎI KHI ĐÃ CÓ HỒ SƠ (REC-15) ────────────────────────
  it('Khi đã có hồ sơ: Xóa câu hỏi hoặc đổi kiểu câu bị từ chối 409', async () => {
    // Thử xóa câu hỏi q2
    const deleteQ = await app.inject({
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
        ],
      },
    })
    expect(deleteQ.statusCode).toBe(409)

    // Thử đổi kiểu câu q1 từ short_text sang long_text
    const changeType = await app.inject({
      method: 'PATCH',
      url: `/admin/recruitment/${createdRoundId}`,
      cookies: { [SESSION_COOKIE]: boardToken },
      headers: { origin: ORIGIN },
      payload: {
        questions: [
          {
            id: 'q1',
            type: 'long_text', // Đổi kiểu
            label: 'Link Github của bạn?',
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
    expect(changeType.statusCode).toBe(409)

    // Ẩn câu hỏi (hidden: true) thì được phép thành công
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
  })

  // ─── 6. TÁC VỤ NỀN: TỰ ĐỘNG ĐÓNG ĐỢT QUÁ HẠN ───────────────────────────
  it('Tác vụ đóng đợt tự động chuyển OPEN quá hạn sang CLOSED trong database', async () => {
    // Đặt closesAt về quá khứ
    await db.recruitmentRound.update({
      where: { id: createdRoundId },
      data: { closesAt: new Date(Date.now() - 1000) },
    })

    // Chạy tác vụ
    await closeExpiredRecruitmentRounds()

    // Kiểm tra trong database
    const roundInDb = await db.recruitmentRound.findUnique({
      where: { id: createdRoundId },
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
        cookies: { [SESSION_COOKIE]: _memberToken },
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

      // Kiểm tra ConsentRecord được tạo kèm
      const consent = await db.consentRecord.findFirst({
        where: {
          purpose: 'RECRUITMENT_PROCESSING',
          subjectType: 'APPLICATION',
        },
      })
      expect(consent).not.toBeNull()

      // Kiểm tra Email xác nhận có trong hàng đợi NotificationDelivery
      const emailDelivery = await db.notificationDelivery.findFirst({
        where: {
          type: 'APPLICATION_SUBMITTED',
          recipient: basePayload.applicantEmail.toLowerCase(),
        },
      })
      expect(emailDelivery).not.toBeNull()
      expect(emailDelivery?.status).toBe('PENDING')
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
  })
})
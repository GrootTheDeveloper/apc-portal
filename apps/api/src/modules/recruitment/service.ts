import { z } from 'zod'

import type { FastifyRequest } from 'fastify'
import { db } from '../../db/client.js'
import type { Prisma, RecruitmentRoundStatus } from '../../db/generated/client.js'
import { conflict, notFound } from '../../lib/errors.js'
import { pageArgs, pageQuery, toPage } from '../../lib/pagination.js'
import { AUDIT_ACTIONS, audit, AuditCategory, AuditResult } from '../audit/service.js'
import type { AuthUser } from '../auth/rbac.js'
import { hasRole } from '../auth/rbac.js'
import type { Question } from './validation.js'
import {
  ChangeRoundStatusSchema,
  CreateRecruitmentRoundSchema,
  UpdateRecruitmentRoundSchema,
} from './validation.js'
import { publicCode } from '../../lib/ids.js'
import {AppError, forbidden,} from '../../lib/errors.js'
import { recordConsent } from '../consent/service.js'
import { enqueueEmail } from '../email/service.js'
import { SubmitApplicationSchema } from './validation.js'


/**
 * 1. API CÔNG KHAI
 */
const publicRoundListQuery = pageQuery.extend({
  pageSize: z.coerce.number().int().min(1).max(100).default(12),
})

const adminRoundListQuery = pageQuery.extend({
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})

/**
 * 1. API CÔNG KHAI
 */

export async function listPublicRecruitmentRounds(rawQuery: unknown) {
  const query = publicRoundListQuery.parse(rawQuery)
  const where = {
    status: { in: ['OPEN', 'CLOSED'] as RecruitmentRoundStatus[] },
  }

  const [total, items] = await Promise.all([
    db.recruitmentRound.count({ where }),
    db.recruitmentRound.findMany({
      where,
      ...pageArgs(query),
      orderBy: [{ status: 'asc' }, { opensAt: 'desc' }],
      include: {
        departments: {
          select: { id: true, name: true, code: true, description: true },
        },
      },
    }),
  ])

  return toPage(items, total, query)
}

export async function getPublicRecruitmentRoundBySlug(slug: string) {
  const round = await db.recruitmentRound.findFirst({
    where: {
      slug,
      status: { in: ['OPEN', 'CLOSED'] as RecruitmentRoundStatus[] },
    },
    include: {
      departments: {
        select: { id: true, name: true, code: true, description: true },
      },
    },
  })

  if (!round) throw notFound()
  return round
}

/**
 * 2. API QUẢN TRỊ (ADMIN)
 */

export async function listAdminRecruitmentRounds(user: AuthUser, rawQuery: unknown) {
  const query = adminRoundListQuery.parse(rawQuery)

  // BOARD thấy tất cả; DEPARTMENT_MANAGER chỉ thấy đợt có hồ sơ nộp vào ban mình
  let where: Record<string, unknown> = {}
  if (!hasRole(user, 'BOARD')) {
    const managerDeptIds = user.roles
      .filter((r) => r.role === 'DEPARTMENT_MANAGER' && r.departmentId)
      .map((r) => r.departmentId as string)

    where = {
      applications: {
        some: {
          desiredDepartmentId: { in: managerDeptIds },
        },
      },
    }
  }

  const [total, items] = await Promise.all([
    db.recruitmentRound.count({ where }),
    db.recruitmentRound.findMany({
      where,
      ...pageArgs(query),
      orderBy: { createdAt: 'desc' },
      include: {
        departments: { select: { id: true, name: true, code: true } },
        _count: { select: { applications: true } },
      },
    }),
  ])

  return toPage(items, total, query)
}

export async function getAdminRecruitmentRoundById(id: string, user: AuthUser) {
  const round = await db.recruitmentRound.findUnique({
    where: { id },
    include: {
      departments: { select: { id: true, name: true, code: true, description: true } },
      _count: { select: { applications: true } },
    },
  })

  if (!round) throw notFound()

  // Phân quyền đọc: BOARD xem tất cả, DEPARTMENT_MANAGER chỉ xem nếu đợt có hồ sơ thuộc ban mình
  if (!hasRole(user, 'BOARD')) {
    const managerDeptIds = user.roles
      .filter((r) => r.role === 'DEPARTMENT_MANAGER' && r.departmentId)
      .map((r) => r.departmentId as string)

    const hasApp = await db.membershipApplication.findFirst({
      where: {
        recruitmentRoundId: id,
        desiredDepartmentId: { in: managerDeptIds },
      },
    })

    if (!hasApp) throw notFound() // Trả 404 thay vì 403 để không lộ dữ liệu (docs/02 §12)
  }

  return round
}

export async function createRecruitmentRound(request: FastifyRequest, body: unknown, user: AuthUser) {
  const data = CreateRecruitmentRoundSchema.parse(body)

  // Kiểm tra trùng slug
  const existing = await db.recruitmentRound.findUnique({ where: { slug: data.slug } })
  if (existing) throw conflict('Slug này đã tồn tại, vui lòng chọn slug khác')

  return db.$transaction(async (tx) => {
    const round = await tx.recruitmentRound.create({
      data: {
        title: data.title,
        slug: data.slug,
        description: data.description,
        audience: data.audience,
        requirements: data.requirements,
        opensAt: new Date(data.opensAt),
        closesAt: new Date(data.closesAt),
        questions: data.questions,
        createdById: user.id,
        departments: {
          connect: data.departmentIds.map((id) => ({ id })),
        },
      },
      include: { departments: true },
    })

    await audit(
      request,
      {
        action: AUDIT_ACTIONS.RECRUITMENT_CREATE_ROUND,
        targetType: 'RecruitmentRound',
        targetId: round.id,
        category: AuditCategory.BUSINESS,
        result: AuditResult.SUCCESS,
        metadata: { title: round.title, slug: round.slug },
      },
      tx,
    )

    return round
  })
}

/**
 * Kiểm tra sửa câu hỏi khi đợt đã có hồ sơ (REC-15):
 * Không đổi type, không xóa câu, không xóa lựa chọn đã có người chọn; chỉ được ẩn (hidden = true).
 */
function validateQuestionsUpdate(oldQuestions: Question[], newQuestions: Question[]) {
  const oldMap = new Map(oldQuestions.map((q) => [q.id, q]))
  const newMap = new Map(newQuestions.map((q) => [q.id, q]))

  // 1. Không được xóa câu hỏi cũ
  for (const [id, oldQ] of oldMap.entries()) {
    const newQ = newMap.get(id)
    if (!newQ) {
      throw conflict(`Không thể xóa câu hỏi "${oldQ.label}" khi đợt tuyển đã có hồ sơ. Bạn chỉ có thể ẩn câu hỏi.`)
    }

    // 2. Không được đổi kiểu câu hỏi
    if (oldQ.type !== newQ.type) {
      throw conflict(`Không thể đổi kiểu câu hỏi "${oldQ.label}" từ ${oldQ.type} sang ${newQ.type}`)
    }

    // 3. Không được xóa option cũ
    if (oldQ.options && oldQ.options.length > 0) {
      const newOptionIds = new Set((newQ.options ?? []).map((o) => o.id))
      for (const opt of oldQ.options) {
        if (!newOptionIds.has(opt.id)) {
          throw conflict(`Không thể xóa lựa chọn "${opt.label}" trong câu "${oldQ.label}" khi đợt tuyển đã có hồ sơ`)
        }
      }
    }
  }
}

export async function updateRecruitmentRound(id: string, body: unknown) {
  const data = UpdateRecruitmentRoundSchema.parse(body)

  const round = await db.recruitmentRound.findUnique({
    where: { id },
    include: { _count: { select: { applications: true } } },
  })
  if (!round) throw notFound()

  // Kiểm tra thời gian nếu cập nhật 1 trong 2
  const opensAt = data.opensAt ? new Date(data.opensAt) : round.opensAt
  const closesAt = data.closesAt ? new Date(data.closesAt) : round.closesAt
  if (closesAt <= opensAt) {
    throw conflict('Thời gian kết thúc phải sau thời gian bắt đầu')
  }

  // Kiểm tra câu hỏi nếu đã có hồ sơ
  if (data.questions && round._count.applications > 0) {
    const oldQuestions = (round.questions as unknown as Question[]) || []
    validateQuestionsUpdate(oldQuestions, data.questions)
  }

  return db.recruitmentRound.update({
    where: { id },
    data: {
      ...(data.title && { title: data.title }),
      ...(data.slug && { slug: data.slug }),
      ...(data.description && { description: data.description }),
      ...(data.audience && { audience: data.audience }),
      ...(data.requirements && { requirements: data.requirements }),
      ...(data.opensAt && { opensAt }),
      ...(data.closesAt && { closesAt }),
      ...(data.questions && { questions: data.questions }),
      ...(data.departmentIds && {
        departments: {
          set: data.departmentIds.map((deptId) => ({ id: deptId })),
        },
      }),
    },
    include: { departments: true },
  })
}

/**
 * Chuyển trạng thái theo máy trạng thái PRD 9.2:
 * DRAFT -> OPEN -> CLOSED -> ARCHIVED
 */
export async function changeRecruitmentRoundStatus(
  request: FastifyRequest,
  id: string,
  body: unknown,
) {
  const { status: targetStatus } = ChangeRoundStatusSchema.parse(body)

  const round = await db.recruitmentRound.findUnique({ where: { id } })
  if (!round) throw notFound()

  const current = round.status
  const validTransitions: Record<RecruitmentRoundStatus, RecruitmentRoundStatus[]> = {
    DRAFT: ['OPEN'],
    OPEN: ['CLOSED'],
    CLOSED: ['ARCHIVED'],
    ARCHIVED: [],
  }

  if (!validTransitions[current].includes(targetStatus)) {
    throw conflict(`Không thể chuyển trạng thái từ ${current} sang ${targetStatus}`)
  }

  const updateData: { status: RecruitmentRoundStatus; closesAt?: Date } = {
    status: targetStatus,
  }

  // Nếu đóng sớm khi đang OPEN: đặt closesAt = hiện tại (REC-16)
  if (targetStatus === 'CLOSED' && current === 'OPEN') {
    updateData.closesAt = new Date()
  }

  return db.$transaction(async (tx) => {
    const updated = await tx.recruitmentRound.update({
      where: { id },
      data: updateData,
    })

    await audit(
      request,
      {
        action: AUDIT_ACTIONS.RECRUITMENT_CREATE_ROUND,
        targetType: 'RecruitmentRound',
        targetId: round.id,
        category: AuditCategory.BUSINESS,
        result: AuditResult.SUCCESS,
        metadata: { fromStatus: current, toStatus: targetStatus },
      },
      tx,
    )

    return updated
  })
}

/**
 * 3. TÁC VỤ NỀN: Tự động đóng đợt OPEN đã hết hạn (REC-16)
 */
export async function closeExpiredRecruitmentRounds() {
  const now = new Date()
  const expiredRounds = await db.recruitmentRound.findMany({
    where: {
      status: 'OPEN',
      closesAt: { lte: now },
    },
  })

  for (const round of expiredRounds) {
    await db.$transaction(async (tx) => {
      await tx.recruitmentRound.update({
        where: { id: round.id },
        data: { status: 'CLOSED' },
      })

      await audit(
        { service: 'round-close' },
        {
          action: AUDIT_ACTIONS.RECRUITMENT_CREATE_ROUND,
          targetType: 'RecruitmentRound',
          targetId: round.id,
          category: AuditCategory.BUSINESS,
          result: AuditResult.SUCCESS,
          metadata: { reason: 'Tự động đóng do hết hạn', closesAt: round.closesAt },
        },
        tx,
      )
    })
  }
}
/**
 * 4. NỘP ĐƠN ỨNG TUYỂN (R3, FLOW-04)
 */
export async function submitApplication(
  slug: string,
  rawBody: unknown,
  idempotencyKey?: string,
  user?: AuthUser | null,
) {
  // 1. Thành viên/Admin đã đăng nhập không được nộp đơn tuyển
  if (user) {
    throw forbidden('Người đã đăng nhập không thể nộp đơn ứng tuyển.')
  }

  // 2. Chống gửi lặp: kiểm tra Idempotency-Key (FLOW-04, STATE-01)
  if (idempotencyKey) {
    const existingApp = await db.membershipApplication.findUnique({
      where: { idempotencyKey },
      include: { recruitmentRound: true },
    })
    if (existingApp) {
      return {
        profileCode: existingApp.profileCode,
        applicantName: existingApp.applicantName,
        applicantEmail: existingApp.applicantEmail,
        roundTitle: existingApp.recruitmentRound.title,
        submittedAt: existingApp.submittedAt.toISOString(),
      }
    }
  }

  // 3. Validate dữ liệu đầu vào bằng Zod
  const input = SubmitApplicationSchema.parse(rawBody)

  // 4. Kiểm tra đợt tuyển: phải OPEN và trong thời hạn nhận đơn
  const round = await db.recruitmentRound.findUnique({
    where: { slug },
    include: { departments: true },
  })
  if (!round || round.status !== 'OPEN') {
    throw notFound('Không tìm thấy đợt tuyển hoặc đợt tuyển chưa mở nhận đơn.')
  }

  const now = new Date()
  if (now < round.opensAt || now > round.closesAt) {
    throw conflict('Đợt tuyển hiện không trong thời gian nhận đơn.')
  }

  // 5. Kiểm tra ban mong muốn phải thuộc đợt tuyển
  const validDeptIds = round.departments.map((d) => d.id)
  if (!validDeptIds.includes(input.desiredDepartmentId)) {
    throw new AppError(422, 'validation', 'Ban chuyên môn được chọn không thuộc đợt tuyển này.')
  }

  // 6. Kiểm tra các câu hỏi bắt buộc (bỏ qua câu bị ẩn hidden)
  const questions = (round.questions as unknown as Question[]) || []
  for (const q of questions) {
    if (q.hidden) continue

    if (q.required) {
      const val = input.answers?.[q.id]
      const isEmpty =
        val === undefined ||
        val === null ||
        (typeof val === 'string' && val.trim() === '') ||
        (Array.isArray(val) && val.length === 0)
      if (isEmpty) {
        throw new AppError(422, 'validation', `Vui lòng trả lời câu hỏi bắt buộc: ${q.label}`)
      }
    }
  }

  // 7. Lưu hồ sơ, lưu consent và xếp email trong cùng 1 Transaction
  try {
    return await db.$transaction(async (tx) => {
      // Kiểm tra trùng email hoặc MSSV trong đợt tuyển (REC-05, BR-05, QĐ-1)
      const existingApp = await tx.membershipApplication.findFirst({
        where: {
          recruitmentRoundId: round.id,
          OR: [
            { applicantEmail: input.applicantEmail.toLowerCase() },
            { studentId: input.studentId },
          ],
        },
      })
      if (existingApp) {
        throw conflict('Không thể nộp đơn với thông tin này. Nếu đã nộp, vui lòng dùng trang tra cứu.')
      }

      // Sinh mã hồ sơ công khai ngẫu nhiên (REC-06, không tuần tự)
      const code = publicCode(12)

      const application = await tx.membershipApplication.create({
        data: {
          profileCode: code,
          recruitmentRoundId: round.id,
          applicantName: input.applicantName,
          applicantEmail: input.applicantEmail.toLowerCase(),
          studentId: input.studentId,
          faculty: input.faculty || null,
          major: input.major || null,
          cohort: input.cohort || null,
          desiredDepartmentId: input.desiredDepartmentId,
          skills: input.skills || null,
          experience: input.experience || null,
          answers: (input.answers ?? {}) as Prisma.InputJsonValue,
          idempotencyKey: idempotencyKey || null,
          status: 'NEW',
        },
      })

      // Ghi nhận sự đồng ý xử lý dữ liệu (B2, DATA-07)
      await recordConsent(tx, {
        subjectType: 'APPLICATION',
        subjectId: application.id,
        purpose: 'RECRUITMENT_PROCESSING',
      })

      // Xếp email xác nhận vào hàng đợi (O1, NTF-01)
      await enqueueEmail(tx, {
        type: 'APPLICATION_SUBMITTED',
        to: application.applicantEmail,
        refType: 'APPLICATION',
        refId: application.id,
        departmentId: input.desiredDepartmentId,
      })

      return {
        profileCode: application.profileCode,
        applicantName: application.applicantName,
        applicantEmail: application.applicantEmail,
        roundTitle: round.title,
        submittedAt: application.submittedAt.toISOString(),
      }
    })
  } catch (error: any) {
    // Bắt trường hợp race condition P2002 do trùng email hoặc MSSV đồng thời
    if (error?.code === 'P2002') {
      if (error?.meta?.target?.includes?.('idempotencyKey') && idempotencyKey) {
        const existing = await db.membershipApplication.findUnique({
          where: { idempotencyKey },
          include: { recruitmentRound: true },
        })
        if (existing) {
          return {
            profileCode: existing.profileCode,
            applicantName: existing.applicantName,
            applicantEmail: existing.applicantEmail,
            roundTitle: existing.recruitmentRound.title,
            submittedAt: existing.submittedAt.toISOString(),
          }
        }
      }
      throw conflict('Không thể nộp đơn với thông tin này. Nếu đã nộp, vui lòng dùng trang tra cứu.')
    }
    throw error
  }
}
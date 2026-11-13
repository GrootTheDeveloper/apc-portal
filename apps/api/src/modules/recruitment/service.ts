import { z, ZodError } from 'zod'

import type { FastifyRequest } from 'fastify'
import { db } from '../../db/client.js'
import type { Prisma, RecruitmentRoundStatus } from '../../db/generated/client.js'
import { AppError, conflict, forbidden, notFound } from '../../lib/errors.js'
import { publicCode } from '../../lib/ids.js'
import { pageArgs, pageQuery, toPage } from '../../lib/pagination.js'
import { AUDIT_ACTIONS, audit, AuditCategory, AuditResult } from '../audit/service.js'
import type { AuthUser } from '../auth/rbac.js'
import { hasRole } from '../auth/rbac.js'
import { recordConsent } from '../consent/service.js'
import { enqueueEmail } from '../email/service.js'
import { createAccount } from '../accounts/service.js'
import type { Question } from './validation.js'
import {
  AdminApplicationExportQuerySchema,
  AdminApplicationQuerySchema,
  ChangeApplicationStatusSchema,
  ChangeRoundStatusSchema,
  ConvertApplicationSchema,
  CreateRecruitmentRoundSchema,
  LookupApplicationSchema,
  SubmitApplicationSchema,
  UpdateApplicationReviewSchema,
  UpdateRecruitmentRoundSchema,
  WithdrawApplicationSchema,
} from './validation.js'
/**
 * 1. API CÔNG KHAI
 */
const publicRoundListQuery = pageQuery.extend({
  pageSize: z.coerce.number().int().min(1).max(100).default(12),
})

const adminRoundListQuery = pageQuery.extend({
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['DRAFT', 'OPEN', 'CLOSED', 'ARCHIVED']).optional(),
})

// Hàm lọc và chỉ trả về các trường công khai, giấu createdById, updatedAt và lọc bỏ câu hỏi ẩn
function toPublicRound(r: {
  id: string
  title: string
  slug: string
  description: string
  audience: string
  requirements: string
  status: RecruitmentRoundStatus
  opensAt: Date
  closesAt: Date
  departments: Array<{ id: string; name: string; code: string; description: string | null }>
  questions: unknown
}) {
  const rawQuestions = Array.isArray(r.questions) ? r.questions : []
  // Lọc bỏ câu hidden: true và không trả thuộc tính hidden ra ngoài
  const publicQuestions = (
    rawQuestions as Array<{
      id: string
      type: string
      label: string
      required?: boolean
      options?: unknown[]
      hidden?: boolean
    }>
  )
    .filter((q) => !q.hidden)
    .map(({ hidden: _hidden, ...q }) => q)
  return {
    id: r.id,
    title: r.title,
    slug: r.slug,
    description: r.description,
    audience: r.audience,
    requirements: r.requirements,
    status: r.status,
    opensAt: r.opensAt,
    closesAt: r.closesAt,
    departments: r.departments,
    questions: publicQuestions,
  }
}

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
  // Sử dụng toPublicRound để lọc dữ liệu
  return toPage(items.map(toPublicRound), total, query)
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
  return toPublicRound(round)
}

/**
 * 2. API QUẢN TRỊ (ADMIN)
 */

export async function listAdminRecruitmentRounds(user: AuthUser, rawQuery: unknown) {
  const query = adminRoundListQuery.parse(rawQuery)
    // Nếu có lọc theo trạng thái
  // BOARD thấy tất cả; DEPARTMENT_MANAGER chỉ thấy đợt có hồ sơ nộp vào ban mình
  let where: Record<string, unknown> = {}
    // Nếu có lọc theo trạng thái
  if (query.status) {
    where.status = query.status
  }
  const isBoard = hasRole(user, 'BOARD')
  const managerDeptIds = user.roles.filter((r) => r.role === 'DEPARTMENT_MANAGER' && r.departmentId).map((r) => r.departmentId as string)
  
  if (!isBoard) {
    
    where = {
      applications: {
        some: {
          desiredDepartmentId: { in: managerDeptIds },
        },
      },
    }
  }
  // Nếu là trưởng ban thì chỉ đếm đơn nộp vào ban mình (REC-15 / Reviewer comment)
  const appCountFilter = isBoard ? true : {where: { desiredDepartmentId : { in: managerDeptIds} } }

  const [total, items] = await Promise.all([
    db.recruitmentRound.count({ where }),
    db.recruitmentRound.findMany({
      where,
      ...pageArgs(query),
      orderBy: { createdAt: 'desc' },
      include: {
        departments: { select: { id: true, name: true, code: true } },
        _count: { select: { applications: appCountFilter } },
      },
    }),
  ])

  return toPage(items, total, query)
}

export async function getAdminRecruitmentRoundById(id: string, user: AuthUser) {
  const isBoard = hasRole(user, 'BOARD')
  const managerDeptIds = user.roles.filter((r) => r.role === 'DEPARTMENT_MANAGER' && r.departmentId).map((r) => r.departmentId as string)

  const appCountFilter = isBoard ? true : { where: {desiredDepartmentId : {in: managerDeptIds} } }
  
  const round = await db.recruitmentRound.findUnique({
    where: { id },
    include: {
      departments: { select: { id: true, name: true, code: true, description: true } },
      _count: { select: { applications: appCountFilter } },
    },
  })

  if (!round) throw notFound()

  // Phân quyền đọc: BOARD xem tất cả, DEPARTMENT_MANAGER chỉ xem nếu đợt có hồ sơ thuộc ban mình
  if (!isBoard) {
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
  // Kiểm tra ban phải tồn tại và đang ACTIVE (Reviewer Item 10)
  const activeDepts = await db.department.count({
    where: { id: { in: data.departmentIds }, status: 'ACTIVE' },
  })
  if (activeDepts !== data.departmentIds.length) {
    throw new AppError(422, 'validation', 'Một hoặc nhiều ban được chọn không tồn tại hoặc không còn hoạt động')
  }

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

export async function updateRecruitmentRound(request: FastifyRequest, id: string, body: unknown) {
  const data = UpdateRecruitmentRoundSchema.parse(body)
  if (data.departmentIds) {
    const activeDepts = await db.department.count({
      where: { id: { in: data.departmentIds }, status: 'ACTIVE' },
    })
    if (activeDepts !== data.departmentIds.length) {
      throw new AppError(422, 'validation', 'Một hoặc nhiều ban được chọn không tồn tại hoặc không còn hoạt động')
    }
  }

  return db.$transaction(async (tx) => {
    // Khóa dòng đợt tuyển bằng FOR UPDATE trước khi đếm đơn (tránh R3 nộp đơn chen ngang)
    await tx.$queryRaw`SELECT id FROM "recruitment_rounds" WHERE id = ${id} FOR UPDATE`

    const round = await tx.recruitmentRound.findUnique({
      where: { id },
      include: { _count: { select: { applications: true } } },
    })
    if (!round) throw notFound()

    // 1. Không cho sửa đợt đã CLOSED hoặc ARCHIVED
    if (round.status === 'CLOSED' || round.status === 'ARCHIVED') {
      throw conflict(`Không thể chỉnh sửa đợt tuyển đang ở trạng thái ${round.status}`)
    }

    const now = new Date()

    // 2. Ràng buộc khi đợt đang OPEN
    if (round.status === 'OPEN') {
      if (data.slug && data.slug !== round.slug) {
        throw conflict('Không thể thay đổi đường dẫn (slug) khi đợt tuyển đang mở')
      }
      if (round.opensAt <= now && data.opensAt && new Date(data.opensAt).getTime() !== round.opensAt.getTime()) {
        throw conflict('Không thể thay đổi thời gian bắt đầu khi đợt tuyển đã mở')
      }
      if (data.closesAt && new Date(data.closesAt) < round.closesAt) {
        throw conflict('Thời gian kết thúc chỉ được phép dời về sau khi đợt tuyển đang mở')
      }
    }

    // 3. Kiểm tra tính hợp lệ của ngày
    const opensAt = data.opensAt ? new Date(data.opensAt) : round.opensAt
    const closesAt = data.closesAt ? new Date(data.closesAt) : round.closesAt
    if (closesAt <= opensAt) {
      throw new AppError(422, 'validation', 'Thời gian đóng nhận đơn phải sau thời gian mở')
    }

    // 4. Không cho bỏ ban đã có hồ sơ đăng ký (đếm đơn khi đã giữ khóa FOR UPDATE)
    if (data.departmentIds) {
      const removedDeptWithApp = await tx.membershipApplication.findFirst({
        where: {
          recruitmentRoundId: id,
          desiredDepartmentId: { notIn: data.departmentIds },
        },
      })
      if (removedDeptWithApp) {
        throw conflict('Không thể bỏ ban đã có hồ sơ đăng ký ứng tuyển')
      }
    }

    // 5. Kiểm tra sửa câu hỏi nếu đã có hồ sơ
    if (data.questions && round._count.applications > 0) {
      const oldQuestions = (round.questions as unknown as Question[]) || []
      validateQuestionsUpdate(oldQuestions, data.questions)
    }

    const updated = await tx.recruitmentRound.update({
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

    await audit(
      request,
      {
        action: AUDIT_ACTIONS.RECRUITMENT_UPDATE_ROUND,
        targetType: 'RecruitmentRound',
        targetId: round.id,
        category: AuditCategory.BUSINESS,
        result: AuditResult.SUCCESS,
        metadata: { title: updated.title, slug: updated.slug },
      },
      tx,
    )

    return updated
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

  const now = new Date()

  // Chặn mở đợt khi closeAt đã ở quá khứ
  if (targetStatus === 'OPEN' && round.closesAt <= now){
    throw conflict('Không thể mở đợt tuyển có thời gian đóng trong quá khứ. Vui lòng gia hạn thời gian đóng trước.')
  }

  const updateData: { status: RecruitmentRoundStatus; closesAt?: Date } = {
    status: targetStatus,
  }

  // Nếu đóng sớm khi đang OPEN: đặt closesAt = hiện tại (REC-16)
  if (targetStatus === 'CLOSED' && current === 'OPEN') {
    // Chặn đóng sớm khi opensAt còn ở tương lai (chưa mở thì không đóng sớm)
    if (round.opensAt > now){
      throw conflict('Không thể đóng đợt tuyển khi chưa đến thời gian mở')
    }
    updateData.closesAt = now
  }

  return db.$transaction(async (tx) => {
    // Dùng updateMany với điều kiện status: current để chống bấm 2 lần ghi 2 audit
    const  { count } = await tx.recruitmentRound.updateMany({
      where: { id, status : current  },
      data: updateData,
    })

    if (count === 0){
      throw conflict('Đợt tuyển đã được cập nhật bởi một thao tác khác. Vui lòng tải lại.')
    }

    const updated = await tx.recruitmentRound.findUniqueOrThrow({
      where: { id },
      include: { departments: true},
    })

    const action = 
    targetStatus === 'OPEN'
      ? AUDIT_ACTIONS.RECRUITMENT_OPEN_ROUND
      : targetStatus === 'CLOSED'
        ? AUDIT_ACTIONS.RECRUITMENT_CLOSE_ROUND
        : AUDIT_ACTIONS.RECRUITMENT_ARCHIVE_ROUND

    await audit(
      request,
      {
        action,
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
      // Dùng updateMany để chỉ đóng nếu đợt vẫn còn OPEN
      const { count } = await tx.recruitmentRound.updateMany({
        where: { id: round.id, status : 'OPEN' },
        data: { status: 'CLOSED' },
      })

      if (count === 0) return // Đã được xử lý bởi thao tác khác, bỏ qua
      

      await audit(
        { service: 'round-close' },
        {
          action: AUDIT_ACTIONS.RECRUITMENT_AUTO_CLOSE,
          targetType: 'RecruitmentRound',
          targetId: round.id,
          category: AuditCategory.BUSINESS,
          result: AuditResult.SUCCESS,
          metadata: { 
           fromStatus: 'OPEN',
           toStatus: 'CLOSED',
           reason: 'Tự động đóng do hết hạn', 
           closesAt: round.closesAt },
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
  // 1. Chặn thành viên/Admin đã đăng nhập
  if (user) {
    throw forbidden('Người đã đăng nhập không thể nộp đơn ứng tuyển.')
  }

  // 2. Validate dữ liệu đầu vào bằng Zod
  const input = SubmitApplicationSchema.parse(rawBody)

  // 3. Đọc sơ bộ đợt tuyển để lấy ID
  const initialRound = await db.recruitmentRound.findUnique({
    where: { slug },
    select: { id: true, status: true },
  })
  if (!initialRound || initialRound.status !== 'OPEN') {
    throw notFound('Không tìm thấy đợt tuyển hoặc đợt tuyển chưa mở nhận đơn.')
  }

  try {
    return await db.$transaction(async (tx) => {
      // 4. Khóa FOR SHARE dòng đợt tuyển: cho phép nhiều ứng viên nộp song song,
      // nhưng buộc chờ nếu Admin đang sửa đợt (FOR UPDATE).
      await tx.$queryRaw`SELECT id FROM "recruitment_rounds" WHERE id = ${initialRound.id} FOR SHARE`

      // 5. Đọc lại dữ liệu mới nhất của đợt tuyển bên trong transaction
      const round = await tx.recruitmentRound.findUniqueOrThrow({
        where: { id: initialRound.id },
        include: { departments: true },
      })

      if (round.status !== 'OPEN') {
        throw conflict('Đợt tuyển hiện không mở nhận đơn.')
      }

      const now = new Date()
      if (now < round.opensAt || now > round.closesAt) {
        throw conflict('Đợt tuyển hiện không trong thời gian nhận đơn.')
      }

      // 6. Chống gửi lặp: kiểm tra Idempotency-Key và ràng buộc theo đúng đợt tuyển này
      if (idempotencyKey) {
        const existingApp = await tx.membershipApplication.findUnique({
          where: { idempotencyKey },
          include: { recruitmentRound: true },
        })
        if (existingApp) {
          if (existingApp.recruitmentRoundId !== round.id) {
            throw conflict('Khóa Idempotency-Key không thuộc đợt tuyển này.')
          }
          return {
            profileCode: existingApp.profileCode,
            applicantName: existingApp.applicantName,
            applicantEmail: existingApp.applicantEmail,
            roundTitle: existingApp.recruitmentRound.title,
            submittedAt: existingApp.submittedAt.toISOString(),
          }
        }
      }

      // 7. Kiểm tra ban mong muốn phải thuộc danh sách ban mới nhất của đợt
      const validDeptIds = round.departments.map((d) => d.id)
      if (!validDeptIds.includes(input.desiredDepartmentId)) {
        throw new ZodError([
          {
            code: 'custom',
            path: ['desiredDepartmentId'],
            message: 'Ban chuyên môn được chọn không thuộc đợt tuyển này.',
          },
        ])
      }

      // 8. Validate và chỉ dựng answers từ các câu hỏi không ẩn mới nhất của đợt
      const questions = (round.questions as unknown as Question[]) || []
      const sanitizedAnswers: Record<string, string | string[]> = {}
      const answerIssues: z.ZodIssue[] = []

      for (const q of questions) {
        if (q.hidden) continue

        const val = input.answers?.[q.id]
        const hasValue = val !== undefined && val !== null && val !== ''

        if (q.required) {
          const isEmpty =
            !hasValue ||
            (typeof val === 'string' && val.trim() === '') ||
            (Array.isArray(val) && val.length === 0)
          if (isEmpty) {
           answerIssues.push({
              code: 'custom',
              path: ['answers', q.id],
              message: `Vui lòng trả lời câu hỏi bắt buộc: ${q.label}`,
            })
            continue
          }
        }

        if (!hasValue) continue

        if (q.type === 'short_text') {
          if (typeof val !== 'string') {
           answerIssues.push({
              code: 'custom',
              path: ['answers', q.id],
              message: `Câu trả lời cho "${q.label}" phải là văn bản chuỗi.`,
            })
            continue
          }
          const trimmed = val.trim()
          if (trimmed.length > 500) {
            answerIssues.push({
              code: 'custom',
              path: ['answers', q.id],
              message: `Câu trả lời cho "${q.label}" không được vượt quá 500 ký tự.`,
            })
            continue
          }
          if (trimmed.length > 0) sanitizedAnswers[q.id] = trimmed
        } else if (q.type === 'long_text') {
          if (typeof val !== 'string') {
            answerIssues.push({
              code: 'custom',
              path: ['answers', q.id],
              message: `Câu trả lời cho "${q.label}" phải là văn bản chuỗi.`,
            })
            continue
          }
           const trimmed = val.trim()
          if (trimmed.length > 5000) {
            answerIssues.push({
              code: 'custom',
              path: ['answers', q.id],
              message: `Câu trả lời cho "${q.label}" không được vượt quá 5.000 ký tự.`,
            })
            continue
          }
          if (trimmed.length > 0) sanitizedAnswers[q.id] = trimmed
        } else if (q.type === 'single_choice') {
          if (typeof val !== 'string') {
            answerIssues.push({
              code: 'custom',
              path: ['answers', q.id],
              message: `Lựa chọn cho "${q.label}" không hợp lệ.`,
            })
            continue
          }
          const validOptIds = (q.options ?? []).map((o) => o.id)
          if (!validOptIds.includes(val)) {
            answerIssues.push({
              code: 'custom',
              path: ['answers', q.id],
              message: `Lựa chọn cho "${q.label}" không nằm trong danh sách lựa chọn cho phép.`,
            })
            continue
          }
          sanitizedAnswers[q.id] = val
        } else if (q.type === 'multiple_choice') {
          if (!Array.isArray(val) || !val.every((item) => typeof item === 'string')) {
            answerIssues.push({
              code: 'custom',
              path: ['answers', q.id],
              message: `Lựa chọn cho "${q.label}" phải là một danh sách lựa chọn.`,
            })
            continue
          }
           const validOptIds = new Set((q.options ?? []).map((o) => o.id))
          let hasInvalid = false
          for (const item of val) {
            if (!validOptIds.has(item)) {
              answerIssues.push({
                code: 'custom',
                path: ['answers', q.id],
                message: `Lựa chọn "${item}" cho "${q.label}" không hợp lệ.`,
              })
              hasInvalid = true
              break
            }
          }
          if (!hasInvalid) {
            const uniqueVals = Array.from(new Set(val))
            if (uniqueVals.length > 0) sanitizedAnswers[q.id] = uniqueVals
          }
        }
      }
      if (answerIssues.length > 0) {
        throw new ZodError(answerIssues)
      }

      // 9. Kiểm tra trùng email hoặc MSSV trong đợt tuyển (REC-05, BR-05, QĐ-1)
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
        // Nếu trùng do chính request này vừa được tạo bởi một luồng gửi song song (cùng Idempotency-Key)
        if (idempotencyKey && existingApp.idempotencyKey === idempotencyKey) {
          return {
            profileCode: existingApp.profileCode,
            applicantName: existingApp.applicantName,
            applicantEmail: existingApp.applicantEmail,
            roundTitle: round.title,
            submittedAt: existingApp.submittedAt.toISOString(),
          }
        }
        throw conflict('Không thể nộp đơn với thông tin này. Nếu đã nộp, vui lòng dùng trang tra cứu.')
      }

      // 10. Sinh mã hồ sơ công khai ngẫu nhiên (REC-06, không tuần tự)
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
          answers: sanitizedAnswers as Prisma.InputJsonValue,
          idempotencyKey: idempotencyKey || null,
          status: 'NEW',
        },
      })

      // 11. Ghi nhận sự đồng ý xử lý dữ liệu (B2, DATA-07)
      await recordConsent(tx, {
        subjectType: 'APPLICATION',
        subjectId: application.id,
        purpose: 'RECRUITMENT_PROCESSING',
      })

      // 12. Xếp email xác nhận vào hàng đợi (O1, NTF-01)
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
    if (idempotencyKey) {
      const existing = await db.membershipApplication.findUnique({
        where: { idempotencyKey },
        include: { recruitmentRound: true },
      })
      if (existing && existing.recruitmentRoundId === initialRound.id) {
        return {
          profileCode: existing.profileCode,
          applicantName: existing.applicantName,
          applicantEmail: existing.applicantEmail,
          roundTitle: existing.recruitmentRound.title,
          submittedAt: existing.submittedAt.toISOString(),
        }
      }
    }
    if (error?.code === 'P2002') {
      throw conflict('Không thể nộp đơn với thông tin này. Nếu đã nộp, vui lòng dùng trang tra cứu.')
    }
    throw error
  }
}

/**
 * Tra cứu trạng thái hồ sơ ứng tuyển (R4, FLOW-05)
 * Trả về thông tin an toàn: KHÔNG bao gồm ghi chú nội bộ, đánh giá, người xét (BR-07)
 */
export async function lookupApplication(input: unknown) {
  const { email, code } = LookupApplicationSchema.parse(input)

  const app = await db.membershipApplication.findUnique({
    where: { profileCode: code },
    include: {
      recruitmentRound: {
        select: {
          title: true,
          slug: true,
        },
      },
      desiredDepartment: {
        select: {
          name: true,
          code: true,
        },
      },
    },
  })

  // Sai email hoặc sai mã trả cùng một thông báo chung (FLOW-05)
  if (!app || app.applicantEmail.toLowerCase() !== email.toLowerCase()) {
    throw notFound('Không tìm thấy hồ sơ với thông tin đã cung cấp.')
  }

  return {
    profileCode: app.profileCode,
    applicantName: app.applicantName,
    roundTitle: app.recruitmentRound.title,
    roundSlug: app.recruitmentRound.slug,
    desiredDepartmentName: app.desiredDepartment?.name ?? 'Chưa phân ban',
    status: app.status,
    submittedAt: app.submittedAt,
    updatedAt: app.updatedAt,
    canWithdraw: ['NEW', 'REVIEWING', 'INTERVIEW'].includes(app.status),
  }
}

/**
 * Rút hồ sơ ứng tuyển (R4, FLOW-05)
 * Chỉ cho phép rút khi hồ sơ chưa có kết quả cuối (NEW, REVIEWING, INTERVIEW)
 */
export async function withdrawApplication(request: FastifyRequest, input: unknown) {
  const { email, code } = WithdrawApplicationSchema.parse(input)

  const app = await db.membershipApplication.findUnique({
    where: { profileCode: code },
    select: {
      id: true,
      profileCode: true,
      applicantEmail: true,
      desiredDepartmentId: true,
      status: true,
    },
  })

  if (!app || app.applicantEmail.toLowerCase() !== email.toLowerCase()) {
    throw notFound('Không tìm thấy hồ sơ với thông tin đã cung cấp.')
  }

  const allowedStatuses = ['NEW', 'REVIEWING', 'INTERVIEW'] as const
  if (!allowedStatuses.includes(app.status as any)) {
    throw conflict('Hồ sơ không ở trạng thái có thể rút đơn.')
  }

  const updated = await db.$transaction(async (tx) => {
    // updateMany kèm điều kiện status để chống race condition: hai lượt bấm song song chỉ một lượt thắng,
    // hoặc không thể đè trạng thái ACCEPTED/REJECTED/WITHDRAWN nếu đã thay đổi giữa chừng (BR-16).
    const { count } = await tx.membershipApplication.updateMany({
      where: {
        id: app.id,
        status: { in: [...allowedStatuses] },
      },
      data: { status: 'WITHDRAWN' },
    })

    if (count === 0) {
      throw conflict('Hồ sơ không ở trạng thái có thể rút đơn.')
    }

    const row = await tx.membershipApplication.findUniqueOrThrow({
      where: { id: app.id },
      select: {
        id: true,
        status: true,
        updatedAt: true,
      },
    })

    // Ghi audit log: TUYỆT ĐỐI không ghi mã hồ sơ (OPS-11, BR-07)
    await audit(
      request,
      {
        action: AUDIT_ACTIONS.APPLICATION_WITHDRAW,
        category: AuditCategory.BUSINESS,
        result: AuditResult.SUCCESS,
        targetType: 'APPLICATION',
        targetId: app.id,
        metadata: {
          fromStatus: app.status,
          toStatus: 'WITHDRAWN',
        },
      },
      tx,
    )

    // Đẩy email thông báo vào hàng đợi (QĐ-7: người bị rút đơn hộ biết ngay)
    await enqueueEmail(tx, {
      type: 'APPLICATION_STATUS',
      to: app.applicantEmail,
      refType: 'APPLICATION',
      refId: app.id,
      departmentId: app.desiredDepartmentId ?? undefined,
    })

    return row
  })

  return {
    success: true,
    status: updated.status,
    updatedAt: updated.updatedAt,
  }
}

// ─── ADMIN SERVICES (R5) ────────────────────────────────────────────────────────

export const APPLICATION_VALID_TRANSITIONS: Record<string, string[]> = {
  NEW: ['REVIEWING', 'WITHDRAWN'],
  REVIEWING: ['INTERVIEW', 'ACCEPTED', 'REJECTED', 'WITHDRAWN'],
  INTERVIEW: ['ACCEPTED', 'REJECTED', 'WITHDRAWN'],
  ACCEPTED: [],
  REJECTED: [],
  WITHDRAWN: [],
}

/**
 * API 1: Danh sách hồ sơ đợt tuyển (GET /admin/recruitment/:id/applications)
 * - Lọc theo trạng thái, ban, từ khóa (họ tên, email, MSSV).
 * - Phân quyền: BOARD thấy tất cả; DEPARTMENT_MANAGER chỉ thấy hồ sơ thuộc ban mình.
 */
export async function listAdminApplications(user: AuthUser, roundId: string, rawQuery: unknown) {
  const query = AdminApplicationQuerySchema.parse(rawQuery)
  const isBoard = hasRole(user, 'BOARD')
  const managerDeptIds = user.roles
    .filter((r) => r.role === 'DEPARTMENT_MANAGER' && r.departmentId)
    .map((r) => r.departmentId as string)

  const round = await db.recruitmentRound.findUnique({
    where: { id: roundId },
    select: { id: true, title: true },
  })
  if (!round) throw notFound()

  // Phân quyền: MANAGER chỉ xem được đợt tuyển nếu có hồ sơ thuộc ban mình (docs/02 §8.1 & §12)
  if (!isBoard) {
    if (managerDeptIds.length === 0) throw notFound()
    const hasApp = await db.membershipApplication.findFirst({
      where: {
        recruitmentRoundId: roundId,
        desiredDepartmentId: { in: managerDeptIds },
      },
    })
    if (!hasApp) throw notFound()
  }

  const where: Prisma.MembershipApplicationWhereInput = {
    recruitmentRoundId: roundId,
  }

  if (query.status) {
    where.status = query.status
  }

  if (isBoard) {
    if (query.departmentId) {
      where.desiredDepartmentId = query.departmentId
    }
  } else {
    // DEPARTMENT_MANAGER: Chỉ xem hồ sơ thuộc ban mình quản lý
    if (query.departmentId) {
      if (!managerDeptIds.includes(query.departmentId)) {
        where.desiredDepartmentId = '__none__'
      } else {
        where.desiredDepartmentId = query.departmentId
      }
    } else {
      where.desiredDepartmentId = { in: managerDeptIds }
    }
  }

  const searchTerm = query.search || query.q
  if (searchTerm) {
    where.OR = [
      { applicantName: { contains: searchTerm, mode: 'insensitive' } },
      { applicantEmail: { contains: searchTerm, mode: 'insensitive' } },
      { studentId: { contains: searchTerm, mode: 'insensitive' } },
    ]
  }

  const [total, items] = await Promise.all([
    db.membershipApplication.count({ where }),
    db.membershipApplication.findMany({
      where,
      ...pageArgs(query),
      orderBy: { submittedAt: 'desc' },
      select: {
        id: true,
        profileCode: true,
        applicantName: true,
        applicantEmail: true,
        studentId: true,
        faculty: true,
        major: true,
        cohort: true,
        desiredDepartmentId: true,
        desiredDepartment: { select: { id: true, name: true, code: true } },
        status: true,
        internalNote: true,
        reviewedAt: true,
        reviewedBy: { select: { id: true, fullName: true, username: true } },
        submittedAt: true,
        updatedAt: true,
      },
    }),
  ])

  return toPage(items, total, query)
}

/**
 * API 2: Chi tiết hồ sơ (GET /admin/recruitment/:id/applications/:applicationId)
 * - Trả về thông tin cá nhân, câu trả lời, ghi chú nội bộ, và lịch sử trạng thái kèm người thay đổi.
 * - Quản lý ban mở hồ sơ ngoài ban mình: trả 404 (docs/02 §12).
 */
export async function getAdminApplicationById(user: AuthUser, roundId: string, applicationId: string) {
  const isBoard = hasRole(user, 'BOARD')
  const managerDeptIds = user.roles
    .filter((r) => r.role === 'DEPARTMENT_MANAGER' && r.departmentId)
    .map((r) => r.departmentId as string)

  const application = await db.membershipApplication.findFirst({
    where: {
      id: applicationId,
      recruitmentRoundId: roundId,
    },
    include: {
      desiredDepartment: { select: { id: true, name: true, code: true } },
      recruitmentRound: { select: { id: true, title: true, slug: true, questions: true } },
      reviewedBy: { select: { id: true, fullName: true, username: true, avatarUrl: true } },
      convertedUser: { select: { id: true, fullName: true, username: true } },
      statusHistories: {
        orderBy: { changedAt: 'desc' },
        include: {
          changedBy: { select: { id: true, fullName: true, username: true, avatarUrl: true } },
        },
      },
    },
  })

  if (!application) throw notFound()

  // Phân quyền: DEPARTMENT_MANAGER chỉ xem được hồ sơ nộp vào ban mình quản lý
  if (!isBoard) {
    if (!application.desiredDepartmentId || !managerDeptIds.includes(application.desiredDepartmentId)) {
      throw notFound()
    }
  }

  return application
}

/**
 * API 3: Cập nhật ghi chú nội bộ & đánh giá (PATCH /admin/recruitment/:id/applications/:applicationId/review)
 * - Cập nhật internalNote, reviewedById, reviewedAt.
 * - Chống xung đột đồng thời (STATE-09): kiểm tra updatedAt.
 */
export async function updateApplicationReview(
  request: FastifyRequest,
  roundId: string,
  applicationId: string,
  rawBody: unknown,
  user: AuthUser,
) {
  const body = UpdateApplicationReviewSchema.parse(rawBody)
  const isBoard = hasRole(user, 'BOARD')
  const managerDeptIds = user.roles
    .filter((r) => r.role === 'DEPARTMENT_MANAGER' && r.departmentId)
    .map((r) => r.departmentId as string)

  const application = await db.membershipApplication.findFirst({
    where: { id: applicationId, recruitmentRoundId: roundId },
    select: {
      id: true,
      desiredDepartmentId: true,
      updatedAt: true,
      status: true,
    },
  })

  if (!application) throw notFound()

  if (!isBoard) {
    if (!application.desiredDepartmentId || !managerDeptIds.includes(application.desiredDepartmentId)) {
      throw notFound()
    }
  }

  // Chống xung đột đồng thời (STATE-09)
  if (body.updatedAt) {
    const clientTime = new Date(body.updatedAt).getTime()
    const serverTime = application.updatedAt.getTime()
    if (clientTime !== serverTime) {
      throw conflict('Hồ sơ vừa được người khác cập nhật. Vui lòng tải lại.')
    }
  }

  return db.$transaction(async (tx) => {
    const updateData: {
      internalNote?: string | null
      reviewedById: string
      reviewedAt: Date
      updatedAt: Date
    } = {
      reviewedById: user.id,
      reviewedAt: new Date(),
      updatedAt: new Date(),
    }
    if (body.internalNote !== undefined) {
      updateData.internalNote = body.internalNote
    }

    if (body.updatedAt) {
      const { count } = await tx.membershipApplication.updateMany({
        where: {
          id: applicationId,
          updatedAt: application.updatedAt,
        },
        data: updateData,
      })
      if (count === 0) {
        throw conflict('Hồ sơ vừa được người khác cập nhật. Vui lòng tải lại.')
      }
    } else {
      await tx.membershipApplication.update({
        where: { id: applicationId },
        data: updateData,
      })
    }

    const updated = await tx.membershipApplication.findUniqueOrThrow({
      where: { id: applicationId },
      select: {
        id: true,
        internalNote: true,
        reviewedById: true,
        reviewedAt: true,
        updatedAt: true,
      },
    })

    await audit(
      request,
      {
        action: AUDIT_ACTIONS.APPLICATION_REVIEW,
        category: AuditCategory.BUSINESS,
        result: AuditResult.SUCCESS,
        targetType: 'APPLICATION',
        targetId: application.id,
        metadata: { field: 'internalNote' },
      },
      tx,
    )

    return updated
  })
}

/**
 * API 4: Chuyển trạng thái hồ sơ (POST /admin/recruitment/:id/applications/:applicationId/status)
 * - Kiểm tra bước chuyển theo PRD 9.2 (BR-16). Bước chuyển sai trả 409.
 * - Kiểm tra quyền (docs/02 §8.1): DEPARTMENT_MANAGER chỉ chuyển trung gian (NEW -> REVIEWING -> INTERVIEW).
 *   Cố chốt ACCEPTED/REJECTED hoặc WITHDRAWN trả 403.
 * - BOARD được chuyển tất cả, chuyển sang WITHDRAWN bắt buộc nhập lý do (reason).
 * - Chống xung đột đồng thời (STATE-09): dùng updateMany với điều kiện status hiện tại và/hoặc updatedAt.
 * - Ghi lịch sử trạng thái: tạo 1 dòng trong bảng ApplicationStatusHistory.
 * - Gửi email thông báo cho ứng viên khi sang INTERVIEW, ACCEPTED, REJECTED, WITHDRAWN (QĐ-7, NTF-01).
 *   NEW -> REVIEWING không gửi email.
 */
export async function changeApplicationStatus(
  request: FastifyRequest,
  roundId: string,
  applicationId: string,
  rawBody: unknown,
  user: AuthUser,
) {
  const body = ChangeApplicationStatusSchema.parse(rawBody)
  const isBoard = hasRole(user, 'BOARD')
  const managerDeptIds = user.roles
    .filter((r) => r.role === 'DEPARTMENT_MANAGER' && r.departmentId)
    .map((r) => r.departmentId as string)

  const application = await db.membershipApplication.findFirst({
    where: { id: applicationId, recruitmentRoundId: roundId },
    select: {
      id: true,
      status: true,
      applicantEmail: true,
      desiredDepartmentId: true,
      updatedAt: true,
    },
  })

  if (!application) throw notFound()

  // Phân quyền theo ban: Manager ngoài ban nhận 404 (docs/02 §12)
  if (!isBoard) {
    if (!application.desiredDepartmentId || !managerDeptIds.includes(application.desiredDepartmentId)) {
      throw notFound()
    }
  }

  const currentStatus = application.status
  const targetStatus = body.status

  // Kiểm tra quyền chuyển trạng thái (docs/02 §8.1):
  // DEPARTMENT_MANAGER chỉ được chuyển trung gian (NEW -> REVIEWING -> INTERVIEW).
  // Nếu Manager cố chốt ACCEPTED, REJECTED hoặc WITHDRAWN -> 403 Forbidden.
  if (!isBoard) {
    const managerAllowedStatuses = ['REVIEWING', 'INTERVIEW']
    if (!managerAllowedStatuses.includes(targetStatus)) {
      throw forbidden('Chỉ Ban Chủ nhiệm mới có quyền chốt kết quả hoặc rút đơn ứng viên.')
    }
  }

  // Kiểm tra bước chuyển theo sơ đồ trạng thái PRD 9.2 (BR-16):
  const allowedNext = APPLICATION_VALID_TRANSITIONS[currentStatus] ?? []
  if (!allowedNext.includes(targetStatus)) {
    throw conflict(`Không thể chuyển trạng thái hồ sơ từ ${currentStatus} sang ${targetStatus}.`)
  }

  // Chống xung đột đồng thời (STATE-09):
  if (body.updatedAt) {
    const clientTime = new Date(body.updatedAt).getTime()
    const serverTime = application.updatedAt.getTime()
    if (clientTime !== serverTime) {
      throw conflict('Hồ sơ vừa được người khác cập nhật. Vui lòng tải lại.')
    }
  }

  const now = new Date()

  return db.$transaction(async (tx) => {
    // Dùng updateMany kèm điều kiện status để chống race condition: hai lượt bấm song song chỉ một lượt thắng
    const { count } = await tx.membershipApplication.updateMany({
      where: {
        id: application.id,
        status: currentStatus,
      },
      data: {
        status: targetStatus,
        reviewedById: user.id,
        reviewedAt: now,
      },
    })

    if (count === 0) {
      throw conflict('Hồ sơ vừa được người khác cập nhật. Vui lòng tải lại.')
    }

    // Tạo dòng lịch sử trạng thái (FLOW-07 bước 6)
    const history = await tx.applicationStatusHistory.create({
      data: {
        applicationId: application.id,
        fromStatus: currentStatus,
        toStatus: targetStatus,
        reason: body.reason?.trim() || null,
        changedById: user.id,
        changedAt: now,
      },
      include: {
        changedBy: {
          select: { id: true, fullName: true, username: true, avatarUrl: true },
        },
      },
    })

    // Email thông báo (QĐ-7, NTF-01):
    // Gửi khi chuyển sang INTERVIEW, ACCEPTED, REJECTED, WITHDRAWN.
    // NEW -> REVIEWING không gửi email.
    if (['INTERVIEW', 'ACCEPTED', 'REJECTED', 'WITHDRAWN'].includes(targetStatus)) {
      await enqueueEmail(tx, {
        type: 'APPLICATION_STATUS',
        to: application.applicantEmail,
        refType: 'APPLICATION',
        refId: application.id,
        departmentId: application.desiredDepartmentId ?? undefined,
      })
    }

    // Audit log
    const auditAction =
      targetStatus === 'ACCEPTED' || targetStatus === 'REJECTED'
        ? AUDIT_ACTIONS.RECRUITMENT_FINALIZE
        : targetStatus === 'WITHDRAWN'
          ? AUDIT_ACTIONS.APPLICATION_WITHDRAW
          : AUDIT_ACTIONS.APPLICATION_STATUS_CHANGE

    await audit(
      request,
      {
        action: auditAction,
        category: AuditCategory.BUSINESS,
        result: AuditResult.SUCCESS,
        targetType: 'APPLICATION',
        targetId: application.id,
        metadata: {
          fromStatus: currentStatus,
          toStatus: targetStatus,
          reason: body.reason?.trim() || null,
        },
      },
      tx,
    )

    const updatedApp = await tx.membershipApplication.findUniqueOrThrow({
      where: { id: application.id },
      select: {
        id: true,
        status: true,
        reviewedById: true,
        reviewedAt: true,
        updatedAt: true,
      },
    })

    return {
      ...updatedApp,
      history,
    }
  })
}

function neutralizeCsv(val: unknown): string {
  if (val === null || val === undefined) return ''
  const str = String(val).trim()
  if (/^[=+\-@\t\r]/.test(str)) {
    return `'${str}`
  }
  return str
}

function escapeCsvCell(val: string): string {
  if (val.includes(',') || val.includes('"') || val.includes('\n') || val.includes('\r')) {
    return `"${val.replace(/"/g, '""')}"`
  }
  return val
}

/**
 * API 5: Xuất danh sách ứng viên (POST /admin/recruitment/:id/applications/export)
 * - Xuất CSV trong phạm vi người xuất (DEPARTMENT_MANAGER chỉ xuất hồ sơ ban mình, BOARD xuất tất cả).
 * - Chống chèn công thức (SEC-09), có BOM UTF-8, ghi audit log.
 */
export async function exportApplicationsCsv(
  request: FastifyRequest,
  roundId: string,
  rawQuery: unknown,
  user: AuthUser,
) {
  const query = AdminApplicationExportQuerySchema.parse(rawQuery)
  const isBoard = hasRole(user, 'BOARD')
  const managerDeptIds = user.roles
    .filter((r) => r.role === 'DEPARTMENT_MANAGER' && r.departmentId)
    .map((r) => r.departmentId as string)

  const round = await db.recruitmentRound.findUnique({
    where: { id: roundId },
    select: { id: true, title: true, slug: true },
  })
  if (!round) throw notFound()

  if (!isBoard) {
    if (managerDeptIds.length === 0) throw notFound()
    const hasApp = await db.membershipApplication.findFirst({
      where: {
        recruitmentRoundId: roundId,
        desiredDepartmentId: { in: managerDeptIds },
      },
    })
    if (!hasApp) throw notFound()
  }

  const where: Prisma.MembershipApplicationWhereInput = {
    recruitmentRoundId: roundId,
  }

  if (query.status) {
    where.status = query.status
  }

  if (isBoard) {
    if (query.departmentId) {
      where.desiredDepartmentId = query.departmentId
    }
  } else {
    if (query.departmentId) {
      if (!managerDeptIds.includes(query.departmentId)) {
        where.desiredDepartmentId = '__none__'
      } else {
        where.desiredDepartmentId = query.departmentId
      }
    } else {
      where.desiredDepartmentId = { in: managerDeptIds }
    }
  }

  const searchTerm = query.search || query.q
  if (searchTerm) {
    where.OR = [
      { applicantName: { contains: searchTerm, mode: 'insensitive' } },
      { applicantEmail: { contains: searchTerm, mode: 'insensitive' } },
      { studentId: { contains: searchTerm, mode: 'insensitive' } },
    ]
  }

  const apps = await db.membershipApplication.findMany({
    where,
    orderBy: { submittedAt: 'desc' },
    include: {
      desiredDepartment: { select: { name: true } },
      reviewedBy: { select: { fullName: true } },
    },
  })

  const headers = [
    'Mã hồ sơ',
    'Họ và tên',
    'Email',
    'MSSV',
    'Khoa/Viện',
    'Ngành',
    'Khóa',
    'Ban mong muốn',
    'Kỹ năng',
    'Kinh nghiệm',
    'Trạng thái',
    'Ghi chú nội bộ',
    'Người duyệt',
    'Thời gian nộp',
    'Cập nhật lần cuối',
  ]

  const statusLabels: Record<string, string> = {
    NEW: 'Mới',
    REVIEWING: 'Đang xét',
    INTERVIEW: 'Mời phỏng vấn',
    ACCEPTED: 'Đã chấp nhận',
    REJECTED: 'Không chấp nhận',
    WITHDRAWN: 'Đã rút',
  }

  const rows = apps.map((app) => [
    neutralizeCsv(app.profileCode),
    neutralizeCsv(app.applicantName),
    neutralizeCsv(app.applicantEmail),
    neutralizeCsv(app.studentId),
    neutralizeCsv(app.faculty ?? ''),
    neutralizeCsv(app.major ?? ''),
    neutralizeCsv(app.cohort ?? ''),
    neutralizeCsv(app.desiredDepartment?.name ?? ''),
    neutralizeCsv(app.skills ?? ''),
    neutralizeCsv(app.experience ?? ''),
    neutralizeCsv(statusLabels[app.status] ?? app.status),
    neutralizeCsv(app.internalNote ?? ''),
    neutralizeCsv(app.reviewedBy?.fullName ?? ''),
    neutralizeCsv(app.submittedAt.toISOString()),
    neutralizeCsv(app.updatedAt.toISOString()),
  ])

  const csvContent =
    '\uFEFF' +
    [
      headers.map(escapeCsvCell).join(','),
      ...rows.map((row) => row.map(escapeCsvCell).join(',')),
    ].join('\r\n')

  await audit(request, {
    action: AUDIT_ACTIONS.RECRUITMENT_EXPORT,
    category: AuditCategory.BUSINESS,
    result: AuditResult.SUCCESS,
    targetType: 'RECRUITMENT_ROUND',
    targetId: round.id,
    metadata: { rowCount: apps.length },
  })

  return {
    filename: `apc-ung-tuyen-${round.slug}.csv`,
    csv: csvContent,
    rowCount: apps.length,
  }
}

// ─── CHUYỂN HỒ SƠ THÀNH THÀNH VIÊN (R6, FLOW-08, BR-06, STATE-03) ────────────

/**
 * Chuẩn hóa tên ứng viên thành tiền tố username không dấu, chữ thường, dạng word1.word2...
 * Nếu tên quá ngắn hoặc rỗng, dùng tiền tố email.
 */
export function normalizeNameToUsername(name: string, email: string): string {
  const withoutDiacritics = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .trim()

  const words = withoutDiacritics.split(/[^a-z0-9]+/).filter(Boolean)
  let base = words.join('.')

  if (base.length < 3) {
    const emailPrefix = (email.split('@')[0] ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[đĐ]/g, 'd')
      .toLowerCase()
      .replace(/[^a-z0-9._-]/g, '')
    base = emailPrefix
  }

  if (base.length < 3) {
    base = (base + 'apc').slice(0, 10)
  }

  if (base.length > 40) {
    base = base.slice(0, 40).replace(/[._-]+$/, '')
  }

  return base
}

/**
 * API 1: Đề xuất tên đăng nhập duy nhất (GET .../applications/:applicationId/suggest-username)
 * Chuẩn hóa họ tên ứng viên, tự động thêm số tăng dần nếu trùng trong bảng User.
 */
export async function suggestApplicationUsername(roundId: string, applicationId: string) {
  const application = await db.membershipApplication.findFirst({
    where: { id: applicationId, recruitmentRoundId: roundId },
    select: { id: true, applicantName: true, applicantEmail: true },
  })
  if (!application) throw notFound('Không tìm thấy hồ sơ ứng tuyển.')

  const base = normalizeNameToUsername(application.applicantName, application.applicantEmail)

  const existingUsers = await db.user.findMany({
    where: {
      username: {
        startsWith: base,
      },
    },
    select: { username: true },
  })
  const existingSet = new Set(existingUsers.map((u) => u.username))

  if (!existingSet.has(base)) {
    return { suggestedUsername: base }
  }

  let counter = 1
  while (existingSet.has(`${base}${counter}`)) {
    counter++
  }
  return { suggestedUsername: `${base}${counter}` }
}

/**
 * API 2: Chuyển ứng viên thành thành viên (POST .../applications/:applicationId/convert)
 * - Chỉ hồ sơ ACCEPTED mới được chuyển (BR-06). Khác ACCEPTED trả 409.
 * - Idempotent: Nếu đã có convertedUserId, trả về tài khoản đã tạo kèm alreadyConverted: true.
 * - Chống trùng thành viên: applicantEmail hoặc studentId trùng với User đã có trả 409 kèm existingUserId.
 * - Dùng lại createAccount của A5 trong single transaction.
 * - Cập nhật thông tin sinh viên vào User và gắn convertedUserId vào đơn.
 * - Mật khẩu tạm chỉ hiển thị MỘT LẦN DUY NHẤT trong phản hồi (STATE-03).
 */
export async function convertApplicationToMember(
  request: FastifyRequest,
  roundId: string,
  applicationId: string,
  rawBody: unknown,
) {
  const body = ConvertApplicationSchema.parse(rawBody)

  // 1. Kiểm tra hồ sơ tồn tại
  const application = await db.membershipApplication.findFirst({
    where: { id: applicationId, recruitmentRoundId: roundId },
    select: {
      id: true,
      status: true,
      applicantEmail: true,
      applicantName: true,
      studentId: true,
      faculty: true,
      major: true,
      cohort: true,
      desiredDepartmentId: true,
      convertedUserId: true,
    },
  })

  if (!application) throw notFound('Không tìm thấy hồ sơ ứng tuyển.')

  // 2. Idempotency: nếu đã chuyển thành viên trước đó, trả về thông tin thành viên mà không tạo mới
  if (application.convertedUserId) {
    const user = await db.user.findUnique({
      where: { id: application.convertedUserId },
      select: { id: true, username: true, fullName: true, email: true },
    })
    return {
      alreadyConverted: true,
      user,
    }
  }

  // 3. Kiểm tra trạng thái hồ sơ: bắt buộc ACCEPTED (BR-06)
  if (application.status !== 'ACCEPTED') {
    throw conflict('Chỉ hồ sơ ở trạng thái Đã chấp nhận mới có thể chuyển thành viên.')
  }

  // 4. Kiểm tra chống trùng thành viên: email hoặc MSSV đã thuộc user khác
  const existingUser = await db.user.findFirst({
    where: {
      OR: [
        { email: application.applicantEmail.toLowerCase() },
        { studentId: application.studentId },
      ],
    },
    select: { id: true, username: true, fullName: true, email: true, studentId: true },
  })
  if (existingUser) {
    throw conflict(
      `Email hoặc MSSV của ứng viên đã thuộc tài khoản thành viên (@${existingUser.username}).`,
      { existingUserId: existingUser.id },
    )
  }

  // Kiểm tra tên đăng nhập đã có người dùng chưa
  const existingUsername = await db.user.findUnique({
    where: { username: body.username },
    select: { id: true },
  })
  if (existingUsername) {
    throw conflict(`Tên đăng nhập "${body.username}" đã được sử dụng.`)
  }

  const now = new Date()

  return db.$transaction(async (tx) => {
    // Khóa dòng hồ sơ chống race condition
    const lockedApp = await tx.membershipApplication.findUniqueOrThrow({
      where: { id: application.id },
    })

    if (lockedApp.convertedUserId) {
      const user = await tx.user.findUnique({
        where: { id: lockedApp.convertedUserId },
        select: { id: true, username: true, fullName: true, email: true },
      })
      return {
        alreadyConverted: true,
        user,
      }
    }

    if (lockedApp.status !== 'ACCEPTED') {
      throw conflict('Chỉ hồ sơ ở trạng thái Đã chấp nhận mới có thể chuyển thành viên.')
    }

    const targetDepartmentId = body.departmentId ?? lockedApp.desiredDepartmentId ?? null

    // Gọi hàm createAccount của A5 (quy định: dùng lại hàm này, không viết bản khác)
    const { user: createdUser, temporaryPassword } = await createAccount(
      tx,
      request,
      {
        username: body.username,
        email: lockedApp.applicantEmail,
        fullName: lockedApp.applicantName,
        departmentId: targetDepartmentId,
      },
      now,
    )

    // Trích xuất kỹ năng và số điện thoại (nếu có từ hồ sơ / câu trả lời)
    const skillsList = lockedApp.skills
      ? lockedApp.skills
          .split(/[,;\n]+/)
          .map((s) => s.trim())
          .filter(Boolean)
      : undefined

    let phoneNumber: string | null = null
    if (lockedApp.answers && typeof lockedApp.answers === 'object') {
      const ans = lockedApp.answers as Record<string, unknown>
      for (const [key, val] of Object.entries(ans)) {
        if (
          (key.toLowerCase().includes('phone') ||
            key.toLowerCase().includes('sdt') ||
            key.toLowerCase().includes('dien_thoai')) &&
          typeof val === 'string' &&
          val.trim()
        ) {
          phoneNumber = val.trim()
          break
        }
      }
    }

    // Cập nhật thông tin sinh viên từ hồ sơ vào User (đồng bộ hồ sơ)
    await tx.user.update({
      where: { id: createdUser.id },
      data: {
        studentId: lockedApp.studentId,
        faculty: lockedApp.faculty,
        major: lockedApp.major,
        cohort: lockedApp.cohort,
        ...(phoneNumber ? { phoneNumber } : {}),
        ...(skillsList && skillsList.length > 0 ? { skills: skillsList } : {}),
      },
    })

    // Cập nhật liên kết hồ sơ sang User đã tạo
    await tx.membershipApplication.update({
      where: { id: lockedApp.id },
      data: {
        convertedUserId: createdUser.id,
        convertedAt: now,
      },
    })

    // Ghi audit log: APPLICATION_CONVERT_USER
    await audit(
      request,
      {
        action: AUDIT_ACTIONS.APPLICATION_CONVERT_USER,
        category: AuditCategory.BUSINESS,
        result: AuditResult.SUCCESS,
        targetType: 'APPLICATION',
        targetId: lockedApp.id,
        metadata: {
          userId: createdUser.id,
          username: createdUser.username,
        },
      },
      tx,
    )

    // Trả mật khẩu tạm MỘT LẦN DUY NHẤT trong API response (STATE-03)
    return {
      alreadyConverted: false,
      user: {
        id: createdUser.id,
        username: createdUser.username,
        fullName: lockedApp.applicantName,
        email: lockedApp.applicantEmail,
      },
      temporaryPassword,
    }
  })
}

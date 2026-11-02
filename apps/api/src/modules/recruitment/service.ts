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
import type { Question } from './validation.js'
import {
  ChangeRoundStatusSchema,
  CreateRecruitmentRoundSchema,
  LookupApplicationSchema,
  SubmitApplicationSchema,
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
    if (error?.code === 'P2002') {
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

  const app = await db.membershipApplication.findFirst({
    where: {
      profileCode: code.trim(),
      applicantEmail: { equals: email.trim(), mode: 'insensitive' },
    },
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
  if (!app) {
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

  const app = await db.membershipApplication.findFirst({
    where: {
      profileCode: code.trim(),
      applicantEmail: { equals: email.trim(), mode: 'insensitive' },
    },
    select: {
      id: true,
      profileCode: true,
      applicantEmail: true,
      status: true,
    },
  })

  if (!app) {
    throw notFound('Không tìm thấy hồ sơ với thông tin đã cung cấp.')
  }

  const allowedStatuses = ['NEW', 'REVIEWING', 'INTERVIEW']
  if (!allowedStatuses.includes(app.status)) {
    throw conflict('Hồ sơ không ở trạng thái có thể rút đơn.')
  }

  const updated = await db.$transaction(async (tx) => {
    const res = await tx.membershipApplication.update({
      where: { id: app.id },
      data: { status: 'WITHDRAWN' },
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
        action: AUDIT_ACTIONS.RECRUITMENT_WITHDRAW_APPLICATION,
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
    })

    return res
  })

  return {
    success: true,
    status: updated.status,
    updatedAt: updated.updatedAt,
  }
}
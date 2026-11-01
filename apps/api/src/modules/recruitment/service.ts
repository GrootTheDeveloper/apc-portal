import { z } from 'zod'

import type { FastifyRequest } from 'fastify'
import { db } from '../../db/client.js'
import type { RecruitmentRoundStatus } from '../../db/generated/client.js'
import { conflict, notFound , AppError } from '../../lib/errors.js'
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

  const round = await db.recruitmentRound.findUnique({
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
  if (round.status === 'OPEN'){
    // Không cho sửa slug khi đang mở
    if (data.slug && data.slug !== round.slug){
      throw conflict('Không thể thay đổi đường dẫn (slug) khi đợt tuyển đang mở')
    }

    // Khóa opensAT nếu đã qua thời điểm mở
    if (round.opensAt <= now && data.opensAt && new Date(data.opensAt).getTime() !== round.opensAt.getTime()){
      throw conflict('Không thể thay đổi thời gina bắt đầu khi đợt tuyển đã mở')
    }

    // closesAT chỉ được dời về sau (kéo dài đợt)
    if (data.closesAt && new Date(data.closesAt) < round.closesAt){
      throw conflict('Thời gian kết thúc chỉ được phép dời về sau khi đợt tuyển đang mở')
    }
  }
  // 3. Kiểm tra tính hợp lệ của ngày (trả 422 nếu sai thứ tự ngày)
  const opensAt = data.opensAt ? new Date(data.opensAt) : round.opensAt
  const closesAt = data.closesAt ? new Date(data.closesAt) : round.closesAt
  if (closesAt <= opensAt) {
    throw new AppError(422, 'validation', 'thời gian đóng nhận đơn phải sau thời gian mở')
  }

  // 4. Không cho bỏ ban đã có hồ sơ đăng ký
  if (data.departmentIds){
    const removedDeptWithApp = await db.membershipApplication.findFirst({
      where : {
        recruitmentRoundId : id,
        desiredDepartmentId: { notIn : data.departmentIds}      
      },
    })
    if (removedDeptWithApp){
      throw conflict('Không thể bỏ ban đã có hồ sơ đăng ký ứng tuyển')
    }
  }

  // 5. Kiểm tra sửa câu hỏi nếu đã có hồ sơ
  if (data.questions && round._count.applications > 0) {
    const oldQuestions = (round.questions as unknown as Question[]) || []
    validateQuestionsUpdate(oldQuestions, data.questions)
  }

  return db.$transaction(async(tx) =>{
    const updated = await tx.recruitmentRound.update ({
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
           froStatus: 'OPEN',
           toStatus: 'CLOSED',
           reason: 'Tự động đóng do hết hạn', 
           closesAt: round.closesAt },
        },
        tx,
      )
    })
  }
}
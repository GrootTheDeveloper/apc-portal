import { z } from 'zod'

import type { Prisma } from '../../db/generated/client.js'
import type { MemberStatus, Role } from '../../db/generated/enums.js'
import { db } from '../../db/client.js'
import { conflict, forbidden, notFound } from '../../lib/errors.js'
import { pageArgs, pageQuery, toPage } from '../../lib/pagination.js'
import { AUDIT_ACTIONS, audit, AuditCategory, AuditResult, type AuditRequestLike } from '../audit/service.js'
import { deactivateAccount } from '../accounts/service.js'
import { assertInScope, departmentScope, type AuthUser } from '../auth/rbac.js'

type Actor = AuditRequestLike & { user: AuthUser | null }
type Options = { enforcePrivilegedMinimum: boolean; now?: Date }

export const listMembersQuerySchema = pageQuery.extend({
  q: z.string().trim().optional(),
  departmentId: z.string().trim().optional(),
  role: z.enum(['MEMBER', 'DEPARTMENT_MANAGER', 'BOARD', 'TECH_ADMIN']).optional(),
  status: z.enum(['ACTIVE', 'PAUSED', 'LEFT']).optional(),
})

export type ListMembersQuery = z.infer<typeof listMembersQuerySchema>

export const updateMemberSchema = z
  .object({
    studentId: z.string().trim().nullable().optional(),
    email: z.string().trim().toLowerCase().email('Email không đúng định dạng.').optional(),
    departmentId: z.string().trim().nullable().optional(),
    memberStatus: z.enum(['ACTIVE', 'PAUSED', 'LEFT']).optional(),
    reason: z.string({ error: 'Nhập lý do.' }).trim().min(3, 'Nhập lý do (ít nhất 3 ký tự).').max(500, 'Lý do tối đa 500 ký tự.'),
    /** `updatedAt` của bản đang xem: khác bản trên server thì 409, không ghi đè (STATE-09). */
    updatedAt: z.iso.datetime({ error: 'Thiếu thời điểm cập nhật. Vui lòng tải lại trang.' }),
  })
  .refine(
    (data) =>
      data.studentId !== undefined ||
      data.email !== undefined ||
      data.departmentId !== undefined ||
      data.memberStatus !== undefined,
    { message: 'Phải có ít nhất một trường thay đổi.' },
  )

export type UpdateMemberInput = z.infer<typeof updateMemberSchema>

/**
 * Danh sách thành viên (FLOW-13, MEM-06, MEM-07).
 * BOARD: xem toàn bộ thành viên.
 * DEPARTMENT_MANAGER: chỉ xem thành viên thuộc ban của mình.
 */
export async function listMembers(actor: Actor, rawQuery: unknown, now = new Date()) {
  const query = listMembersQuerySchema.parse(rawQuery ?? {})
  const user = actor.user
  if (!user) throw notFound()

  const scope = departmentScope(user)
  const where: Prisma.UserWhereInput = {}

  // Giới hạn phạm vi ban
  if (scope.departmentId) {
    if (query.departmentId) {
      if (scope.departmentId.in.includes(query.departmentId)) {
        where.departmentId = query.departmentId
      } else {
        where.departmentId = '__NONE__' // Quản lý ban lọc ban ngoài phạm vi -> trả rỗng
      }
    } else {
      where.departmentId = scope.departmentId
    }
  } else if (query.departmentId) {
    where.departmentId = query.departmentId
  }

  // Lọc theo từ khóa (họ tên, MSSV). Không tìm theo email vì từ khóa nằm trên URL (OPS-11).
  if (query.q) {
    where.OR = [
      { fullName: { contains: query.q, mode: 'insensitive' } },
      { studentId: { contains: query.q, mode: 'insensitive' } },
    ]
  }

  // Lọc theo trạng thái thành viên
  if (query.status) {
    where.memberStatus = query.status
  }

  // Lọc theo vai trò
  if (query.role) {
    if (query.role === 'MEMBER') {
      // Mọi user đều có vai trò nền MEMBER
    } else {
      where.roles = {
        some: {
          role: query.role,
          status: 'ACTIVE',
          startsAt: { lte: now },
          OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        },
      }
    }
  }

  const { skip, take } = pageArgs(query)

  const [total, items] = await Promise.all([
    db.user.count({ where }),
    db.user.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        fullName: true,
        studentId: true,
        email: true,
        avatarUrl: true,
        memberStatus: true,
        status: true,
        createdAt: true,
        department: { select: { id: true, name: true, code: true } },
        roles: {
          where: {
            status: 'ACTIVE',
            startsAt: { lte: now },
            OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
          },
          select: {
            id: true,
            role: true,
            departmentId: true,
          },
        },
      },
    }),
  ])

  const mapped = items.map((item) => {
    const roles: { role: Role; departmentId: string | null }[] = [
      { role: 'MEMBER' as const, departmentId: item.department?.id ?? null },
      ...item.roles.map((r) => ({ role: r.role, departmentId: r.departmentId })),
    ]
    return {
      id: item.id,
      fullName: item.fullName,
      studentId: item.studentId,
      email: item.email,
      avatarUrl: item.avatarUrl,
      memberStatus: item.memberStatus,
      accountStatus: item.status,
      createdAt: item.createdAt,
      department: item.department,
      roles,
    }
  })

  return toPage(mapped, total, query)
}

/**
 * Chi tiết thành viên cho 3 tab quản lý (FLOW-13, PAGE-MGT-MEM-02).
 * Quản lý ban mở thành viên ngoài ban trả 404 (docs/02 §12).
 */
export async function getMemberDetail(actor: Actor, id: string) {
  const user = actor.user
  if (!user) throw notFound()

  const target = await db.user.findUnique({
    where: { id },
    select: {
      id: true,
      fullName: true,
      studentId: true,
      email: true,
      contactEmail: true,
      faculty: true,
      major: true,
      cohort: true,
      avatarUrl: true,
      phoneNumber: true,
      skills: true,
      interestAreas: true,
      memberStatus: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      deactivatedAt: true,
      departmentId: true,
      department: { select: { id: true, name: true, code: true, status: true } },
      roles: {
        where: { status: { in: ['ACTIVE', 'PENDING'] } },
        select: {
          id: true,
          role: true,
          status: true,
          departmentId: true,
          department: { select: { id: true, name: true } },
          startsAt: true,
          expiresAt: true,
        },
        orderBy: { startsAt: 'desc' },
      },
      eventRegistrations: {
        select: {
          id: true,
          status: true,
          attendanceStatus: true,
          registeredAt: true,
          event: {
            select: {
              id: true,
              title: true,
              startAt: true,
              endAt: true,
              location: true,
              status: true,
            },
          },
        },
        orderBy: { registeredAt: 'desc' },
      },
    },
  })

  if (!target) throw notFound()

  // Kiểm tra phạm vi ban đối với DEPARTMENT_MANAGER (ngoài ban trả 404)
  assertInScope(user, target.departmentId)

  return {
    profile: {
      id: target.id,
      fullName: target.fullName,
      studentId: target.studentId,
      email: target.email,
      contactEmail: target.contactEmail ?? null, // QĐ-8: email liên hệ thành viên tự cập nhật
      faculty: target.faculty,
      major: target.major,
      cohort: target.cohort,
      avatarUrl: target.avatarUrl,
      phoneNumber: target.phoneNumber,
      skills: target.skills,
      interestAreas: target.interestAreas,
      accountStatus: target.status,
      createdAt: target.createdAt,
      updatedAt: target.updatedAt,
      deactivatedAt: target.deactivatedAt,
    },
    organization: {
      department: target.department,
      memberStatus: target.memberStatus,
      roles: [
        {
          id: 'base-member',
          role: 'MEMBER' as const,
          status: 'ACTIVE' as const,
          departmentId: target.department?.id ?? null,
          department: target.department ? { id: target.department.id, name: target.department.name } : null,
          startsAt: target.createdAt,
          expiresAt: null,
        },
        ...target.roles,
      ],
    },
    activity: {
      eventRegistrations: target.eventRegistrations,
    },
  }
}

/**
 * Cập nhật thông tin thành viên (FLOW-13, RP-08, QĐ-3, QĐ-8). Chỉ BOARD.
 */
export async function updateMember(
  actor: Actor,
  id: string,
  rawInput: unknown,
  options: Options,
  now = options.now ?? new Date(),
) {
  const body = updateMemberSchema.parse(rawInput)

  return db.$transaction(async (tx) => {
    // Khóa dòng để kiểm `updatedAt` và ghi trong cùng một bước (STATE-09).
    await tx.$queryRaw`SELECT id FROM users WHERE id = ${id} FOR UPDATE`
    const user = await tx.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        studentId: true,
        departmentId: true,
        memberStatus: true,
        status: true,
        updatedAt: true,
        roles: { where: { status: 'ACTIVE', role: { in: ['BOARD', 'TECH_ADMIN'] } }, select: { id: true } },
      },
    })
    if (!user) throw notFound()
    // RP-05: không tự thao tác trên tài khoản của chính mình.
    if (actor.user?.id === id) throw forbidden('Không thể thực hiện thao tác này trên tài khoản của chính bạn.')
    if (new Date(body.updatedAt).getTime() !== user.updatedAt.getTime()) {
      throw conflict('Thành viên vừa được người khác cập nhật. Vui lòng tải lại.')
    }
    // Email đăng nhập của tài khoản đặc quyền là đường chiếm quyền: không đổi ở trang thành viên.
    if (body.email && body.email !== user.email && user.roles.length > 0) {
      throw forbidden('Không đổi email của tài khoản BOARD hoặc TECH_ADMIN tại trang thành viên.')
    }

    // 1. Kiểm tra MSSV trùng
    if (body.studentId !== undefined && body.studentId !== user.studentId) {
      if (body.studentId) {
        const dupStudentId = await tx.user.findFirst({
          where: { studentId: body.studentId, id: { not: id } },
          select: { id: true },
        })
        if (dupStudentId) throw conflict('Mã số sinh viên đã tồn tại.')
      }
    }

    // 2. QĐ-8: Kiểm tra email tài khoản trùng
    if (body.email && body.email !== user.email) {
      const dupEmail = await tx.user.findFirst({
        where: { email: body.email, id: { not: id } },
        select: { id: true },
      })
      if (dupEmail) throw conflict('Email tài khoản đã tồn tại.')
    }

    // 3. Đổi ban (RP-08)
    if (body.departmentId !== undefined && body.departmentId !== user.departmentId) {
      if (body.departmentId !== null) {
        const dept = await tx.department.findUnique({
          where: { id: body.departmentId },
          select: { id: true, name: true, status: true },
        })
        if (!dept) throw notFound('Ban không tồn tại.')
        if (dept.status === 'ARCHIVED') {
          throw conflict('Không thể chuyển thành viên vào ban đã lưu trữ.')
        }
      }

      // RP-08: thu hồi các vai trò DEPARTMENT_MANAGER gắn với ban cũ của người đó trước khi đổi
      if (user.departmentId && user.departmentId !== body.departmentId) {
        await tx.userRole.updateMany({
          where: {
            userId: id,
            role: 'DEPARTMENT_MANAGER',
            departmentId: user.departmentId,
            status: { in: ['PENDING', 'ACTIVE'] },
          },
          data: {
            status: 'REVOKED',
            revokedAt: now,
            revokedById: actor.user?.id ?? null,
            revokeReason: `Đổi ban: ${body.reason}`,
          },
        })
      }

      await audit(
        actor,
        {
          action: AUDIT_ACTIONS.MEMBER_CHANGE_DEPARTMENT,
          targetType: 'USER',
          targetId: id,
          category: AuditCategory.BUSINESS,
          result: AuditResult.SUCCESS,
          reason: body.reason,
          metadata: { oldDepartmentId: user.departmentId, newDepartmentId: body.departmentId },
        },
        tx,
      )
    }

    // 4. Đổi trạng thái thành viên (PRD §9.2, QĐ-3, RP-09)
    if (body.memberStatus && body.memberStatus !== user.memberStatus) {
      const currentStatus = user.memberStatus
      const nextStatus = body.memberStatus

      const allowedTransitions: Record<MemberStatus, MemberStatus[]> = {
        ACTIVE: ['PAUSED', 'LEFT'],
        PAUSED: ['ACTIVE', 'LEFT'],
        LEFT: [],
      }

      if (!allowedTransitions[currentStatus]?.includes(nextStatus)) {
        throw conflict(`Không thể chuyển trạng thái từ ${currentStatus} sang ${nextStatus}.`)
      }

      if (nextStatus === 'LEFT') {
        // QĐ-3, RP-09: thành viên chuyển Ngừng tham gia thì tài khoản chuyển Ngừng hoạt động,
        // mọi phiên và vai trò quản lý bị thu hồi trong cùng transaction.
        await deactivateAccount(
          tx,
          actor,
          id,
          {
            reason: body.reason,
            enforcePrivilegedMinimum: options.enforcePrivilegedMinimum,
          },
          now,
        )
      }

      await audit(
        actor,
        {
          action: AUDIT_ACTIONS.MEMBER_CHANGE_STATUS,
          targetType: 'USER',
          targetId: id,
          category: AuditCategory.BUSINESS,
          result: AuditResult.SUCCESS,
          reason: body.reason,
          metadata: { oldStatus: currentStatus, newStatus: nextStatus },
        },
        tx,
      )
    }

    // 5. Audit cập nhật MSSV / email
    const changedFields: string[] = []
    if (body.studentId !== undefined && body.studentId !== user.studentId) changedFields.push('studentId')
    if (body.email && body.email !== user.email) changedFields.push('email')
    if (changedFields.length > 0) {
      await audit(
        actor,
        {
          action: AUDIT_ACTIONS.MEMBER_UPDATE_MANAGED,
          targetType: 'USER',
          targetId: id,
          category: AuditCategory.BUSINESS,
          result: AuditResult.SUCCESS,
          reason: body.reason,
          metadata: { changedFields },
        },
        tx,
      )
    }

    // Cập nhật thông tin vào user
    const updated = await tx.user.update({
      where: { id },
      data: {
        ...(body.studentId !== undefined ? { studentId: body.studentId || null } : {}),
        ...(body.email ? { email: body.email } : {}),
        ...(body.departmentId !== undefined ? { departmentId: body.departmentId } : {}),
        ...(body.memberStatus ? { memberStatus: body.memberStatus } : {}),
      },
      select: {
        id: true,
        fullName: true,
        studentId: true,
        email: true,
        memberStatus: true,
        status: true,
        departmentId: true,
        updatedAt: true,
      },
    })

    return updated
  })
}

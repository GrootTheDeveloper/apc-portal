import { z } from 'zod'

import { db } from '../../db/client.js'
import type { Prisma } from '../../db/generated/client.js'
import type { Role } from '../../db/generated/enums.js'
import { notFound } from '../../lib/errors.js'
import { pageArgs, pageQuery, toPage } from '../../lib/pagination.js'
import { activeRoleWhere } from '../accounts/privileged.js'

/** Query danh bạ thành viên (T6, OPS-11): chỉ tìm theo tên, lọc ban, phân trang — không tìm theo email/MSSV. */
export const directoryQuerySchema = pageQuery.extend({
  q: z.string().trim().max(120).optional(),
  departmentId: z.string().trim().max(64).optional(),
})

export const directoryParamsSchema = z.object({
  id: z.string().trim().min(1).max(64),
})

/** Điều kiện thành viên hiện hữu trong danh bạ: loại bỏ thành viên đã rời CLB (LEFT) hoặc ngừng hoạt động (INACTIVE). */
const directoryVisibleWhere: Prisma.UserWhereInput = {
  memberStatus: { not: 'LEFT' },
  status: { not: 'INACTIVE' },
}

/**
 * MEM-10: Chọn đúng các trường được phép ngay trong truy vấn Prisma (họ tên, ảnh đại diện, ban, vai trò,
 * kỹ năng, lĩnh vực quan tâm). Tuyệt đối không lấy studentId, email, contactEmail, phoneNumber hay username.
 */
function directorySelect(now: Date) {
  return {
    id: true,
    fullName: true,
    avatarUrl: true,
    skills: true,
    interestAreas: true,
    department: {
      select: { id: true, name: true, code: true },
    },
    roles: {
      where: activeRoleWhere(now),
      select: {
        role: true,
        departmentId: true,
        department: { select: { id: true, name: true, code: true } },
      },
      orderBy: { startsAt: 'desc' },
    },
  } satisfies Prisma.UserSelect
}

type DirectoryRow = Prisma.UserGetPayload<{ select: ReturnType<typeof directorySelect> }>

function normalizeStringList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .filter((item): item is string => typeof item === 'string')
      .map((item) => item.trim())
      .filter(Boolean)
  }
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
  }
  return []
}

function toDirectoryMember(row: DirectoryRow) {
  const roles: {
    role: Role
    departmentId: string | null
    department: { id: string; name: string; code: string } | null
  }[] = [
    {
      role: 'MEMBER',
      departmentId: row.department?.id ?? null,
      department: row.department,
    },
    ...row.roles
      .filter((grant) => grant.role !== 'MEMBER')
      .map((grant) => ({
        role: grant.role,
        departmentId: grant.departmentId,
        department: grant.department,
      })),
  ]

  return {
    id: row.id,
    fullName: row.fullName,
    avatarUrl: row.avatarUrl,
    department: row.department,
    roles,
    skills: normalizeStringList(row.skills),
    interestAreas: normalizeStringList(row.interestAreas),
  }
}

export async function listDirectoryMembers(rawQuery: unknown, now = new Date()) {
  const query = directoryQuerySchema.parse(rawQuery ?? {})
  const where: Prisma.UserWhereInput = {
    ...directoryVisibleWhere,
    ...(query.departmentId ? { departmentId: query.departmentId } : {}),
    ...(query.q ? { fullName: { contains: query.q, mode: 'insensitive' } } : {}),
  }

  const select = directorySelect(now)
  const [rows, total] = await db.$transaction([
    db.user.findMany({
      where,
      select,
      orderBy: [{ fullName: 'asc' }, { id: 'asc' }],
      ...pageArgs(query),
    }),
    db.user.count({ where }),
  ])

  return toPage(rows.map(toDirectoryMember), total, query)
}

export async function getDirectoryMember(rawParams: unknown, now = new Date()) {
  const { id } = directoryParamsSchema.parse(rawParams)
  const member = await db.user.findFirst({
    where: { id, ...directoryVisibleWhere },
    select: directorySelect(now),
  })
  if (!member) throw notFound('Không tìm thấy thành viên.')
  return toDirectoryMember(member)
}

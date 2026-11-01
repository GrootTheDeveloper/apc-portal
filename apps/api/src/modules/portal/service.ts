import { z } from 'zod'

import { db } from '../../db/client.js'
import { conflict, notFound } from '../../lib/errors.js'
import type { AuthUser } from '../auth/rbac.js'

// Schema Zod strict: chỉ nhận avatarUrl, contactEmail, skills, interestAreas, và updatedAt (đối chiếu xung đột).
// Bất kỳ trường nào khác (studentId, email, departmentId, role, memberStatus...) đều bị từ chối 422 (FLOW-12, T3).
export const updateProfileSchema = z
  .object({
    avatarUrl: z.string().trim().nullable().optional().or(z.literal('')),
    contactEmail: z
      .string()
      .trim()
      .email('Email liên hệ không đúng định dạng.')
      .nullable()
      .optional()
      .or(z.literal('')),
    skills: z.array(z.string().trim().min(1, 'Kỹ năng không được để trống.')).optional(),
    interestAreas: z.array(z.string().trim().min(1, 'Lĩnh vực quan tâm không được để trống.')).optional(),
    updatedAt: z.string().datetime({ message: 'updatedAt phải là định dạng ISO 8601.' }).optional(),
  })
  .strict()

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>

export async function getProfile(userId: string) {
  const user = await db.user.findUnique({
    where: { id: userId },
    include: {
      department: {
        select: { id: true, name: true, code: true },
      },
    },
  })
  if (!user) throw notFound()

  return {
    id: user.id,
    username: user.username,
    fullName: user.fullName,
    email: user.email,
    contactEmail: user.contactEmail,
    avatarUrl: user.avatarUrl,
    studentId: user.studentId,
    faculty: user.faculty,
    major: user.major,
    cohort: user.cohort,
    phoneNumber: user.phoneNumber,
    skills: Array.isArray(user.skills) ? (user.skills as string[]) : [],
    interestAreas: Array.isArray(user.interestAreas) ? (user.interestAreas as string[]) : [],
    departmentId: user.departmentId,
    department: user.department,
    memberStatus: user.memberStatus,
    updatedAt: user.updatedAt.toISOString(),
    editableFields: ['avatarUrl', 'contactEmail', 'skills', 'interestAreas'] as const,
  }
}

export async function updateProfile(userId: string, input: UpdateProfileInput) {
  const current = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, updatedAt: true },
  })
  if (!current) throw notFound()

  // STATE-09: Phát hiện xung đột phiên bản nếu updatedAt không khớp
  if (input.updatedAt && current.updatedAt.toISOString() !== input.updatedAt) {
    throw conflict('Dữ liệu hồ sơ đã thay đổi từ một phiên khác. Vui lòng tải lại trang.')
  }

  const updateData: {
    avatarUrl?: string | null
    contactEmail?: string | null
    skills?: string[]
    interestAreas?: string[]
  } = {}

  if (input.avatarUrl !== undefined) {
    updateData.avatarUrl = input.avatarUrl === '' ? null : input.avatarUrl
  }
  if (input.contactEmail !== undefined) {
    updateData.contactEmail = input.contactEmail === '' ? null : input.contactEmail
  }
  if (input.skills !== undefined) {
    updateData.skills = input.skills
  }
  if (input.interestAreas !== undefined) {
    updateData.interestAreas = input.interestAreas
  }

  await db.user.update({
    where: { id: userId },
    data: updateData,
  })

  return getProfile(userId)
}

export async function getRoles(user: AuthUser) {
  const [userData, storedRoles] = await Promise.all([
    db.user.findUnique({
      where: { id: user.id },
      select: {
        createdAt: true,
        department: { select: { id: true, name: true, code: true } },
      },
    }),
    db.userRole.findMany({
      where: { userId: user.id },
      include: {
        department: { select: { id: true, name: true, code: true } },
      },
      orderBy: { startsAt: 'desc' },
    }),
  ])

  if (!userData) throw notFound()

  // Vai trò nền MEMBER luôn có cho mọi tài khoản
  const baseMemberRole = {
    id: `base-member-${user.id}`,
    role: 'MEMBER' as const,
    departmentId: user.departmentId,
    department: userData.department,
    status: 'ACTIVE' as const,
    startsAt: userData.createdAt.toISOString(),
    expiresAt: null,
    isBaseRole: true,
  }

  // Không trả lý do, người cấp (docs/plan/T-thanh-vien.md T3)
  const roleItems = storedRoles.map((r) => ({
    id: r.id,
    role: r.role,
    departmentId: r.departmentId,
    department: r.department,
    status: r.status,
    startsAt: r.startsAt.toISOString(),
    expiresAt: r.expiresAt ? r.expiresAt.toISOString() : null,
    isBaseRole: false,
  }))

  return [baseMemberRole, ...roleItems]
}

export async function getActivity(_userId: string) {
  // EventRegistration sẽ có khi việc E2 merge (T3 ghi nhận)
  return {
    items: [],
    total: 0,
    page: 1,
    pageSize: 20,
  }
}

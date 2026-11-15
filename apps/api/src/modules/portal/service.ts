import { z } from 'zod'

import { db } from '../../db/client.js'
import { AppError, conflict, notFound } from '../../lib/errors.js'
import { type PageQuery, pageArgs, toPage } from '../../lib/pagination.js'

// Schema Zod strict: chỉ nhận avatarFileId, contactEmail, skills, interestAreas, và updatedAt (đối chiếu xung đột).
// Bất kỳ trường nào khác (studentId, email, departmentId, role, memberStatus...) đều bị từ chối 422 (FLOW-12, T3).
export const updateProfileSchema = z
  .object({
    avatarFileId: z.string().cuid('Mã tệp không đúng định dạng.').nullable().optional(),
    contactEmail: z
      .string()
      .trim()
      .max(254, 'Email liên hệ không được vượt quá 254 ký tự.')
      .email('Email liên hệ không đúng định dạng.')
      .nullable()
      .optional()
      .or(z.literal('')),
    skills: z
      .array(z.string().trim().min(1, 'Kỹ năng không được để trống.').max(50, 'Mỗi kỹ năng tối đa 50 ký tự.'))
      .max(20, 'Tối đa 20 kỹ năng.')
      .optional(),
    interestAreas: z
      .array(z.string().trim().min(1, 'Lĩnh vực không được để trống.').max(50, 'Mỗi lĩnh vực tối đa 50 ký tự.'))
      .max(20, 'Tối đa 20 lĩnh vực quan tâm.')
      .optional(),
    updatedAt: z.string().datetime({ message: 'updatedAt phải là định dạng ISO 8601.' }),
  })
  .strict()

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>

export async function getProfile(userId: string) {
  const [user, roles, pendingAvatar] = await Promise.all([
    db.user.findUnique({
      where: { id: userId },
      include: {
        department: {
          select: { id: true, name: true, code: true },
        },
      },
    }),
    getRoles({ id: userId }),
    db.storedFile.findFirst({
      where: {
        uploadedById: userId,
        purpose: 'AVATAR',
        scanStatus: 'PENDING',
      },
      select: { id: true },
    }),
  ])
  if (!user) throw notFound()

  return {
    id: user.id,
    username: user.username,
    fullName: user.fullName,
    email: user.email,
    contactEmail: user.contactEmail,
    avatarUrl: user.avatarUrl,
    avatarProcessing: Boolean(pendingAvatar),
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
    roles,
    updatedAt: user.updatedAt.toISOString(),
    editableFields: ['avatarFileId', 'contactEmail', 'skills', 'interestAreas'] as const,
  }
}

export async function updateProfile(userId: string, input: UpdateProfileInput) {
  const current = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, updatedAt: true, avatarUrl: true },
  })
  if (!current) throw notFound()

  const updateData: {
    avatarUrl?: string | null
    contactEmail?: string | null
    skills?: string[]
    interestAreas?: string[]
  } = {}

  if (input.avatarFileId !== undefined) {
    if (input.avatarFileId === null) {
      updateData.avatarUrl = null
    } else {
      const file = await db.storedFile.findUnique({
        where: { id: input.avatarFileId },
      })
      if (!file || file.uploadedById !== userId || file.purpose !== 'AVATAR') {
        throw new AppError(422, 'validation', 'Tệp ảnh không hợp lệ.')
      }
      if (file.scanStatus === 'REJECTED') {
        throw new AppError(422, 'validation', 'Tệp ảnh bị từ chối do chứa mã độc.')
      }
      if (file.scanStatus === 'CLEAN') {
        updateData.avatarUrl = `/api/portal/files/${file.id}`
      }
      // Khi scanStatus === 'PENDING': không đổi avatarUrl, giữ ảnh cũ (FLOW-12)
    }
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

  // STATE-09: Kiểm tra xung đột phiên bản nguyên tử bằng updateMany
  if (Object.keys(updateData).length > 0) {
    const result = await db.user.updateMany({
      where: {
        id: userId,
        updatedAt: new Date(input.updatedAt),
      },
      data: updateData,
    })

    if (result.count === 0) {
      throw conflict('Dữ liệu hồ sơ đã thay đổi từ một phiên khác. Vui lòng tải lại trang.')
    }
  } else {
    if (current.updatedAt.toISOString() !== input.updatedAt) {
      throw conflict('Dữ liệu hồ sơ đã thay đổi từ một phiên khác. Vui lòng tải lại trang.')
    }
  }

  return getProfile(userId)
}

export async function getRoles(user: { id: string }) {
  const [userData, storedRoles] = await Promise.all([
    db.user.findUnique({
      where: { id: user.id },
      select: {
        createdAt: true,
        departmentId: true,
        department: { select: { id: true, name: true, code: true } },
      },
    }),
    db.userRole.findMany({
      where: {
        userId: user.id,
        role: { not: 'MEMBER' },
      },
      include: {
        department: { select: { id: true, name: true, code: true } },
      },
      orderBy: { startsAt: 'desc' },
    }),
  ])

  if (!userData) throw notFound()

  const now = new Date()

  // Vai trò nền MEMBER luôn có cho mọi tài khoản
  const baseMemberRole = {
    id: `base-member-${user.id}`,
    role: 'MEMBER' as const,
    departmentId: userData.departmentId,
    department: userData.department,
    status: 'ACTIVE' as const,
    startsAt: userData.createdAt.toISOString(),
    expiresAt: null,
    isBaseRole: true,
  }

  // Không trả lý do, người cấp (docs/plan/T-thanh-vien.md T3).
  // Đánh giá hiệu lực thời gian thực: nếu đã quá hạn expiresAt thì chuyển trạng thái thành EXPIRED.
  const roleItems = storedRoles.map((r) => {
    const isExpired = r.expiresAt !== null && r.expiresAt <= now
    const effectiveStatus = isExpired ? ('EXPIRED' as const) : r.status

    return {
      id: r.id,
      role: r.role,
      departmentId: r.departmentId,
      department: r.department,
      status: effectiveStatus,
      startsAt: r.startsAt.toISOString(),
      expiresAt: r.expiresAt ? r.expiresAt.toISOString() : null,
      isBaseRole: false,
    }
  })

  return [baseMemberRole, ...roleItems]
}

export async function getActivity(userId: string, query: PageQuery = { page: 1, pageSize: 20 }) {
  const where = { userId }
  const [registrations, total] = await Promise.all([
    db.eventRegistration.findMany({
      where,
      include: {
        event: {
          select: {
            id: true,
            title: true,
            slug: true,
            startAt: true,
            endAt: true,
            location: true,
            onlineUrl: true,
          },
        },
      },
      orderBy: { registeredAt: 'desc' },
      ...pageArgs(query),
    }),
    db.eventRegistration.count({ where }),
  ])

  const items = registrations.map((r) => ({
    id: r.id,
    registrationCode: r.registrationCode,
    status: r.status,
    attendanceStatus: r.attendanceStatus,
    registeredAt: r.registeredAt.toISOString(),
    cancelledAt: r.cancelledAt ? r.cancelledAt.toISOString() : null,
    event: {
      id: r.event.id,
      title: r.event.title,
      slug: r.event.slug,
      startAt: r.event.startAt.toISOString(),
      endAt: r.event.endAt.toISOString(),
      location: r.event.location,
      onlineUrl: r.event.onlineUrl,
    },
  }))

  return toPage(items, total, query)
}

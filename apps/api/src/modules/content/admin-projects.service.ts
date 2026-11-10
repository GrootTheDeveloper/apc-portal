import { z } from 'zod'

import { db } from '../../db/client.js'
import { ContentStatus, ProjectType } from '../../db/generated/client.js'
import { conflict, forbidden, notFound } from '../../lib/errors.js'
import { buildUniqueSlug, slugify } from '../../lib/ids.js'
import { pageArgs, pageQuery } from '../../lib/pagination.js'
import { type AuthUser, assertInScope, departmentScope, hasRole } from '../auth/rbac.js'
import { hasActiveConsent } from '../consent/service.js'

// ─── SCHEMA VALIDATION ───────────────────────────────────────────────────────

/** Query params cho danh sách dự án quản trị. */
export const adminProjectListQuery = pageQuery.extend({
  status: z.nativeEnum(ContentStatus).optional(),
  type: z.nativeEnum(ProjectType).optional(),
  departmentId: z.string().optional(),
})

/** Link chỉ nhận http/https — chặn javascript:, ftp: và scheme lạ (PRT-04). Rỗng thì lưu null. */
const httpOrHttpsUrl = z
  .string()
  .trim()
  .url('Link phải là URL hợp lệ.')
  .refine((u) => /^https?:\/\//i.test(u), { message: 'Chỉ nhận http hoặc https.' })
  .or(z.literal(''))

export const projectBase = z.object({
  type: z.enum(['PROJECT', 'PRODUCT']),
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().optional(),
  // thumbnailUrl lưu fileId từ POST /portal/files (D2); '' hoặc null nghĩa là không có ảnh
  thumbnailUrl: z.string().cuid().or(z.literal('')).or(z.null()).optional(),
  technologies: z.array(z.string().trim().min(1)).max(50).optional(),
  projectUrl: httpOrHttpsUrl.optional(),
  sourceUrl: httpOrHttpsUrl.optional(),
  memberIds: z.array(z.string().cuid()).max(200).optional(),
  // CHỈ Board được đặt ban; Manager gửi giá trị này sẽ bị bỏ qua ở service
  departmentId: z.string().cuid().nullable().optional(),
})

/**
 * Kiểm tra phụ thuộc DB sau khi Zod đã duyệt hình dạng dữ liệu.
 * Lỗi được thêm thẳng vào `issues` của ZodError nên handler trả 422 chuẩn.
 */
async function validateProjectInput(
  body: { thumbnailUrl?: string | null | undefined; memberIds?: string[] | undefined },
  ctx: z.RefinementCtx,
) {
  // Ảnh bìa: fileId phải tồn tại trong kho và đã quét sạch (D2)
  if (body.thumbnailUrl) {
    const file = await db.storedFile.findUnique({
      where: { id: body.thumbnailUrl },
      select: { scanStatus: true },
    })
    if (!file || file.scanStatus !== 'CLEAN') {
      ctx.addIssue({
        code: 'custom',
        message: 'Ảnh bìa không tồn tại hoặc chưa được quét sạch.',
        path: ['thumbnailUrl'],
      })
    }
  }
  // Thành viên: mỗi id phải là tài khoản ACTIVE
  if (body.memberIds && body.memberIds.length > 0) {
    const users = await db.user.findMany({
      where: { id: { in: body.memberIds }, status: 'ACTIVE' },
      select: { id: true },
    })
    const validIds = new Set(users.map((u) => u.id))
    for (const id of body.memberIds) {
      if (!validIds.has(id)) {
        ctx.addIssue({
          code: 'custom',
          message: `Thành viên ${id} không tồn tại hoặc tài khoản chưa kích hoạt.`,
          path: ['memberIds'],
        })
      }
    }
  }
}

export const createProjectBody = projectBase.superRefine(async (body, ctx) => {
  await validateProjectInput(body, ctx)
})

/** Body cập nhật dự án — mọi trường tùy chọn. OCC bắt buộc qua updatedAt. */
export const updateProjectBody = projectBase
  .partial()
  .extend({
    /** Phiên bản client biết (ISO string của updatedAt) — dùng cho OCC check. */
    updatedAt: z.string().datetime(),
  })
  .superRefine(async (body, ctx) => {
    await validateProjectInput(body, ctx)
  })

// ─── SELECT SETS ─────────────────────────────────────────────────────────────

/** Trường trả về trong danh sách và chi tiết admin. */
const adminProjectSelect = {
  id: true,
  title: true,
  slug: true,
  description: true,
  thumbnailUrl: true,
  technologies: true,
  projectUrl: true,
  sourceUrl: true,
  type: true,
  status: true,
  departmentId: true,
  createdById: true,
  publishedAt: true,
  createdAt: true,
  updatedAt: true,
} as const

// ─── HELPERS ─────────────────────────────────────────────────────────────────

/**
 * Danh sách thành viên kèm trạng thái đồng ý công khai (chỉ đọc) cho dự án này:
 * đồng ý riêng cho dự án HOẶC đồng ý chung (MEM-12, FLOW-18 bước 2).
 */
async function listProjectMembers(projectId: string) {
  const rows = await db.projectMember.findMany({
    where: { projectId },
    include: { user: { select: { id: true, fullName: true } } },
    orderBy: [{ createdAt: 'asc' }, { userId: 'asc' }],
  })
  return Promise.all(
    rows.map(async ({ user }) => ({
      userId: user.id,
      name: user.fullName,
      publicNameConsent: await hasActiveConsent({
        subjectType: 'USER',
        subjectId: user.id,
        purpose: 'PUBLIC_NAME',
        targetType: 'PROJECT',
        targetId: projectId,
      }),
      publicPhotoConsent: await hasActiveConsent({
        subjectType: 'USER',
        subjectId: user.id,
        purpose: 'PUBLIC_PHOTO',
        targetType: 'PROJECT',
        targetId: projectId,
      }),
    })),
  )
}

// ─── SERVICE FUNCTIONS ────────────────────────────────────────────────────────

/** Danh sách dự án quản trị, lọc theo phạm vi ban của người gọi. */
export async function listAdminProjects(user: AuthUser, rawQuery: unknown) {
  const query = adminProjectListQuery.parse(rawQuery)

  // Lọc phạm vi ban: BOARD thấy tất cả, DEPARTMENT_MANAGER chỉ thấy ban mình.
  // Bộ lọc departmentId tùy chọn chỉ áp dụng cho BOARD — Manager không được dò dữ liệu ban khác.
  const where = {
    ...departmentScope(user),
    ...(query.status ? { status: query.status } : {}),
    ...(query.type ? { type: query.type } : {}),
    ...(query.departmentId && hasRole(user, 'BOARD') ? { departmentId: query.departmentId } : {}),
  }

  const [items, total] = await db.$transaction([
    db.project.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: adminProjectSelect,
      ...pageArgs(query),
    }),
    db.project.count({ where }),
  ])

  return { items, total, page: query.page, pageSize: query.pageSize }
}

/** Chi tiết dự án quản trị theo id, kèm members + trạng thái consent; 404 nếu ngoài phạm vi ban. */
export async function getAdminProject(user: AuthUser, id: string) {
  const project = await db.project.findUnique({ where: { id }, select: adminProjectSelect })
  if (!project) throw notFound('Không tìm thấy dự án.')
  assertInScope(user, project.departmentId)
  const members = await listProjectMembers(id)
  return { ...project, members }
}

/** Tạo dự án mới, luôn status = DRAFT. createdById = user hiện tại. */
export async function createAdminProject(user: AuthUser, rawBody: unknown) {
  const body = await createProjectBody.parseAsync(rawBody)

  if (hasRole(user, 'DEPARTMENT_MANAGER') && !user.departmentId) throw forbidden('Tài khoản quản lý chưa được gán ban.')

  const slug = await buildUniqueSlug(slugify(body.title), (candidate) =>
    db.project.findUnique({ where: { slug: candidate }, select: { id: true } }).then(Boolean),
  )

  // Manager luôn gắn ban đang hoạt động của mình, bỏ qua departmentId client gửi;
  // BOARD tự chọn ban, không gửi thì là dự án toàn CLB (null).
  const departmentId = hasRole(user, 'BOARD') ? (body.departmentId ?? null) : user.departmentId
  const memberIds = body.memberIds ?? []

  return db.$transaction(async (tx) => {
    const project = await tx.project.create({
      data: {
        title: body.title,
        slug,
        description: body.description ?? '',
        type: body.type,
        thumbnailUrl: body.thumbnailUrl || null,
        technologies: body.technologies ?? [],
        projectUrl: body.projectUrl || null,
        sourceUrl: body.sourceUrl || null,
        departmentId,
        createdById: user.id,
        status: 'DRAFT',
      },
      select: adminProjectSelect,
    })
    if (memberIds.length > 0) {
      await tx.projectMember.createMany({
        data: memberIds.map((userId) => ({ projectId: project.id, userId })),
      })
    }
    return project
  })
}

/**
 * Cập nhật dự án (OCC bằng updatedAt).
 * - Slug đóng băng: đổi title KHÔNG đổi slug (spec C4, khác C3).
 * - DEPARTMENT_MANAGER chỉ sửa dự án DRAFT của ban mình, không đổi được ban.
 * - BOARD sửa mọi dự án, được đổi departmentId.
 * - memberIds gửi kèm thì xóa hết thành viên cũ và chèn lại (cùng transaction).
 */
export async function updateAdminProject(user: AuthUser, id: string, rawBody: unknown) {
  const body = await updateProjectBody.parseAsync(rawBody)
  const { updatedAt: clientUpdatedAt, ...fields } = body

  const project = await db.project.findUnique({
    where: { id },
    select: { departmentId: true, status: true, updatedAt: true },
  })
  if (!project) throw notFound('Không tìm thấy dự án.')
  assertInScope(user, project.departmentId)

  if (!hasRole(user, 'BOARD') && project.status !== 'DRAFT') {
    throw forbidden('Quản lý ban chỉ được sửa dự án ở trạng thái Ẩn.')
  }

  // OCC: so sánh updatedAt client gửi với DB
  if (project.updatedAt.toISOString() !== clientUpdatedAt) {
    throw conflict('Dự án đã được chỉnh sửa bởi người khác. Vui lòng tải lại trang.')
  }

  // Manager không được đổi ban; BOARD được đổi kể cả về null (toàn CLB)
  const departmentId =
    hasRole(user, 'BOARD') && fields.departmentId !== undefined ? fields.departmentId : undefined

  return db.$transaction(async (tx) => {
    const updated = await tx.project.update({
      where: { id },
      data: {
        ...(fields.title !== undefined && { title: fields.title }),
        ...(fields.description !== undefined && { description: fields.description }),
        ...(fields.type !== undefined && { type: fields.type }),
        ...(fields.thumbnailUrl !== undefined && { thumbnailUrl: fields.thumbnailUrl || null }),
        ...(fields.technologies !== undefined && { technologies: fields.technologies }),
        ...(fields.projectUrl !== undefined && { projectUrl: fields.projectUrl || null }),
        ...(fields.sourceUrl !== undefined && { sourceUrl: fields.sourceUrl || null }),
        ...(departmentId !== undefined && { departmentId }),
      },
      select: adminProjectSelect,
    })
    if (fields.memberIds !== undefined) {
      await tx.projectMember.deleteMany({ where: { projectId: id } })
      if (fields.memberIds.length > 0) {
        await tx.projectMember.createMany({
          data: fields.memberIds.map((userId) => ({ projectId: id, userId })),
        })
      }
    }
    return updated
  })
}

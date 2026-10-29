import type { FastifyRequest } from 'fastify'
import { z } from 'zod'

import { db } from '../../db/client.js'
import { ContentScope, ContentStatus } from '../../db/generated/client.js'
import { conflict, forbidden, notFound } from '../../lib/errors.js'
import { slugify } from '../../lib/ids.js'
import { pageArgs, pageQuery } from '../../lib/pagination.js'
import { AUDIT_ACTIONS, audit, AuditCategory, AuditResult } from '../audit/service.js'
import { type AuthUser, assertInScope, departmentScope, hasRole } from '../auth/rbac.js'
import { hasActiveConsent } from '../consent/service.js'

// ─── SCHEMA VALIDATION ───────────────────────────────────────────────────────

/** Query params cho danh sách bài viết quản trị. */
export const adminPostListQuery = pageQuery.extend({
  status: z.nativeEnum(ContentStatus).optional(),
  category: z.string().trim().min(1).optional(),
  departmentId: z.string().optional(),
  scope: z.nativeEnum(ContentScope).optional(),
})

/** Body tạo bài viết mới. */
export const createPostBody = z.object({
  title: z.string().trim().min(1).max(255),
  summary: z.string().trim().min(1).max(500),
  content: z.string().trim().min(1),
  category: z.string().trim().min(1).max(100),
  scope: z.nativeEnum(ContentScope).default('PUBLIC'),
  thumbnailUrl: z.string().optional(),    // lưu fileId từ /portal/files
  metaTitle: z.string().trim().max(70).optional(),
  metaDescription: z.string().trim().max(160).optional(),
})

/** Body cập nhật bài viết — mọi trường đều tùy chọn. OCC bắt buộc qua updatedAt. */
export const updatePostBody = z.object({
  title: z.string().trim().min(1).max(255).optional(),
  summary: z.string().trim().min(1).max(500).optional(),
  content: z.string().trim().min(1).optional(),
  category: z.string().trim().min(1).max(100).optional(),
  scope: z.nativeEnum(ContentScope).optional(),
  thumbnailUrl: z.string().nullable().optional(),
  metaTitle: z.string().trim().max(70).nullable().optional(),
  metaDescription: z.string().trim().max(160).nullable().optional(),
  /** Phiên bản client biết (ISO string của updatedAt) — dùng cho OCC check. */
  updatedAt: z.string().datetime(),
})

/** Body thay đổi trạng thái bài viết. */
export const changeStatusBody = z.object({
  action: z.enum(['PUBLISH', 'UNPUBLISH', 'ARCHIVE']),
  /**
   * Danh sách userId được nhắc đến trong bài (MEM-12).
   * Chỉ có ý nghĩa khi action = PUBLISH; bỏ qua ở hành động khác.
   */
  mentionedUserIds: z.array(z.string()).optional(),
})

// ─── HELPERS ─────────────────────────────────────────────────────────────────

/** Tạo slug duy nhất: thử base slug, nếu trùng thêm hậu tố ngẫu nhiên. */
async function buildUniqueSlug(title: string): Promise<string> {
  const base = slugify(title)
  // Thử slug gốc trước
  const existing = await db.post.findUnique({ where: { slug: base }, select: { id: true } })
  if (!existing) return base
  // Thêm hậu tố 6 ký tự ngẫu nhiên để đảm bảo duy nhất
  const suffix = Math.random().toString(36).slice(2, 8)
  return `${base}-${suffix}`
}

/** Trả về departmentId phù hợp với user: DEPARTMENT_MANAGER lấy ban đầu tiên họ quản lý,
 *  BOARD không ép ban nào (bài viết toàn CLB). */
function resolveAuthorDepartmentId(user: AuthUser): string | null {
  if (hasRole(user, 'BOARD')) return null
  // Lấy ban đầu tiên DEPARTMENT_MANAGER đang quản lý
  const managerGrant = user.roles.find(
    (g) => g.role === 'DEPARTMENT_MANAGER' && g.departmentId !== null,
  )
  return managerGrant?.departmentId ?? user.departmentId ?? null
}

// ─── SELECT SETS ─────────────────────────────────────────────────────────────

/** Trường trả về trong danh sách admin — bao gồm trạng thái nội bộ. */
const adminPostListSelect = {
  id: true,
  title: true,
  slug: true,
  summary: true,
  thumbnailUrl: true,
  category: true,
  scope: true,
  status: true,
  departmentId: true,
  authorId: true,
  publishedAt: true,
  createdAt: true,
  updatedAt: true,
} as const

/** Trường trả về ở trang chi tiết admin — thêm content, SEO, publishedBy. */
const adminPostDetailSelect = {
  ...adminPostListSelect,
  content: true,
  metaTitle: true,
  metaDescription: true,
  publishedById: true,
} as const

// ─── SERVICE FUNCTIONS ────────────────────────────────────────────────────────

/** Danh sách bài viết quản trị, lọc theo phạm vi ban của người gọi. */
export async function listAdminPosts(user: AuthUser, rawQuery: unknown) {
  const query = adminPostListQuery.parse(rawQuery)

  // Lọc phạm vi ban: BOARD thấy tất cả, DEPARTMENT_MANAGER chỉ thấy ban mình
  const scopeFilter = departmentScope(user)

  const where = {
    ...scopeFilter,
    ...(query.status ? { status: query.status } : {}),
    ...(query.category ? { category: query.category } : {}),
    ...(query.departmentId ? { departmentId: query.departmentId } : {}),
    ...(query.scope ? { scope: query.scope } : {}),
  }

  const [items, total] = await db.$transaction([
    db.post.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: adminPostListSelect,
      ...pageArgs(query),
    }),
    db.post.count({ where }),
  ])

  return { items, total, page: query.page, pageSize: query.pageSize }
}

/** Chi tiết bài viết quản trị theo id; 404 nếu không tồn tại hoặc ngoài phạm vi ban. */
export async function getAdminPost(user: AuthUser, id: string) {
  const post = await db.post.findUnique({ where: { id }, select: adminPostDetailSelect })
  if (!post) throw notFound('Không tìm thấy bài viết.')
  // Ngoài phạm vi ban → 404 (docs/02 §12.4, không để lộ sự tồn tại)
  assertInScope(user, post.departmentId)
  return post
}

/** Tạo bài viết mới với trạng thái DRAFT. authorId = user hiện tại. */
export async function createAdminPost(user: AuthUser, rawBody: unknown) {
  const body = createPostBody.parse(rawBody)
  const slug = await buildUniqueSlug(body.title)
  const departmentId = resolveAuthorDepartmentId(user)

  const post = await db.post.create({
    data: {
      title: body.title,
      slug,
      summary: body.summary,
      content: body.content,
      category: body.category,
      scope: body.scope,
      thumbnailUrl: body.thumbnailUrl ?? null,
      metaTitle: body.metaTitle ?? null,
      metaDescription: body.metaDescription ?? null,
      authorId: user.id,
      departmentId,
      status: 'DRAFT',
    },
    select: adminPostDetailSelect,
  })

  return post
}

/**
 * Cập nhật bài viết (OCC bằng updatedAt).
 * - DEPARTMENT_MANAGER chỉ sửa được bài DRAFT của ban mình.
 * - BOARD sửa được mọi bài.
 */
export async function updateAdminPost(user: AuthUser, id: string, rawBody: unknown) {
  const body = updatePostBody.parse(rawBody)
  const { updatedAt: clientUpdatedAt, ...fields } = body

  const post = await db.post.findUnique({
    where: { id },
    select: { departmentId: true, status: true, updatedAt: true },
  })
  if (!post) throw notFound('Không tìm thấy bài viết.')

  // Kiểm tra phạm vi ban (404 nếu ngoài phạm vi)
  assertInScope(user, post.departmentId)

  // DEPARTMENT_MANAGER chỉ được sửa bài DRAFT của ban mình
  if (!hasRole(user, 'BOARD') && post.status !== 'DRAFT') {
    throw forbidden('Quản lý ban chỉ được sửa bài ở trạng thái Nháp.')
  }

  // OCC: so sánh updatedAt client gửi với DB
  if (post.updatedAt.toISOString() !== clientUpdatedAt) {
    throw conflict('Bài viết đã được chỉnh sửa bởi người khác. Vui lòng tải lại trang.')
  }

  // Nếu title thay đổi, tạo slug mới
  let titleUpdate: { title: string; slug: string } | undefined
  if (fields.title) {
    const newSlug = await buildUniqueSlug(fields.title)
    titleUpdate = { title: fields.title, slug: newSlug }
  }

  const updated = await db.post.update({
    where: { id },
    data: {
      ...titleUpdate,
      ...(fields.summary !== undefined && { summary: fields.summary }),
      ...(fields.content !== undefined && { content: fields.content }),
      ...(fields.category !== undefined && { category: fields.category }),
      ...(fields.scope !== undefined && { scope: fields.scope }),
      // thumbnailUrl có thể set null (xóa ảnh) hoặc string mới
      ...(fields.thumbnailUrl !== undefined && { thumbnailUrl: fields.thumbnailUrl }),
      ...(fields.metaTitle !== undefined && { metaTitle: fields.metaTitle }),
      ...(fields.metaDescription !== undefined && { metaDescription: fields.metaDescription }),
    },
    select: adminPostDetailSelect,
  })

  return updated
}

/**
 * Đổi trạng thái bài viết theo state machine:
 *   DRAFT → PUBLISHED (PUBLISH)
 *   PUBLISHED → DRAFT (UNPUBLISH)
 *   DRAFT | PUBLISHED → ARCHIVED (ARCHIVE)
 *
 * Phân quyền:
 *   - DEPARTMENT_MANAGER: chỉ thay đổi bài INTERNAL của ban mình.
 *   - BOARD: mọi thao tác trên mọi bài.
 *
 * Consent (khi PUBLISH, mentionedUserIds có giá trị):
 *   Mỗi userId được nhắc đến phải có consent PUBLIC_NAME đang hiệu lực.
 *   Nếu thiếu: ném lỗi 400 kèm mảng missingConsentUserIds.
 */
export async function changePostStatus(
  request: FastifyRequest,
  user: AuthUser,
  id: string,
  rawBody: unknown,
) {
  const body = changeStatusBody.parse(rawBody)

  const post = await db.post.findUnique({
    where: { id },
    select: { departmentId: true, status: true, scope: true },
  })
  if (!post) throw notFound('Không tìm thấy bài viết.')

  // Phạm vi ban: 404 nếu ngoài phạm vi
  assertInScope(user, post.departmentId)

  // ── Kiểm tra quyền thay đổi trạng thái theo vai trò ──────────────────────
  const isBoard = hasRole(user, 'BOARD')

  if (!isBoard) {
    // DEPARTMENT_MANAGER chỉ được thao tác bài INTERNAL của ban mình
    if (post.scope !== 'INTERNAL') {
      throw forbidden('Quản lý ban chỉ được thay đổi trạng thái bài viết Nội bộ.')
    }
  }

  // ── Kiểm tra state machine ────────────────────────────────────────────────
  // Bước chuyển hợp lệ: action → [trạng thái hiện tại hợp lệ]
  const validTransitions: Record<string, ContentStatus[]> = {
    PUBLISH: ['DRAFT'],
    UNPUBLISH: ['PUBLISHED'],
    ARCHIVE: ['DRAFT', 'PUBLISHED'],
  }

  const allowed = validTransitions[body.action]
  if (!allowed?.includes(post.status as ContentStatus)) {
    throw conflict(
      `Không thể thực hiện "${body.action}" trên bài ở trạng thái "${post.status}".`,
    )
  }

  // ── Kiểm tra consent trước khi PUBLISH (CMS-12) ───────────────────────────
  if (body.action === 'PUBLISH' && body.mentionedUserIds && body.mentionedUserIds.length > 0) {
    const missingConsentUserIds: string[] = []
    for (const userId of body.mentionedUserIds) {
      const consented = await hasActiveConsent({
        subjectType: 'USER',
        subjectId: userId,
        purpose: 'PUBLIC_NAME',
      })
      if (!consented) missingConsentUserIds.push(userId)
    }
    if (missingConsentUserIds.length > 0) {
      // Ném lỗi có statusCode 400 để handler xử lý và trả kèm mảng ids
      throw Object.assign(new Error('Một số thành viên chưa đồng ý công bố tên.'), {
        statusCode: 400,
        code: 'missing_consent',
        missingConsentUserIds,
      })
    }
  }

  // ── Tính toán dữ liệu cập nhật theo action ───────────────────────────────
  type PostUpdateData = {
    status: ContentStatus
    publishedAt?: Date | null
    publishedById?: string | null
  }

  const updateData: PostUpdateData = { status: 'DRAFT' }

  if (body.action === 'PUBLISH') {
    updateData.status = 'PUBLISHED'
    updateData.publishedAt = new Date()
    updateData.publishedById = user.id
  } else if (body.action === 'UNPUBLISH') {
    updateData.status = 'DRAFT'
    // Giữ nguyên publishedAt và publishedById khi hủy công bố (audit trail)
  } else {
    // ARCHIVE
    updateData.status = 'ARCHIVED'
  }

  // Xác định audit action
  const auditAction =
    body.action === 'PUBLISH'
      ? AUDIT_ACTIONS.POST_PUBLISH
      : body.action === 'UNPUBLISH'
        ? AUDIT_ACTIONS.POST_UNPUBLISH
        : AUDIT_ACTIONS.POST_ARCHIVE

  // ── Thực hiện update và ghi audit trong cùng một transaction ──────────────
  await db.$transaction(async (tx) => {
    await tx.post.update({ where: { id }, data: updateData })
    await audit(
      request,
      {
        action: auditAction,
        targetType: 'POST',
        targetId: id,
        category: AuditCategory.BUSINESS,
        result: AuditResult.SUCCESS,
        metadata: {
          newStatus: updateData.status,
          scope: post.scope,
          mentionedUserIds: body.mentionedUserIds ?? [],
        },
      },
      tx,
    )
  })

  return { id, status: updateData.status }
}

import { z } from 'zod'

import { db } from '../../db/client.js'
import type { Prisma } from '../../db/generated/client.js'
import { notFound } from '../../lib/errors.js'
import { pageArgs, pageQuery } from '../../lib/pagination.js'
import { hasRole, type AuthUser } from '../auth/rbac.js'

// ─── SCHEMA VALIDATION ───────────────────────────────────────────────────────

/** Query params cho danh sách thông báo nội bộ (C5). */
export const announcementListQuery = pageQuery

const announcementParams = z.object({ id: z.string().min(1).max(64) })

// ─── HELPERS ─────────────────────────────────────────────────────────────────

/**
 * Bộ lọc thông báo theo đối tượng nhận (C5), dùng chung cho list và detail:
 * chỉ bài PUBLISHED + INTERNAL, và user phải thuộc đối tượng nhận.
 *
 * CẢNH BÁO: KHÔNG viết `user.departmentId ?? undefined` ở nhánh DEPARTMENT —
 * Prisma coi `undefined` là "bỏ qua field", user không thuộc ban nào sẽ match mọi thông báo theo ban.
 */
function buildAudienceWhere(user: AuthUser): Prisma.PostWhereInput {
  // TECH_ADMIN không được biết dữ liệu nghiệp vụ tồn tại (docs/02 §8.5) — 404 như tài liệu nội bộ.
  if (hasRole(user, 'TECH_ADMIN')) throw notFound()

  const roleNames = user.roles.map((grant) => grant.role)
  // MEMBER là vai trò ảo của mọi tài khoản (RP-01), thêm vào để khớp audienceRoles chứa MEMBER.
  const allRoles = Array.from(new Set([...roleNames, 'MEMBER' as const]))

  const orConditions: Prisma.PostWhereInput[] = [
    { audience: 'ALL' },
    { audience: 'ROLES', audienceRoles: { hasSome: allRoles } },
  ]
  // Chỉ thêm nhánh DEPARTMENT khi user có ban; bỏ qua khi null để tránh match toàn bộ.
  if (user.departmentId) {
    orConditions.push({ audience: 'DEPARTMENT', audienceDepartmentId: user.departmentId })
  }

  return {
    status: 'PUBLISHED',
    scope: 'INTERNAL',
    OR: orConditions,
  }
}

// ─── SELECT SETS ─────────────────────────────────────────────────────────────

/** Trường trả về danh sách thông báo — KHÔNG trả audience, author, ban, người công bố. */
const announcementListSelect = {
  id: true,
  title: true,
  summary: true,
  category: true,
  thumbnailUrl: true,
  publishedAt: true,
  createdAt: true,
} as const

/** Trang chi tiết thêm nội dung. */
const announcementDetailSelect = {
  ...announcementListSelect,
  content: true,
} as const

// ─── SERVICE FUNCTIONS ────────────────────────────────────────────────────────

/** Danh sách thông báo nội bộ thành viên được xem, mới công bố trước. */
export async function listAnnouncements(user: AuthUser, rawQuery: unknown) {
  const query = announcementListQuery.parse(rawQuery)
  const where = buildAudienceWhere(user)

  const [items, total] = await db.$transaction([
    db.post.findMany({
      where,
      orderBy: { publishedAt: 'desc' },
      select: announcementListSelect,
      ...pageArgs(query),
    }),
    db.post.count({ where }),
  ])

  return { items, total, page: query.page, pageSize: query.pageSize }
}

/** Chi tiết thông báo theo id; 404 khi không tồn tại, chưa công bố, không phải INTERNAL hoặc ngoài đối tượng nhận. */
export async function getAnnouncementById(user: AuthUser, rawParams: unknown) {
  const { id } = announcementParams.parse(rawParams)
  const post = await db.post.findFirst({
    where: { id, ...buildAudienceWhere(user) },
    select: announcementDetailSelect,
  })
  if (!post) throw notFound('Không tìm thấy thông báo.')
  return post
}

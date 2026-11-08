import type { FastifyRequest } from 'fastify'
import { z } from 'zod'

import { db } from '../../db/client.js'
import { conflict, notFound } from '../../lib/errors.js'
import { slugify } from '../../lib/ids.js'
import { AUDIT_ACTIONS, AuditCategory, AuditResult, audit } from '../audit/service.js'

const httpUrl = z.string().regex(/^https?:\/\//i, 'Liên kết phải bắt đầu bằng http:// hoặc https://')

export const organizationProfileSchema = z.object({
  name: z.string().min(1, 'Tên không được để trống'),
  description: z.string().min(1, 'Mô tả không được để trống'),
  mission: z.string().min(1, 'Sứ mệnh không được để trống'),
  contactEmail: z.string().email('Email không đúng định dạng'),
  fanpage: httpUrl,
  officialLinks: z
    .array(
      z.object({
        label: z.string().min(1, 'Tên liên kết không được để trống'),
        url: httpUrl,
      }),
    )
    .default([]),
  termEndsAt: z.string().datetime().nullable().optional(),
})

export const createDepartmentSchema = z.object({
  name: z.string().min(1, 'Tên ban không được để trống'),
  code: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  contactPoint: z.string().optional().nullable(),
})

export const updateDepartmentSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  contactPoint: z.string().optional().nullable(),
  status: z.enum(['ACTIVE', 'ARCHIVED']).optional(),
  order: z.number().int().optional(),
})

export const reorderDepartmentsSchema = z.object({
  departmentIds: z.array(z.string()),
})

export const featuredContentSchema = z.object({
  postIds: z.array(z.string()).default([]),
  eventIds: z.array(z.string()).default([]),
  projectIds: z.array(z.string()).default([]),
})

type FeaturedStored = {
  postIds?: string[]
  eventIds?: string[]
  projectIds?: string[]
}

const newsSelect = {
  id: true,
  title: true,
  slug: true,
  summary: true,
  thumbnailUrl: true,
  category: true,
  publishedAt: true,
}

const eventSelect = {
  id: true,
  title: true,
  slug: true,
  description: true,
  coverImageUrl: true,
  eventType: true,
  status: true,
  audience: true,
  contactPoint: true,
  startAt: true,
  endAt: true,
  location: true,
  onlineUrl: true,
}

const projectSelect = {
  id: true,
  title: true,
  slug: true,
  description: true,
  thumbnailUrl: true,
  technologies: true,
  projectUrl: true,
  sourceUrl: true,
  publishedAt: true,
}

/**
 * GET /public/home
 * Trả về 3 khối: news, events, projects.
 * BR-11: Đọc mỗi lần tải và bỏ qua mục đã bị gỡ hoặc lưu trữ.
 * QĐ-4:
 * - Khối đã chọn mục nổi bật: trả các mục nổi bật đang công khai.
 * - Khối chưa chọn hoặc mọi mục đã chọn không còn công khai: fallback về mục mới nhất đang công khai:
 *   + news, projects: 3 mục mới nhất.
 *   + events: 3 sự kiện sắp diễn ra gần nhất (status = PUBLISHED, endAt >= now).
 * - Không có mục nào: trả rỗng [] để trang chủ ẩn khối (FLOW-01).
 */
export async function getPublicHome() {
  const setting = await db.siteSetting.findUnique({ where: { id: 'singleton' } })
  const info = (setting?.info as Record<string, unknown> | null) ?? {}
  const featured = ((info.featured as FeaturedStored) ?? {}) as FeaturedStored

  // 1. News
  let news: Array<any> = []
  if (featured.postIds && featured.postIds.length > 0) {
    const validPosts = await db.post.findMany({
      where: {
        id: { in: featured.postIds },
        status: 'PUBLISHED',
        scope: 'PUBLIC',
      },
      select: newsSelect,
    })
    // Giữ đúng thứ tự admin đã chọn
    const postMap = new Map(validPosts.map((p) => [p.id, p]))
    news = featured.postIds.map((id) => postMap.get(id)).filter((p): p is typeof validPosts[0] => !!p).slice(0, 3)
  }

  // Fallback nếu chưa chọn hoặc các mục đã chọn đều bị gỡ/lưu trữ (QĐ-4)
  if (news.length === 0) {
    news = await db.post.findMany({
      where: { status: 'PUBLISHED', scope: 'PUBLIC' },
      orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
      take: 3,
      select: newsSelect,
    })
  }

  // 2. Events
  let events: Array<any> = []
  if (featured.eventIds && featured.eventIds.length > 0) {
    const validEvents = await db.event.findMany({
      where: {
        id: { in: featured.eventIds },
        audience: 'PUBLIC',
        status: { in: ['PUBLISHED', 'ENDED'] },
      },
      select: eventSelect,
    })
    const eventMap = new Map(validEvents.map((e) => [e.id, e]))
    events = featured.eventIds.map((id) => eventMap.get(id)).filter((e): e is typeof validEvents[0] => !!e).slice(0, 3)
  }

  // Fallback nếu chưa chọn hoặc các mục đã chọn không còn công khai (QĐ-4)
  if (events.length === 0) {
    events = await db.event.findMany({
      where: {
        audience: 'PUBLIC',
        status: 'PUBLISHED',
        endAt: { gte: new Date() },
      },
      orderBy: [{ startAt: 'asc' }, { id: 'asc' }],
      take: 3,
      select: eventSelect,
    })
  }

  // 3. Projects
  let projects: Array<any> = []
  if (featured.projectIds && featured.projectIds.length > 0) {
    const validProjects = await db.project.findMany({
      where: {
        id: { in: featured.projectIds },
        status: 'PUBLISHED',
      },
      select: projectSelect,
    })
    const projectMap = new Map(validProjects.map((p) => [p.id, p]))
    const featuredProjects = featured.projectIds
      .map((id) => projectMap.get(id))
      .filter((p): p is typeof validProjects[0] => !!p)
      .slice(0, 3)

    if (featuredProjects.length > 0) {
      // Bổ sung các dự án mới nhất khác để khối projects có thêm danh sách 'others' (tổng tối đa 8)
      const featuredIdSet = new Set(featuredProjects.map((p) => p.id))
      const additionalProjects = await db.project.findMany({
        where: {
          status: 'PUBLISHED',
          id: { notIn: Array.from(featuredIdSet) },
        },
        orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
        take: 5,
        select: projectSelect,
      })
      projects = [...featuredProjects, ...additionalProjects]
    }
  }

  // Fallback nếu chưa chọn hoặc các mục đã chọn đều bị gỡ/lưu trữ (QĐ-4)
  if (projects.length === 0) {
    projects = await db.project.findMany({
      where: { status: 'PUBLISHED' },
      orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
      take: 8,
      select: projectSelect,
    })
  }

  return { news, events, projects }
}

/**
 * GET /admin/organization/profile (chỉ BOARD)
 */
export async function getAdminProfile() {
  const setting = await db.siteSetting.findUnique({ where: { id: 'singleton' } })
  if (!setting) throw notFound('Chưa có thông tin tổ chức.')

  const info = (setting.info as Record<string, unknown> | null) ?? {}
  return {
    name: (info.name as string) ?? '',
    description: (info.description as string) ?? '',
    mission: (info.mission as string) ?? '',
    contactEmail: (info.contactEmail as string) ?? '',
    fanpage: (info.fanpage as string) ?? '',
    officialLinks: (info.officialLinks as Array<{ label: string; url: string }>) ?? [],
    termEndsAt: setting.termEndsAt ? setting.termEndsAt.toISOString() : null,
  }
}

/**
 * PUT /admin/organization/profile (chỉ BOARD)
 * Lưu thông tin APC và ngày kết thúc nhiệm kỳ trong một transaction (FLOW-24, ORG-01, ORG-05).
 */
export async function updateAdminProfile(request: FastifyRequest, rawBody: unknown) {
  const body = organizationProfileSchema.parse(rawBody)

  return await db.$transaction(async (tx) => {
    const current = await tx.siteSetting.findUnique({ where: { id: 'singleton' } })
    const currentInfo = (current?.info as Record<string, unknown> | null) ?? {}

    const updatedInfo = {
      ...currentInfo,
      name: body.name,
      description: body.description,
      mission: body.mission,
      contactEmail: body.contactEmail,
      fanpage: body.fanpage,
      officialLinks: body.officialLinks,
    }

    const termEndsAt =
      body.termEndsAt !== undefined
        ? body.termEndsAt
          ? new Date(body.termEndsAt)
          : null
        : (current?.termEndsAt ?? null)

    const updated = await tx.siteSetting.upsert({
      where: { id: 'singleton' },
      update: { info: updatedInfo, termEndsAt },
      create: { id: 'singleton', info: updatedInfo, termEndsAt },
    })

    await audit(
      request,
      {
        action: AUDIT_ACTIONS.ORG_UPDATE_INFO,
        targetType: 'SITE_SETTING',
        targetId: 'singleton',
        category: AuditCategory.BUSINESS,
        result: AuditResult.SUCCESS,
        metadata: {
          name: body.name,
          contactEmail: body.contactEmail,
          termEndsAt: termEndsAt?.toISOString() ?? null,
        },
      },
      tx,
    )

    return {
      name: body.name,
      description: body.description,
      mission: body.mission,
      contactEmail: body.contactEmail,
      fanpage: body.fanpage,
      officialLinks: body.officialLinks,
      termEndsAt: updated.termEndsAt ? updated.termEndsAt.toISOString() : null,
    }
  })
}

/**
 * GET /admin/organization/departments (chỉ BOARD)
 */
export async function listAdminDepartments() {
  const departments = await db.department.findMany({
    orderBy: [{ order: 'asc' }, { name: 'asc' }],
    include: {
      _count: {
        select: {
          users: { where: { memberStatus: 'ACTIVE' } },
        },
      },
    },
  })

  return departments.map((d) => ({
    id: d.id,
    name: d.name,
    code: d.code,
    description: d.description ?? '',
    contactPoint: d.contactPoint ?? '',
    status: d.status,
    order: d.order,
    activeMemberCount: d._count.users,
    createdAt: d.createdAt.toISOString(),
    updatedAt: d.updatedAt.toISOString(),
  }))
}

/**
 * POST /admin/organization/departments (chỉ BOARD)
 */
export async function createAdminDepartment(request: FastifyRequest, rawBody: unknown) {
  const body = createDepartmentSchema.parse(rawBody)

  // Kiểm tra tên ban không trùng với ban ACTIVE khác (ORG-02, FLOW-24)
  const existingActive = await db.department.findFirst({
    where: { name: body.name, status: 'ACTIVE' },
  })
  if (existingActive) {
    throw conflict('Tên ban đã tồn tại trong các ban đang hoạt động.')
  }

  // Sinh mã code duy nhất nếu chưa có
  let code = body.code ? slugify(body.code) : slugify(body.name)
  if (!code) code = 'ban'
  const codeConflict = await db.department.findUnique({ where: { code } })
  if (codeConflict) {
    code = `${code}-${Date.now().toString(36)}`
  }

  // Thứ tự mặc định là sau ban cuối cùng
  const lastDept = await db.department.findFirst({
    orderBy: { order: 'desc' },
    select: { order: true },
  })
  const order = (lastDept?.order ?? -1) + 1

  const department = await db.department.create({
    data: {
      name: body.name,
      code,
      description: body.description ?? null,
      contactPoint: body.contactPoint ?? null,
      status: 'ACTIVE',
      order,
    },
  })

  await audit(request, {
    action: AUDIT_ACTIONS.ORG_UPDATE_DEPARTMENTS,
    targetType: 'DEPARTMENT',
    targetId: department.id,
    category: AuditCategory.BUSINESS,
    result: AuditResult.SUCCESS,
    metadata: {
      action: 'create',
      name: department.name,
      code: department.code,
    },
  })

  return {
    id: department.id,
    name: department.name,
    code: department.code,
    description: department.description ?? '',
    contactPoint: department.contactPoint ?? '',
    status: department.status,
    order: department.order,
  }
}

/**
 * GET /admin/organization/departments/:id (chỉ BOARD)
 */
export async function getAdminDepartment(id: string) {
  const department = await db.department.findUnique({
    where: { id },
    include: {
      users: {
        where: { memberStatus: 'ACTIVE' },
        select: {
          id: true,
          fullName: true,
          studentId: true,
          email: true,
        },
      },
    },
  })
  if (!department) throw notFound('Không tìm thấy ban.')

  return {
    id: department.id,
    name: department.name,
    code: department.code,
    description: department.description ?? '',
    contactPoint: department.contactPoint ?? '',
    status: department.status,
    order: department.order,
    activeMembers: department.users,
  }
}

/**
 * PATCH /admin/organization/departments/:id (chỉ BOARD)
 * Lưu trữ ban còn thành viên active trả 409 kèm danh sách thành viên cần chuyển (FLOW-24, ORG-03).
 */
export async function updateAdminDepartment(request: FastifyRequest, id: string, rawBody: unknown) {
  const body = updateDepartmentSchema.parse(rawBody)

  const current = await db.department.findUnique({ where: { id } })
  if (!current) throw notFound('Không tìm thấy ban.')

  // Nếu đổi tên, kiểm tra trùng tên với ban ACTIVE khác
  if (body.name && body.name !== current.name) {
    const existingActive = await db.department.findFirst({
      where: {
        id: { not: id },
        name: body.name,
        status: 'ACTIVE',
      },
    })
    if (existingActive) {
      throw conflict('Tên ban đã tồn tại trong các ban đang hoạt động.')
    }
  }

  // Nếu chuyển trạng thái sang ARCHIVED: kiểm tra thành viên memberStatus = ACTIVE (FLOW-24, ORG-03)
  if (body.status === 'ARCHIVED' && current.status === 'ACTIVE') {
    const activeMembers = await db.user.findMany({
      where: {
        departmentId: id,
        memberStatus: 'ACTIVE',
      },
      select: {
        id: true,
        fullName: true,
        studentId: true,
        email: true,
      },
    })

    if (activeMembers.length > 0) {
      throw conflict('Không thể lưu trữ ban còn thành viên đang hoạt động.', {
        members: activeMembers,
      })
    }
  }

  const updated = await db.department.update({
    where: { id },
    data: {
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.description !== undefined ? { description: body.description } : {}),
      ...(body.contactPoint !== undefined ? { contactPoint: body.contactPoint } : {}),
      ...(body.status !== undefined ? { status: body.status } : {}),
      ...(body.order !== undefined ? { order: body.order } : {}),
    },
  })

  await audit(request, {
    action: AUDIT_ACTIONS.ORG_UPDATE_DEPARTMENTS,
    targetType: 'DEPARTMENT',
    targetId: id,
    category: AuditCategory.BUSINESS,
    result: AuditResult.SUCCESS,
    metadata: {
      action: 'update',
      changes: body,
    },
  })

  return {
    id: updated.id,
    name: updated.name,
    code: updated.code,
    description: updated.description ?? '',
    contactPoint: updated.contactPoint ?? '',
    status: updated.status,
    order: updated.order,
  }
}

/**
 * PUT /admin/organization/departments/order (chỉ BOARD)
 */
export async function reorderAdminDepartments(request: FastifyRequest, rawBody: unknown) {
  const body = reorderDepartmentsSchema.parse(rawBody)

  await db.$transaction(async (tx) => {
    for (let i = 0; i < body.departmentIds.length; i++) {
      const deptId = body.departmentIds[i]
      if (!deptId) continue
      await tx.department.update({
        where: { id: deptId },
        data: { order: i },
      })
    }

    await audit(
      request,
      {
        action: AUDIT_ACTIONS.ORG_UPDATE_DEPARTMENTS,
        targetType: 'DEPARTMENT',
        targetId: 'multiple',
        category: AuditCategory.BUSINESS,
        result: AuditResult.SUCCESS,
        metadata: {
          action: 'reorder',
          order: body.departmentIds,
        },
      },
      tx,
    )
  })

  return { success: true }
}

/**
 * GET /admin/organization/featured-content (chỉ BOARD)
 */
export async function getAdminFeaturedContent() {
  const [setting, publicPosts, publicEvents, publicProjects] = await Promise.all([
    db.siteSetting.findUnique({ where: { id: 'singleton' } }),
    db.post.findMany({
      where: { status: 'PUBLISHED', scope: 'PUBLIC' },
      orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
      take: 20,
      select: {
        id: true,
        title: true,
        slug: true,
        category: true,
        publishedAt: true,
      },
    }),
    db.event.findMany({
      where: { audience: 'PUBLIC', status: { in: ['PUBLISHED', 'ENDED'] } },
      orderBy: [{ startAt: 'desc' }, { id: 'desc' }],
      take: 20,
      select: {
        id: true,
        title: true,
        slug: true,
        eventType: true,
        status: true,
        startAt: true,
        endAt: true,
      },
    }),
    db.project.findMany({
      where: { status: 'PUBLISHED' },
      orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
      take: 20,
      select: {
        id: true,
        title: true,
        slug: true,
        publishedAt: true,
      },
    }),
  ])

  const info = (setting?.info as Record<string, unknown> | null) ?? {}
  const featured = ((info.featured as FeaturedStored) ?? {}) as FeaturedStored

  return {
    selected: {
      postIds: featured.postIds ?? [],
      eventIds: featured.eventIds ?? [],
      projectIds: featured.projectIds ?? [],
    },
    candidates: {
      posts: publicPosts.map((p) => ({
        id: p.id,
        title: p.title,
        slug: p.slug,
        category: p.category,
        publishedAt: p.publishedAt ? p.publishedAt.toISOString() : null,
      })),
      events: publicEvents.map((e) => ({
        id: e.id,
        title: e.title,
        slug: e.slug,
        eventType: e.eventType,
        status: e.status,
        startAt: e.startAt.toISOString(),
        endAt: e.endAt.toISOString(),
      })),
      projects: publicProjects.map((pr) => ({
        id: pr.id,
        title: pr.title,
        slug: pr.slug,
        publishedAt: pr.publishedAt ? pr.publishedAt.toISOString() : null,
      })),
    },
  }
}

/**
 * PUT /admin/organization/featured-content (chỉ BOARD)
 * Nội dung nổi bật chỉ chọn được mục đang công khai (FLOW-24, ORG-04, ORG-05).
 */
export async function updateAdminFeaturedContent(request: FastifyRequest, rawBody: unknown) {
  const body = featuredContentSchema.parse(rawBody)

  // Kiểm tra tính hợp lệ: các mục được chọn phải đang công khai
  if (body.postIds.length > 0) {
    const validCount = await db.post.count({
      where: {
        id: { in: body.postIds },
        status: 'PUBLISHED',
        scope: 'PUBLIC',
      },
    })
    if (validCount !== body.postIds.length) {
      throw conflict('Chỉ có thể chọn bài viết đang công khai.')
    }
  }

  if (body.eventIds.length > 0) {
    const validCount = await db.event.count({
      where: {
        id: { in: body.eventIds },
        audience: 'PUBLIC',
        status: { in: ['PUBLISHED', 'ENDED'] },
      },
    })
    if (validCount !== body.eventIds.length) {
      throw conflict('Chỉ có thể chọn sự kiện đang công khai.')
    }
  }

  if (body.projectIds.length > 0) {
    const validCount = await db.project.count({
      where: {
        id: { in: body.projectIds },
        status: 'PUBLISHED',
      },
    })
    if (validCount !== body.projectIds.length) {
      throw conflict('Chỉ có thể chọn dự án đang công bố.')
    }
  }

  return await db.$transaction(async (tx) => {
    const current = await tx.siteSetting.findUnique({ where: { id: 'singleton' } })
    const currentInfo = (current?.info as Record<string, unknown> | null) ?? {}

    const updatedInfo = {
      ...currentInfo,
      featured: {
        postIds: body.postIds,
        eventIds: body.eventIds,
        projectIds: body.projectIds,
      },
    }

    await tx.siteSetting.upsert({
      where: { id: 'singleton' },
      update: { info: updatedInfo },
      create: { id: 'singleton', info: updatedInfo },
    })

    await audit(
      request,
      {
        action: AUDIT_ACTIONS.ORG_UPDATE_FEATURED,
        targetType: 'SITE_SETTING',
        targetId: 'singleton',
        category: AuditCategory.BUSINESS,
        result: AuditResult.SUCCESS,
        metadata: {
          postIds: body.postIds,
          eventIds: body.eventIds,
          projectIds: body.projectIds,
        },
      },
      tx,
    )

    return {
      postIds: body.postIds,
      eventIds: body.eventIds,
      projectIds: body.projectIds,
    }
  })
}

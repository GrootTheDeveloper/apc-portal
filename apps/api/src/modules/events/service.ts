import type { FastifyBaseLogger } from 'fastify'
import type { Prisma } from '../../db/generated/client.js'
import { z } from 'zod'

import { db } from '../../db/client.js'
import { notFound } from '../../lib/errors.js'
import { pageArgs, pageQuery, toPage } from '../../lib/pagination.js'
import { AUDIT_ACTIONS, audit, AuditCategory, AuditResult } from '../audit/service.js'

// ─── SCHEMA VALIDATION ───────────────────────────────────────────────────────

/** Query params cho danh sách sự kiện công khai (E2). */
export const eventListQuery = pageQuery.extend({
  // Lọc theo loại sự kiện (tùy chọn), vd. Workshop
  type: z.string().trim().min(1).max(50).optional(),
  // Chế độ lịch tháng: "2026-10"; lọc theo ngày Việt Nam (BR-14)
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'month phải có dạng YYYY-MM.').optional(),
  // ?upcoming=1: chỉ sự kiện còn sắp diễn ra — khối trang chủ (FLOW-01); T4 sẽ thay bằng GET /public/home
  upcoming: z
    .string()
    .optional()
    .transform((value) => value === '1' || value === 'true'),
})

// ─── TRUY VẤN CHUNG ──────────────────────────────────────────────────────────

/** Sự kiện công khai: đã công bố, đã hủy hoặc đã kết thúc. Nháp, lưu trữ, nội bộ coi như không tồn tại (docs/02 §12). */
const publicVisible: Prisma.EventWhereInput = {
  audience: 'PUBLIC',
  status: { in: ['PUBLISHED', 'CANCELLED', 'ENDED'] },
}

/** Chỉ select các trường cần hiển thị — KHÔNG lấy createdById, departmentId, audience và các trường điểm danh. */
const eventListSelect = {
  slug: true,
  title: true,
  coverImageUrl: true,
  eventType: true,
  status: true,
  startAt: true,
  endAt: true,
  location: true,
  onlineUrl: true,
} as const

/** Trang chi tiết thêm mô tả, ban tổ chức, thời gian đăng ký, sức chứa, lý do hủy. */
const eventDetailSelect: Prisma.EventSelect = {
  ...eventListSelect,
  id: true,
  description: true,
  department: { select: { name: true } },
  contactPoint: true,
  registrationOpensAt: true,
  registrationClosesAt: true,
  capacity: true,
  cancelReason: true,
} as const

// Việt Nam không có giờ mùa hè: lịch VN = UTC + 7h cố định (BR-14).
const VN_UTC_OFFSET_MS = 7 * 60 * 60 * 1000

/** Cửa sổ [bắt đầu, kết thúc) của tháng "YYYY-MM" theo ngày Việt Nam, quy về UTC để so với cột startAt. */
function monthWindowUtc(month: string) {
  const [year, monthNumber] = month.split('-').map(Number) as [number, number]
  return {
    start: new Date(Date.UTC(year, monthNumber - 1, 1) - VN_UTC_OFFSET_MS),
    end: new Date(Date.UTC(year, monthNumber, 1) - VN_UTC_OFFSET_MS),
  }
}

const typeFilter = (type?: string) => (type ? { eventType: type } : {})

// ─── DANH SÁCH ───────────────────────────────────────────────────────────────

/** Danh sách sự kiện công khai, phân trang. Chế độ ?month= (lịch), ?upcoming=1 (trang chủ) hoặc mặc định xếp upcoming trước. */
export async function listPublicEvents(rawQuery: unknown) {
  const query = eventListQuery.parse(rawQuery)

  // Lịch tháng: mọi sự kiện bắt đầu trong tháng (theo ngày Việt Nam), xếp theo giờ bắt đầu.
  if (query.month) {
    const window = monthWindowUtc(query.month)
    const where: Prisma.EventWhereInput = {
      ...publicVisible,
      startAt: { gte: window.start, lt: window.end },
      ...typeFilter(query.type),
    }
    const [items, total] = await db.$transaction([
      db.event.findMany({ where, orderBy: [{ startAt: 'asc' }, { id: 'asc' }], select: eventListSelect, ...pageArgs(query) }),
      db.event.count({ where }),
    ])
    return toPage(items, total, query)
  }

  // Khối trang chủ: chỉ sự kiện còn sắp diễn ra (FLOW-01), gần nhất trước.
  if (query.upcoming) {
    const where: Prisma.EventWhereInput = {
      ...publicVisible,
      status: 'PUBLISHED',
      endAt: { gte: new Date() },
      ...typeFilter(query.type),
    }
    const [items, total] = await db.$transaction([
      db.event.findMany({ where, orderBy: [{ startAt: 'asc' }, { id: 'asc' }], select: eventListSelect, ...pageArgs(query) }),
      db.event.count({ where }),
    ])
    return toPage(items, total, query)
  }

  // Mặc định như trang đã hứa ở E1: sắp diễn ra (gần nhất trước) → đã hủy → đã kết thúc (mới nhất trước).
  // PUBLISHED đã qua endAt chưa kịp chuyển ENDED bởi tác vụ event-end cũng tính như đã kết thúc.
  const now = new Date()
  const groups: { where: Prisma.EventWhereInput; direction: 'asc' | 'desc' }[] = [
    {
      where: { ...publicVisible, status: 'PUBLISHED', endAt: { gte: now }, ...typeFilter(query.type) },
      direction: 'asc',
    },
    {
      where: { ...publicVisible, status: 'CANCELLED', ...typeFilter(query.type) },
      direction: 'desc',
    },
    {
      where: {
        ...publicVisible,
        OR: [{ status: 'ENDED' }, { status: 'PUBLISHED', endAt: { lt: now } }],
        ...typeFilter(query.type),
      },
      direction: 'desc',
    },
  ]

  const counts = await Promise.all(groups.map((group) => db.event.count({ where: group.where })))
  const total = counts.reduce((sum, count) => sum + count, 0)
  const { skip, take } = pageArgs(query)

  // Mỗi nhóm chiếm một đoạn liên tiếp trên trang; chỉ truy vấn nhóm giao với trang hiện tại.
  const chunks = await Promise.all(
    groups.map((group, index) => {
      const groupStart = counts.slice(0, index).reduce((sum, count) => sum + count, 0)
      const groupCount = counts[index] ?? 0
      const overlapStart = Math.max(skip - groupStart, 0)
      const overlapEnd = Math.min(skip + take - groupStart, groupCount)
      if (overlapEnd <= overlapStart) return Promise.resolve([])
      return db.event.findMany({
        where: group.where,
        orderBy: [{ startAt: group.direction }, { id: group.direction }],
        skip: overlapStart,
        take: overlapEnd - overlapStart,
        select: eventListSelect,
      })
    }),
  )

  return toPage(chunks.flat(), total, query)
}

// ─── CHI TIẾT ────────────────────────────────────────────────────────────────

/** Chi tiết sự kiện công khai theo slug; không có, nháp, lưu trữ hay nội bộ thì 404 (docs/02 §12). */
export async function getPublicEventBySlug(slug: string) {
  const event = await db.event.findFirst({ where: { slug, ...publicVisible }, select: eventDetailSelect })
  if (!event) throw notFound('Không tìm thấy sự kiện hoặc sự kiện không còn công khai.')
  const { department, ...rest } = event
  return { ...rest, departmentName: department?.name ?? null }
}

// ─── TÁC VỤ NỀN ──────────────────────────────────────────────────────────────

/**
 * Tác vụ 'event-end' (E2): chuyển sự kiện PUBLISHED đã qua endAt sang ENDED (docs/01 §9.2)
 * để về sau lưu trữ được. Chạy qua startJob trong server.ts; test gọi thẳng hàm này.
 * Ghi một dòng audit gộp theo lượt chạy bằng định danh dịch vụ, không dùng tài khoản cá nhân.
 */
export async function endPastEvents(log: FastifyBaseLogger) {
  const result = await db.event.updateMany({
    where: { status: 'PUBLISHED', endAt: { lt: new Date() } },
    data: { status: 'ENDED' },
  })

  if (result.count > 0) {
    await audit(
      { service: 'event-end' },
      {
        action: AUDIT_ACTIONS.EVENT_END,
        targetType: 'EVENT',
        category: AuditCategory.BUSINESS,
        result: AuditResult.SUCCESS,
        metadata: { count: result.count },
      },
    )
    log.info({ count: result.count }, 'Đã chuyển sự kiện quá endAt sang ENDED')
  }

  return { ended: result.count }
}

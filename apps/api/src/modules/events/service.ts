import type { FastifyBaseLogger } from 'fastify'
import type { EventStatus, Prisma } from '../../db/generated/client.js'
import { z } from 'zod'

import { db } from '../../db/client.js'
import { conflict, notFound } from '../../lib/errors.js'
import { publicCode } from '../../lib/ids.js'
import { pageArgs, pageQuery, toPage } from '../../lib/pagination.js'
import { AUDIT_ACTIONS, audit, AuditCategory, AuditResult } from '../audit/service.js'
import { recordConsent } from '../consent/service.js'
import { enqueueEmail } from '../email/service.js'

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

/** Trang chi tiết thêm mô tả, ban tổ chức, thời gian đăng ký, sức chứa, cho phép khách đăng ký, lý do hủy. */
const eventDetailSelect: Prisma.EventSelect = {
  ...eventListSelect,
  id: true,
  description: true,
  department: { select: { name: true } },
  contactPoint: true,
  registrationOpensAt: true,
  registrationClosesAt: true,
  capacity: true,
  allowGuestRegistration: true,
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

// ─── ĐĂNG KÝ CỦA KHÁCH (E3) ─────────────────────────────────────────────────

/** Câu chung cho mọi trường hợp trùng (QĐ-1): không nêu trường nào trùng, không trả dữ liệu đăng ký đã có (SEC-05, SEC-08). */
export const DUPLICATE_REGISTRATION_MESSAGE =
  'Không thể đăng ký với thông tin này. Nếu đã đăng ký, vui lòng dùng trang tra cứu.'

/** Sai email hay sai mã đều một câu như nhau, không cho biết phần nào sai (Sitemap §5.4). */
const GENERIC_LOOKUP_MESSAGE = 'Không tìm thấy đăng ký phù hợp với thông tin đã nhập.'

export const guestRegistrationInput = z.object({
  fullName: z.string().trim().min(1, 'Vui lòng nhập họ tên.').max(100),
  email: z.email().max(120).transform((value) => value.toLowerCase()),
  studentId: z
    .string()
    .trim()
    .min(4, 'MSSV phải có ít nhất 4 ký tự.')
    .max(20)
    .regex(/^[A-Za-z0-9-]+$/, 'MSSV chỉ gồm chữ cái và chữ số.'),
  // Chưa tick ô đồng ý thì không tạo đăng ký (FLOW-14, DATA-07)
  consent: z.boolean().refine((value) => value === true, 'Bạn cần đồng ý cho CLB APC xử lý dữ liệu cá nhân.'),
})

export const registrationLookupInput = z.object({
  email: z.email().max(120).transform((value) => value.toLowerCase()),
  // Mã sinh bởi publicCode() (bỏ 0/O, 1/I/L); normalize để gõ thường vẫn khớp
  code: z
    .string()
    .trim()
    .min(6)
    .max(20)
    .transform((value) => value.toUpperCase()),
})

/** Khung thời gian đăng ký cần kiểm tra trên sự kiện (BR-08). */
type RegistrationWindow = {
  status: EventStatus
  allowGuestRegistration: boolean
  registrationOpensAt: Date | null
  registrationClosesAt: Date | null
}

// Giờ Việt Nam = UTC + 7h cố định (BR-14); dùng cho thông báo lý do từ chối.
const vnDateTime = (value: Date) =>
  new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(value)

/** Sự kiện có nhận đăng ký của khách không? Không đạt thì 409 kèm lý do rõ ràng (FLOW-14). */
function ensureEventAcceptsGuests(event: RegistrationWindow, now = new Date()) {
  if (event.status === 'CANCELLED') throw conflict('Sự kiện đã bị hủy, không nhận đăng ký.')
  if (event.status !== 'PUBLISHED') throw conflict('Sự kiện đã kết thúc, không nhận đăng ký.')
  if (!event.allowGuestRegistration) throw conflict('Sự kiện này không nhận đăng ký của khách ngoài APC.')
  if (event.registrationOpensAt && now < event.registrationOpensAt) {
    throw conflict(`Sự kiện chưa mở đăng ký. Nhận đăng ký từ ${vnDateTime(event.registrationOpensAt)}.`)
  }
  if (event.registrationClosesAt && now > event.registrationClosesAt) {
    throw conflict(`Đã hết thời hạn đăng ký từ ${vnDateTime(event.registrationClosesAt)}.`)
  }
}

const eventWindowSelect = {
  status: true,
  allowGuestRegistration: true,
  registrationOpensAt: true,
  registrationClosesAt: true,
  capacity: true,
} satisfies Prisma.EventSelect

/**
 * Khách đăng ký sự kiện công khai (FLOW-14 luồng 2, EVT-10 đến EVT-14). Trả `{ registrationCode }` để
 * màn hình hiện mã một lần (STATE-02); mã cũng nằm trong email xác nhận, không ghi vào log hay audit (SEC-09).
 *
 * Một transaction (BR-08): khóa dòng sự kiện (`FOR UPDATE`) để hai người đăng ký cùng lúc được xử lý
 * tuần tự rồi mới đếm chỗ, nhờ đó không vượt sức chứa; xong tạo/kích hoạt đăng ký, lưu đồng ý
 * (`recordConsent`) và xếp email xác nhận (`enqueueEmail`) — SMTP lỗi thì email thử lại sau, đăng ký vẫn giữ (BR-17).
 */
export async function registerGuest(rawInput: unknown, slug: string) {
  const input = guestRegistrationInput.parse(rawInput)

  // Sự kiện phải tồn tại và đang công khai: nháp, lưu trữ hay nội bộ coi như không có (docs/02 §12 → 404).
  const event = await db.event.findFirst({
    where: { slug, ...publicVisible },
    select: { id: true, ...eventWindowSelect },
  })
  if (!event) throw notFound('Không tìm thấy sự kiện hoặc sự kiện không còn công khai.')
  ensureEventAcceptsGuests(event)

  try {
    const registration = await db.$transaction(async (tx) => {
      // Khóa dòng sự kiện: đăng ký/hủy song song xếp hàng ở đây, đếm chỗ sau khi hàng trước xong.
      const locked = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM events WHERE id = ${event.id} FOR UPDATE`
      if (locked.length === 0) throw notFound('Không tìm thấy sự kiện hoặc sự kiện không còn công khai.')

      // Đọc lại sau khi có khóa: ban quản trị có thể vừa hủy/đổi thời gian trong lúc người dùng điền form.
      const fresh = await tx.event.findUnique({ where: { id: event.id }, select: eventWindowSelect })
      if (!fresh) throw notFound('Không tìm thấy sự kiện hoặc sự kiện không còn công khai.')
      ensureEventAcceptsGuests(fresh)

      const registeredCount = await tx.eventRegistration.count({ where: { eventId: event.id, status: 'REGISTERED' } })

      const existing = await tx.eventRegistration.findUnique({
        where: { eventId_guestEmail: { eventId: event.id, guestEmail: input.email } },
      })
      // Đã có lượt REGISTERED: câu chung, không trả mã hay trạng thái của lượt cũ (QĐ-1).
      if (existing && existing.status === 'REGISTERED') throw conflict(DUPLICATE_REGISTRATION_MESSAGE)
      if (fresh.capacity !== null && registeredCount >= fresh.capacity) throw conflict('Sự kiện đã hết chỗ.')

      let current
      if (existing) {
        // Từng hủy rồi đăng ký lại: kích hoạt dòng cũ, giữ nguyên mã đăng ký (docs/plan/E-su-kien.md E2).
        current = await tx.eventRegistration.update({
          where: { id: existing.id },
          data: {
            status: 'REGISTERED',
            cancelledAt: null,
            registeredAt: new Date(),
            guestFullName: input.fullName,
            guestStudentId: input.studentId,
          },
        })
      } else {
        current = await tx.eventRegistration.create({
          data: {
            eventId: event.id,
            guestFullName: input.fullName,
            guestEmail: input.email,
            guestStudentId: input.studentId,
            registrationCode: publicCode(),
          },
        })
      }

      await recordConsent(tx, { subjectType: 'EVENT_REGISTRATION', subjectId: current.id, purpose: 'EVENT_REGISTRATION' })
      await enqueueEmail(tx, {
        type: 'EVENT_REGISTRATION_CONFIRMED',
        to: input.email,
        refType: 'EVENT_REGISTRATION',
        refId: current.id,
      })
      return current
    })

    return { registrationCode: registration.registrationCode }
  } catch (error) {
    // Hai request cùng email gửi song song: ràng buộc duy nhất (sự kiện, email) chặn → cùng câu chung như trùng.
    if ((error as { code?: string }).code === 'P2002') throw conflict(DUPLICATE_REGISTRATION_MESSAGE)
    throw error
  }
}

/** Dạng trả về của tra cứu: chỉ thông tin đăng ký và tóm tắt sự kiện, không có trường nội bộ (BR-09). */
export async function lookupGuestRegistration(rawInput: unknown) {
  const input = registrationLookupInput.parse(rawInput)

  const registration = await db.eventRegistration.findUnique({
    where: { registrationCode: input.code },
    select: {
      guestEmail: true,
      guestFullName: true,
      status: true,
      registeredAt: true,
      cancelledAt: true,
      event: {
        select: {
          slug: true,
          title: true,
          eventType: true,
          status: true,
          startAt: true,
          endAt: true,
          location: true,
          onlineUrl: true,
          cancelReason: true,
          department: { select: { name: true } },
        },
      },
    },
  })
  // Sai mã hoặc sai email đều rơi vào đây: một câu chung, không cho biết phần nào sai (SEC-05).
  if (!registration || registration.guestEmail !== input.email) throw notFound(GENERIC_LOOKUP_MESSAGE)

  // department là relation dùng nội bộ: gỡ khỏi phản hồi, chỉ giữ tên ban tổ chức.
  const { event, ...registrationInfo } = registration
  const { department, ...eventInfo } = event
  return {
    ...registrationInfo,
    event: { ...eventInfo, departmentName: department?.name ?? null },
  }
}

/**
 * Khách hủy đăng ký bằng email + mã (FLOW-14 bước 5, AC-09): được đến hết `registrationClosesAt`,
 * hủy xong chỗ được trả lại (đếm chỗ chỉ tính REGISTERED) và gửi email xác nhận hủy (NTF-01).
 */
export async function cancelGuestRegistration(rawInput: unknown) {
  const input = registrationLookupInput.parse(rawInput)

  await db.$transaction(async (tx) => {
    const registration = await tx.eventRegistration.findUnique({
      where: { registrationCode: input.code },
      select: { id: true, status: true, guestEmail: true, eventId: true },
    })
    if (!registration || registration.guestEmail !== input.email) throw notFound(GENERIC_LOOKUP_MESSAGE)

    // Cùng khóa sự kiện với lúc đăng ký: hủy và đăng ký mới không giành chỗ của nhau.
    await tx.$queryRaw`SELECT id FROM events WHERE id = ${registration.eventId} FOR UPDATE`

    if (registration.status === 'CANCELLED') throw conflict('Đăng ký này đã được hủy trước đó.')

    const event = await tx.event.findUnique({
      where: { id: registration.eventId },
      select: { registrationClosesAt: true },
    })
    if (event?.registrationClosesAt && event.registrationClosesAt < new Date()) {
      throw conflict('Đã hết thời hạn hủy đăng ký. Vui lòng liên hệ CLB APC.')
    }

    // updateMany kèm điều kiện status để hai lượt hủy song song chỉ một lượt thắng.
    const { count } = await tx.eventRegistration.updateMany({
      where: { id: registration.id, status: 'REGISTERED' },
      data: { status: 'CANCELLED', cancelledAt: new Date() },
    })
    if (count === 0) throw conflict('Đăng ký này đã được hủy trước đó.')

    await enqueueEmail(tx, {
      type: 'EVENT_REGISTRATION_CANCELLED',
      to: input.email,
      refType: 'EVENT_REGISTRATION',
      refId: registration.id,
    })
  })

  return { status: 'CANCELLED' as const }
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

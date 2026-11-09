import { randomUUID } from 'node:crypto'

import type { FastifyBaseLogger, FastifyRequest } from 'fastify'
import type { EventStatus, Prisma, PrismaClient } from '../../db/generated/client.js'
import { z } from 'zod'

import { db } from '../../db/client.js'
import { AppError, conflict, forbidden, notFound } from '../../lib/errors.js'
import { publicCode, slugify } from '../../lib/ids.js'
import { pageArgs, pageQuery, toPage } from '../../lib/pagination.js'
import { formatVnDateTime } from '../../lib/vnTime.js'
import { AUDIT_ACTIONS, audit, type AuditActionName, AuditCategory, AuditResult } from '../audit/service.js'
import { currentUser, departmentScope, hasRole, type AuthUser } from '../auth/rbac.js'
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

export type EventListQuery = z.infer<typeof eventListQuery>
export type PortalEventListQuery = z.infer<typeof portalEventListQuery>

/** Cấu phần chung của hai loại query trên mà các hàm liệt kê dùng (E2, E5). */
type EventPageQuery = Pick<EventListQuery, 'page' | 'pageSize' | 'type' | 'month'>

/** Query params cho danh sách sự kiện của thành viên (E5): như danh sách công khai, không có ?upcoming (không dùng ở portal). */
export const portalEventListQuery = pageQuery.extend({
  type: z.string().trim().min(1).max(50).optional(),
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'month phải có dạng YYYY-MM.').optional(),
})

// ─── TRUY VẤN CHUNG ──────────────────────────────────────────────────────────

/** Sự kiện công khai: đã công bố, đã hủy hoặc đã kết thúc. Nháp, lưu trữ, nội bộ coi như không tồn tại (docs/02 §12). */
export const publicVisible: Prisma.EventWhereInput = {
  audience: 'PUBLIC',
  status: { in: ['PUBLISHED', 'CANCELLED', 'ENDED'] },
}

/** Chỉ select các trường cần hiển thị — KHÔNG lấy createdById, departmentId, audience và các trường điểm danh. */
export const eventListSelect = {
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

/**
 * Danh sách trong tháng (?month=): mọi sự kiện nhìn được bắt đầu trong tháng, xếp theo giờ bắt đầu —
 * dùng cho chế độ lịch (PUB-04). Dùng chung cho trang công khai (E2) và portal thành viên (E5),
 * chỉ khác bộ lọc nhìn được và các trường trả ra.
 */
async function listEventsInMonth<S extends Prisma.EventSelect>(
  query: EventPageQuery,
  month: string,
  visible: Prisma.EventWhereInput,
  select: S,
) {
  const window = monthWindowUtc(month)
  const where: Prisma.EventWhereInput = {
    ...visible,
    startAt: { gte: window.start, lt: window.end },
    ...typeFilter(query.type),
  }
  const [items, total] = await db.$transaction([
    db.event.findMany({ where, orderBy: [{ startAt: 'asc' }, { id: 'asc' }], select, ...pageArgs(query) }),
    db.event.count({ where }),
  ])
  return toPage(items, total, query)
}

/**
 * Danh sách mặc định như trang đã hứa ở E1: sắp diễn ra (gần nhất trước) → đã hủy → đã kết thúc
 * (mới nhất trước). PUBLISHED đã qua endAt chưa kịp chuyển ENDED bởi tác vụ event-end cũng tính
 * như đã kết thúc. Dùng chung cho trang công khai (E2) và portal thành viên (E5).
 */
async function listEventsUpcomingFirst<S extends Prisma.EventSelect>(
  query: EventPageQuery,
  visible: Prisma.EventWhereInput,
  select: S,
) {
  const now = new Date()
  // Điều kiện từng nhóm GỘP bằng AND với bộ lọc nhìn được: spread đè tên khóa sẽ làm mất `OR` của
  // bộ lọc nhìn được (vd. portal E5 diễn đạt phạm vi xem bằng OR) và ÂM THẦM MỞ rộng phạm vi nhóm.
  const groups: { where: Prisma.EventWhereInput; direction: 'asc' | 'desc' }[] = [
    {
      where: { AND: [visible, { status: 'PUBLISHED', endAt: { gte: now } }, typeFilter(query.type)] },
      direction: 'asc',
    },
    {
      where: { AND: [visible, { status: 'CANCELLED' }, typeFilter(query.type)] },
      direction: 'desc',
    },
    {
      where: {
        AND: [visible, { OR: [{ status: 'ENDED' }, { status: 'PUBLISHED', endAt: { lt: now } }] }, typeFilter(query.type)],
      },
      direction: 'desc',
    },
  ]

  // Đếm và lấy dòng PHẢI thấy cùng một ảnh chụp dữ liệu: cửa sổ từng nhóm trên trang tính theo số
  // đếm, nên chèn/xóa sự kiện xen vào giữa lúc đếm và lúc lấy (test chạy song song, hoặc người
  // dùng tạo sự kiện thật) làm cửa sổ lệch và ÂM THẦM RƠI sự kiện khỏi trang. RepeatableRead chốt
  // ảnh chụp từ câu lệnh đầu tiên cho cả transaction, chèn/xóa cùng lúc không còn ảnh hưởng.
  return db.$transaction(
    async (tx) => {
      const counts = await Promise.all(groups.map((group) => tx.event.count({ where: group.where })))
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
          return tx.event.findMany({
            where: group.where,
            orderBy: [{ startAt: group.direction }, { id: group.direction }],
            skip: overlapStart,
            take: overlapEnd - overlapStart,
            select,
          })
        }),
      )

      return toPage(chunks.flat(), total, query)
    },
    { isolationLevel: 'RepeatableRead' },
  )
}

/** Danh sách sự kiện công khai, phân trang. Chế độ ?month= (lịch), ?upcoming=1 (trang chủ) hoặc mặc định xếp upcoming trước. */
export async function listPublicEvents(rawQuery: unknown) {
  const query = eventListQuery.parse(rawQuery)

  // Lịch tháng: mọi sự kiện bắt đầu trong tháng (theo ngày Việt Nam), xếp theo giờ bắt đầu.
  if (query.month) return listEventsInMonth(query, query.month, publicVisible, eventListSelect)

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

  return listEventsUpcomingFirst(query, publicVisible, eventListSelect)
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
  endAt: Date
}

// Giờ Việt Nam = UTC + 7h cố định (BR-14): định dạng qua formatVnDateTime (lib/vnTime).

/**
 * Sự kiện có nhận đăng ký không (BR-08): đúng trạng thái, trong cửa sổ đăng ký, chưa qua thời điểm
 * diễn ra. Dùng chung cho khách (E3) và thành viên (E5); không đạt thì 409 kèm lý do rõ ràng (FLOW-14).
 */
function ensureEventOpenForRegistration(event: RegistrationWindow, now = new Date()) {
  if (event.status === 'CANCELLED') throw conflict('Sự kiện đã bị hủy, không nhận đăng ký.')
  if (event.status !== 'PUBLISHED') throw conflict('Sự kiện đã kết thúc, không nhận đăng ký.')
  if (event.registrationOpensAt && now < event.registrationOpensAt) {
    throw conflict(`Sự kiện chưa mở đăng ký. Nhận đăng ký từ ${formatVnDateTime(event.registrationOpensAt)}.`)
  }
  if (event.registrationClosesAt && now > event.registrationClosesAt) {
    throw conflict(`Đã hết thời hạn đăng ký từ ${formatVnDateTime(event.registrationClosesAt)}.`)
  }
  // PUBLISHED đã qua thời điểm diễn ra (tác vụ event-end chưa kịp chuyển trạng thái) cũng hết nhận đăng ký,
  // kể cả khi registrationClosesAt để trống (BR-08); cùng phép so sánh với tác vụ event-end (endAt < now).
  if (event.endAt < now) throw conflict('Sự kiện đã diễn ra, không nhận đăng ký.')
}

/** Sự kiện có nhận đăng ký của khách không? Cộng thêm điều kiện cho phép khách ngoài điều kiện chung. */
function ensureEventAcceptsGuests(event: RegistrationWindow, now = new Date()) {
  ensureEventOpenForRegistration(event, now)
  if (!event.allowGuestRegistration) throw conflict('Sự kiện này không nhận đăng ký của khách ngoài APC.')
}

const eventWindowSelect = {
  status: true,
  allowGuestRegistration: true,
  registrationOpensAt: true,
  registrationClosesAt: true,
  capacity: true,
  endAt: true,
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
        // Từng hủy rồi đăng ký lại: kích hoạt lại dòng cũ (không đè họ tên/MSSV đã lưu — SEC-05) và
        // cấp MÃ MỚI vì mã cũ đã nằm trong email xác nhận trước đó, dùng lại là rủi ro dò mã.
        current = await tx.eventRegistration.update({
          where: { id: existing.id },
          data: {
            status: 'REGISTERED',
            cancelledAt: null,
            registeredAt: new Date(),
            registrationCode: publicCode(),
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

/** Thông tin đăng ký trả về cho khách (tra cứu và hủy): dữ liệu của chính người đó + tóm tắt sự kiện (BR-09). */
const guestSummarySelect = {
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
      // Web dùng để ẩn nút hủy khi đã hết hạn hủy (BR-08)
      registrationClosesAt: true,
      cancelReason: true,
      department: { select: { name: true } },
    },
  },
} satisfies Prisma.EventRegistrationSelect

type GuestSummaryRow = Prisma.EventRegistrationGetPayload<{ select: typeof guestSummarySelect }>

/** Gỡ relation nội bộ (department) khỏi tóm tắt, chỉ giữ tên ban tổ chức. */
function toGuestSummary(registration: GuestSummaryRow) {
  const { event, ...registrationInfo } = registration
  const { department, ...eventInfo } = event
  return { ...registrationInfo, event: { ...eventInfo, departmentName: department?.name ?? null } }
}

/** Tra cứu đăng ký của khách (PAGE-PUB-08): trả kèm registrationClosesAt để web ẩn nút hủy khi hết hạn. */
export async function lookupGuestRegistration(rawInput: unknown) {
  const input = registrationLookupInput.parse(rawInput)

  const registration = await db.eventRegistration.findUnique({
    where: { registrationCode: input.code },
    select: guestSummarySelect,
  })
  // Sai mã hoặc sai email đều rơi vào đây: một câu chung, không cho biết phần nào sai (SEC-05).
  if (!registration || registration.guestEmail !== input.email) throw notFound(GENERIC_LOOKUP_MESSAGE)
  return toGuestSummary(registration)
}

/**
 * Khách hủy đăng ký bằng email + mã (FLOW-14 bước 5, AC-09): chỉ khi sự kiện vẫn PUBLISHED và chưa
 * qua endAt (kèm hạn hủy riêng nếu có) — không cho hủy vô thời hạn khi registrationClosesAt để trống.
 * Hủy xong chỗ được trả lại (đếm chỗ chỉ tính REGISTERED), email xác nhận xếp hàng trong cùng
 * transaction (NTF-01), và trả về bản ghi vừa cập nhật để web hiển thị ngay mà không phải tra cứu lại.
 */
export async function cancelGuestRegistration(rawInput: unknown) {
  const input = registrationLookupInput.parse(rawInput)

  return db.$transaction(async (tx) => {
    const registration = await tx.eventRegistration.findUnique({
      where: { registrationCode: input.code },
      select: { id: true, status: true, guestEmail: true, eventId: true },
    })
    if (!registration || registration.guestEmail !== input.email) throw notFound(GENERIC_LOOKUP_MESSAGE)

    // Cùng khóa sự kiện với lúc đăng ký: hủy và đăng ký mới không giành chỗ của nhau.
    await tx.$queryRaw`SELECT id FROM events WHERE id = ${registration.eventId} FOR UPDATE`

    if (registration.status === 'CANCELLED') throw conflict('Đăng ký này đã được hủy trước đó.')

    // Chỉ còn hủy khi sự kiện vẫn đang công bố và chưa diễn ra; hết hạn hủy riêng thì cũng chặn (BR-08, FLOW-14).
    const event = await tx.event.findUnique({
      where: { id: registration.eventId },
      select: { status: true, endAt: true, registrationClosesAt: true },
    })
    if (!event || event.status !== 'PUBLISHED') {
      throw conflict('Sự kiện đã kết thúc hoặc bị hủy, không thể hủy đăng ký.')
    }
    if (event.endAt < new Date()) {
      throw conflict('Sự kiện đã diễn ra, không thể hủy đăng ký.')
    }
    if (event.registrationClosesAt && event.registrationClosesAt < new Date()) {
      throw conflict('Đã hết thời hạn hủy đăng ký. Vui lòng liên hệ CLB APC.')
    }

    // updateMany kèm điều kiện status để hai lượt hủy song song chỉ một lượt thắng.
    const { count } = await tx.eventRegistration.updateMany({
      where: { id: registration.id, status: 'REGISTERED' },
      data: { status: 'CANCELLED', cancelledAt: new Date() },
    })
    if (count === 0) throw conflict('Đăng ký này đã được hủy trước đó.')

    // Đọc bản ghi vừa cập nhật để trả về cho web; email xếp hàng sau cùng, SMTP lỗi không mất lượt hủy (BR-17).
    const updated = await tx.eventRegistration.findUniqueOrThrow({
      where: { id: registration.id },
      select: guestSummarySelect,
    })
    await enqueueEmail(tx, {
      type: 'EVENT_REGISTRATION_CANCELLED',
      to: input.email,
      refType: 'EVENT_REGISTRATION',
      refId: registration.id,
    })
    return toGuestSummary(updated)
  })
}

// ─── PORTAL: SỰ KIỆN CỦA THÀNH VIÊN (E5) ────────────────────────────────────

/**
 * Thông báo 404 của portal: không tồn tại và ngoài phạm vi được xem cùng một câu, để không lộ dữ liệu
 * người dùng không được biết là có tồn tại (docs/02 mục 12.4).
 */
export const PORTAL_EVENT_NOT_FOUND_MESSAGE = 'Không tìm thấy sự kiện hoặc bạn không được xem sự kiện này.'

/**
 * Sự kiện thành viên được xem (E5): `PUBLIC` và `CLUB` cho mọi thành viên, `DEPARTMENT` chỉ khi người
 * dùng thuộc ban quản lý sự kiện. Lọc ngay trong truy vấn (docs/02 mục 12.2); nháp và lưu trữ coi như
 * không tồn tại. `user.departmentId` là ban của thành viên (RP-01); BOARD không thuộc ban nào nên không
 * thấy sự kiện nội bộ ban khác ở portal — muốn quản lý thì dùng trang quản trị.
 */
function memberVisibleWhere(user: AuthUser): Prisma.EventWhereInput {
  return {
    status: { in: ['PUBLISHED', 'CANCELLED', 'ENDED'] },
    OR: [
      { audience: 'PUBLIC' },
      { audience: 'CLUB' },
      // Sự kiện nội bộ trong ban: ban quản lý trùng ban của thành viên thì được xem
      ...(user.departmentId ? [{ audience: 'DEPARTMENT' as const, departmentId: user.departmentId }] : []),
    ],
  }
}

/** Danh sách sự kiện cho thành viên: thêm id (đích link), đối tượng, ban tổ chức và trạng thái đăng ký của chính người xem. */
function portalEventListSelect(userId: string) {
  return {
    id: true,
    slug: true,
    title: true,
    coverImageUrl: true,
    eventType: true,
    status: true,
    audience: true,
    department: { select: { name: true } },
    startAt: true,
    endAt: true,
    location: true,
    onlineUrl: true,
    // Đăng ký hiện có của chính người xem (FLOW-14); ràng buộc duy nhất (sự kiện, userId) cho tối đa một dòng
    registrations: { where: { userId }, select: { status: true } },
  } satisfies Prisma.EventSelect
}

type PortalEventListRow = Prisma.EventGetPayload<{ select: ReturnType<typeof portalEventListSelect> }>

function toPortalEventListItem(row: PortalEventListRow) {
  const { department, registrations, ...event } = row
  return {
    ...event,
    departmentName: department?.name ?? null,
    myRegistrationStatus: registrations[0]?.status ?? null,
  }
}

/** Danh sách sự kiện cho thành viên (PAGE-MEM-04): sự kiện công khai cộng nội bộ người đó được xem, chế độ lịch như E1. */
export async function listPortalEvents(request: FastifyRequest, rawQuery: unknown) {
  const user = currentUser(request)
  const query = portalEventListQuery.parse(rawQuery)
  const visible = memberVisibleWhere(user)
  const select = portalEventListSelect(user.id)

  const result = query.month
    ? await listEventsInMonth(query, query.month, visible, select)
    : await listEventsUpcomingFirst(query, visible, select)
  return { ...result, items: result.items.map(toPortalEventListItem) }
}

/** Chi tiết sự kiện cho thành viên (PAGE-MEM-05): như trang công khai cộng số chỗ đã đăng ký và đăng ký của chính người xem (BR-09). */
function portalEventDetailSelect(userId: string) {
  return {
    id: true,
    slug: true,
    title: true,
    description: true,
    coverImageUrl: true,
    eventType: true,
    status: true,
    audience: true,
    department: { select: { name: true } },
    contactPoint: true,
    location: true,
    onlineUrl: true,
    startAt: true,
    endAt: true,
    registrationOpensAt: true,
    registrationClosesAt: true,
    capacity: true,
    allowGuestRegistration: true,
    cancelReason: true,
    _count: { select: { registrations: { where: { status: 'REGISTERED' } } } },
    registrations: { where: { userId }, select: { status: true, registeredAt: true, cancelledAt: true } },
  } satisfies Prisma.EventSelect
}

type PortalEventDetailRow = Prisma.EventGetPayload<{ select: ReturnType<typeof portalEventDetailSelect> }>

function toPortalEventDetail(event: PortalEventDetailRow) {
  const { department, registrations, _count, ...rest } = event
  return {
    ...rest,
    departmentName: department?.name ?? null,
    registeredCount: _count.registrations,
    myRegistration: registrations[0] ?? null,
  }
}

export async function getPortalEvent(request: FastifyRequest, eventId: string) {
  const user = currentUser(request)
  const event = await db.event.findFirst({
    where: { id: eventId, ...memberVisibleWhere(user) },
    select: portalEventDetailSelect(user.id),
  })
  if (!event) throw notFound(PORTAL_EVENT_NOT_FOUND_MESSAGE)
  return toPortalEventDetail(event)
}

/** Kết quả đăng ký của thành viên: `alreadyRegistered` để web hiện đúng trạng thái đã có mà không tạo lượt mới (FLOW-14). */
export type MemberRegistrationResult = {
  status: 'REGISTERED'
  alreadyRegistered: boolean
  registeredAt: Date
  cancelledAt: Date | null
}

/**
 * Thành viên đăng ký sự kiện (E5, FLOW-14 luồng 1): đăng ký gắn tài khoản (userId), không cần nhập lại
 * thông tin. Cùng các kiểm tra với khách (E3): đúng trạng thái, trong cửa sổ đăng ký, còn chỗ — riêng
 * `allowGuestRegistration` KHÔNG áp dụng cho thành viên (EVT-02: nó chỉ chặn khách ngoài APC).
 * Đã đăng ký thì trả lại trạng thái hiện tại, không tạo bản ghi hay email mới (idempotent, QĐ-1).
 */
export async function registerMember(request: FastifyRequest, eventId: string): Promise<MemberRegistrationResult> {
  const user = currentUser(request)
  const event = await db.event.findFirst({
    where: { id: eventId, ...memberVisibleWhere(user) },
    select: { id: true, ...eventWindowSelect },
  })
  if (!event) throw notFound(PORTAL_EVENT_NOT_FOUND_MESSAGE)
  ensureEventOpenForRegistration(event)

  try {
    return await db.$transaction(async (tx) => {
      // Khóa dòng sự kiện như lúc khách đăng ký: đăng ký/hủy song song được xử lý tuần tự rồi mới đếm chỗ (BR-08).
      const locked = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM events WHERE id = ${event.id} FOR UPDATE`
      if (locked.length === 0) throw notFound(PORTAL_EVENT_NOT_FOUND_MESSAGE)

      // Đọc lại sau khi có khóa: ban quản trị có thể vừa hủy/đổi thời gian trong lúc người dùng mở trang.
      const fresh = await tx.event.findUnique({ where: { id: event.id }, select: eventWindowSelect })
      if (!fresh) throw notFound(PORTAL_EVENT_NOT_FOUND_MESSAGE)
      ensureEventOpenForRegistration(fresh)

      const registeredCount = await tx.eventRegistration.count({ where: { eventId: event.id, status: 'REGISTERED' } })
      const existing = await tx.eventRegistration.findUnique({
        where: { eventId_userId: { eventId: event.id, userId: user.id } },
      })

      // Idempotent: còn đăng ký hiệu lực thì trả lại trạng thái, không tạo bản ghi hay email mới (FLOW-14).
      if (existing && existing.status === 'REGISTERED') {
        return {
          status: 'REGISTERED',
          alreadyRegistered: true,
          registeredAt: existing.registeredAt,
          cancelledAt: existing.cancelledAt,
        }
      }
      if (fresh.capacity !== null && registeredCount >= fresh.capacity) throw conflict('Sự kiện đã hết chỗ.')

      let registrationId: string
      let registeredAt: Date
      if (existing) {
        // Từng hủy rồi đăng ký lại: kích hoạt lại dòng cũ như khách (E3) và cấp mã mới — mã cũ đã nằm trong email cũ.
        const updated = await tx.eventRegistration.update({
          where: { id: existing.id },
          data: { status: 'REGISTERED', cancelledAt: null, registeredAt: new Date(), registrationCode: publicCode() },
        })
        registrationId = updated.id
        registeredAt = updated.registeredAt
      } else {
        const created = await tx.eventRegistration.create({
          data: { eventId: event.id, userId: user.id, registrationCode: publicCode() },
        })
        registrationId = created.id
        registeredAt = created.registeredAt
      }

      // Email xác nhận xếp hàng trong cùng transaction (NTF-01); SMTP lỗi thì thử lại, đăng ký vẫn giữ (BR-17).
      const recipient = await tx.user.findUniqueOrThrow({ where: { id: user.id }, select: { email: true } })
      await enqueueEmail(tx, {
        type: 'EVENT_REGISTRATION_CONFIRMED_MEMBER',
        to: recipient.email,
        refType: 'EVENT_REGISTRATION',
        refId: registrationId,
      })

      return { status: 'REGISTERED', alreadyRegistered: false, registeredAt, cancelledAt: null }
    })
  } catch (error) {
    // Hai request cùng người gửi song song: ràng buộc duy nhất (sự kiện, userId) chặn — request thắng
    // tạo đăng ký, request còn lại đọc lại dòng đã có và trả trạng thái như lượt idempotent.
    if ((error as { code?: string }).code === 'P2002') {
      const existing = await db.eventRegistration.findUnique({
        where: { eventId_userId: { eventId, userId: user.id } },
      })
      if (existing && existing.status === 'REGISTERED') {
        return {
          status: 'REGISTERED',
          alreadyRegistered: true,
          registeredAt: existing.registeredAt,
          cancelledAt: existing.cancelledAt,
        }
      }
    }
    throw error
  }
}

/** Kết quả hủy đăng ký của thành viên (AC-09): trả về để web hiển thị ngay, không phải tải lại trang. */
export type MemberCancellationResult = {
  status: 'CANCELLED'
  cancelledAt: Date
}

/**
 * Thành viên hủy đăng ký (E5, FLOW-14 bước 5, AC-09): chỉ được hủy đến hết `registrationClosesAt`
 * (hoặc đến hết thời gian diễn ra nếu không đặt hạn riêng — cùng phép kiểm với khách, BR-08). Hủy
 * xong chỗ được trả lại (đếm chỗ chỉ tính REGISTERED) và email xác nhận hủy xếp hàng trong cùng
 * transaction (BR-17).
 */
export async function cancelMemberRegistration(request: FastifyRequest, eventId: string): Promise<MemberCancellationResult> {
  const user = currentUser(request)

  return db.$transaction(async (tx) => {
    // Kiểm phạm vi xem trước: sự kiện không tồn tại hoặc ngoài phạm vi cùng trả 404 (docs/02 mục 12.4).
    const visible = await tx.event.findFirst({ where: { id: eventId, ...memberVisibleWhere(user) }, select: { id: true } })
    if (!visible) throw notFound(PORTAL_EVENT_NOT_FOUND_MESSAGE)

    // Cùng khóa sự kiện với lúc đăng ký: hủy và đăng ký mới không giành chỗ của nhau.
    await tx.$queryRaw`SELECT id FROM events WHERE id = ${eventId} FOR UPDATE`

    const event = await tx.event.findUnique({
      where: { id: eventId },
      select: { status: true, endAt: true, registrationClosesAt: true },
    })
    if (!event) throw notFound(PORTAL_EVENT_NOT_FOUND_MESSAGE)

    const registration = await tx.eventRegistration.findUnique({
      where: { eventId_userId: { eventId, userId: user.id } },
    })
    if (!registration || registration.status === 'CANCELLED') throw conflict('Bạn chưa đăng ký sự kiện này.')

    // Cùng phép kiểm thời hạn hủy với khách (BR-08, FLOW-14).
    if (event.status !== 'PUBLISHED') throw conflict('Sự kiện đã kết thúc hoặc bị hủy, không thể hủy đăng ký.')
    if (event.endAt < new Date()) throw conflict('Sự kiện đã diễn ra, không thể hủy đăng ký.')
    if (event.registrationClosesAt && event.registrationClosesAt < new Date()) {
      throw conflict('Đã hết thời hạn hủy đăng ký. Vui lòng liên hệ CLB APC.')
    }

    // updateMany kèm điều kiện trạng thái: hai lượt hủy song song chỉ một lượt thắng.
    const cancelledAt = new Date()
    const { count } = await tx.eventRegistration.updateMany({
      where: { id: registration.id, status: 'REGISTERED' },
      data: { status: 'CANCELLED', cancelledAt },
    })
    if (count === 0) throw conflict('Đăng ký này đã được hủy trước đó.')

    // Email xếp hàng sau cùng: SMTP lỗi không mất lượt hủy (BR-17).
    const recipient = await tx.user.findUniqueOrThrow({ where: { id: user.id }, select: { email: true } })
    await enqueueEmail(tx, {
      type: 'EVENT_REGISTRATION_CANCELLED_MEMBER',
      to: recipient.email,
      refType: 'EVENT_REGISTRATION',
      refId: registration.id,
    })

    return { status: 'CANCELLED', cancelledAt }
  })
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

// ─── QUẢN TRỊ (E4) ──────────────────────────────────────────────────────────

// Dữ liệu phụ thuộc database mà sai (sức chứa, ban đã lưu trữ…): vẫn trả 422 dạng
// { error: 'validation', message } như lỗi Zod (docs/03 mục 14, FLOW-15 bước 3).
const invalidInput = (message: string) => new AppError(422, 'validation', message)

/**
 * Các trường nội dung quản lý sửa được (EVT-02, EVT-03) — không có trường trạng thái.
 * Kiểm chéo thời gian gắn ở `eventCreateSchema`, dùng chung cho tạo và cho sửa (trên dữ liệu đã gộp).
 */
const eventBaseSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().min(1).max(20000),
  eventType: z.string().trim().min(1).max(50),
  audience: z.enum(['PUBLIC', 'CLUB', 'DEPARTMENT']),
  coverImageUrl: z.string().trim().max(2000).nullish(),
  location: z.string().trim().max(200).nullish(),
  // FLOW-18: chỉ nhận link http/https
  onlineUrl: z
    .string()
    .trim()
    .max(2000)
    .regex(/^https?:\/\/\S+$/, 'Link trực tuyến phải là địa chỉ http/https.')
    .nullish(),
  contactPoint: z.string().trim().max(200).nullish(),
  departmentId: z.string().min(1).nullish(), // ban QUẢN LÝ sự kiện, không phải đối tượng tham gia (EVT-02)
  startAt: z.coerce.date(),
  endAt: z.coerce.date(),
  registrationOpensAt: z.coerce.date().nullish(),
  registrationClosesAt: z.coerce.date().nullish(),
  capacity: z.number().int().min(1).nullish(), // null = không giới hạn
  allowGuestRegistration: z.boolean(),
})

export const eventCreateSchema = eventBaseSchema
  .extend({
    audience: eventBaseSchema.shape.audience.default('PUBLIC'),
    allowGuestRegistration: eventBaseSchema.shape.allowGuestRegistration.default(false),
  })
  .superRefine((data, ctx) => {
    if (data.endAt.getTime() <= data.startAt.getTime()) {
      ctx.addIssue({ code: 'custom', path: ['endAt'], message: 'Thời gian kết thúc phải sau thời gian bắt đầu.' })
    }
    if (
      data.registrationOpensAt &&
      data.registrationClosesAt &&
      data.registrationClosesAt.getTime() <= data.registrationOpensAt.getTime()
    ) {
      ctx.addIssue({ code: 'custom', path: ['registrationClosesAt'], message: 'Thời gian đóng đăng ký phải sau thời gian mở đăng ký.' })
    }
    if (data.registrationClosesAt && data.registrationClosesAt.getTime() > data.endAt.getTime()) {
      ctx.addIssue({ code: 'custom', path: ['registrationClosesAt'], message: 'Thời gian đóng đăng ký không được sau thời gian kết thúc sự kiện.' })
    }
    if (data.audience !== 'PUBLIC' && data.allowGuestRegistration) {
      // EVT-02: cho phép khách chỉ áp dụng khi sự kiện công khai
      ctx.addIssue({ code: 'custom', path: ['allowGuestRegistration'], message: 'Chỉ sự kiện công khai (PUBLIC) mới được cho phép khách đăng ký.' })
    }
  })

/** PATCH: kiểm từng trường; kiểm chéo thời gian làm sau khi gộp với dữ liệu hiện có trong `updateEvent`. */
export const eventUpdateSchema = eventBaseSchema.partial()

export const cancelEventSchema = z.object({
  // EVT-09: hủy bắt buộc lý do, hiển thị trên trang công khai
  reason: z.string().trim().min(1).max(500),
})

export const adminEventListQuery = pageQuery.extend({
  status: z.enum(['DRAFT', 'PUBLISHED', 'CANCELLED', 'ENDED', 'ARCHIVED']).optional(),
  audience: z.enum(['PUBLIC', 'CLUB', 'DEPARTMENT']).optional(),
  departmentId: z.string().min(1).optional(),
})

/** Trường trả ra cho trang quản trị: đủ thông tin quản lý + số đăng ký còn hiệu lực (FLOW-15 cần để hộp xác nhận). */
const adminEventSelect = {
  id: true,
  title: true,
  slug: true,
  description: true,
  coverImageUrl: true,
  eventType: true,
  status: true,
  audience: true,
  departmentId: true,
  department: { select: { id: true, name: true, code: true } },
  contactPoint: true,
  createdById: true,
  createdBy: { select: { id: true, fullName: true } },
  location: true,
  onlineUrl: true,
  startAt: true,
  endAt: true,
  registrationOpensAt: true,
  registrationClosesAt: true,
  capacity: true,
  allowGuestRegistration: true,
  cancelReason: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { registrations: { where: { status: 'REGISTERED' } } } },
} satisfies Prisma.EventSelect

type AdminEventRow = Prisma.EventGetPayload<{ select: typeof adminEventSelect }>

function toAdminEvent(event: AdminEventRow) {
  const { _count, ...rest } = event
  return { ...rest, registeredCount: _count.registrations }
}

/** Các ban người gọi đang quản lý (dòng DEPARTMENT_MANAGER trong user_roles, đã lọc ACTIVE ở loadAuthUser). */
function managedDepartmentIds(user: AuthUser): string[] {
  return user.roles.flatMap((grant) =>
    grant.role === 'DEPARTMENT_MANAGER' && grant.departmentId !== null ? [grant.departmentId] : [],
  )
}

/** Ban đã lưu trữ không nhận sự kiện mới (ORG-06); ban phải tồn tại. */
async function assertDepartmentAcceptsEvents(tx: Prisma.TransactionClient | PrismaClient, departmentId: string) {
  const department = await tx.department.findUnique({ where: { id: departmentId }, select: { status: true } })
  if (!department) throw invalidInput('Ban quản lý không tồn tại.')
  if (department.status === 'ARCHIVED') throw invalidInput('Ban đã lưu trữ, không nhận sự kiện mới.')
}

/** Slug từ tiêu đề; trùng thì thêm hậu tố ngẫu nhiên (lib/ids.ts). */
async function uniqueSlug(title: string) {
  const base = slugify(title) || 'su-kien'
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = attempt === 0 ? base : `${base}-${randomUUID().slice(0, 6)}`
    const existing = await db.event.findUnique({ where: { slug: candidate }, select: { id: true } })
    if (!existing) return candidate
  }
  throw conflict('Tiêu đề trùng với quá nhiều sự kiện, hãy đặt tên khác.')
}

// ─── QUẢN TRỊ: ĐỌC ──────────────────────────────────────────────────────────

/**
 * Danh sách sự kiện cho trang quản trị (E4): BOARD thấy toàn CLB, DEPARTMENT_MANAGER chỉ các ban
 * mình quản lý (lọc ngay ở database theo docs/02 mục 12.2). Lọc thêm theo trạng thái, đối tượng, ban.
 * Các điều kiện gộp bằng AND: `?departmentId=` do người gọi truyền phải nằm TRONG phạm vi được xem,
 * không được đè lên bộ lọc phạm vi (spread đè lên sẽ lộ sự kiện ban khác qua tham số truy vấn).
 */
export async function listAdminEvents(request: FastifyRequest, rawQuery: unknown) {
  const user = currentUser(request)
  const query = adminEventListQuery.parse(rawQuery)
  const where: Prisma.EventWhereInput = {
    AND: [
      departmentScope(user),
      ...(query.status ? [{ status: query.status }] : []),
      ...(query.audience ? [{ audience: query.audience }] : []),
      ...(query.departmentId ? [{ departmentId: query.departmentId }] : []),
    ],
  }
  const [items, total] = await db.$transaction([
    db.event.findMany({ where, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], select: adminEventSelect, ...pageArgs(query) }),
    db.event.count({ where }),
  ])
  return toPage(items.map(toAdminEvent), total, query)
}

/** Chi tiết sự kiện cho trang quản trị. Phạm vi ban đã chặn ở route qua requireScope (404 nếu ngoài ban). */
export async function getAdminEvent(id: string) {
  const event = await db.event.findUnique({ where: { id }, select: adminEventSelect })
  if (!event) throw notFound('Không tìm thấy sự kiện.')
  return toAdminEvent(event)
}

// ─── QUẢN TRỊ: TẠO / SỬA ────────────────────────────────────────────────────

/**
 * Tạo sự kiện mới, luôn ở trạng thái DRAFT (FLOW-15 bước 1).
 * EVT-02: `departmentId` là ban quản lý — quản lý ban tự gán ban mình, không chọn ban khác;
 * BOARD được chọn ban ACTIVE nào hoặc bỏ trống (sự kiện toàn CLB không thuộc ban, chỉ BOARD xem được).
 */
export async function createEvent(request: FastifyRequest, rawBody: unknown) {
  const user = currentUser(request)
  const input = eventCreateSchema.parse(rawBody)

  let departmentId: string | null = null
  if (hasRole(user, 'BOARD')) {
    if (input.departmentId) {
      await assertDepartmentAcceptsEvents(db, input.departmentId)
      departmentId = input.departmentId
    }
  } else {
    const managed = managedDepartmentIds(user)
    if (input.departmentId && !managed.includes(input.departmentId)) {
      throw forbidden('Bạn chỉ có thể tạo sự kiện cho ban mình đang quản lý.')
    }
    if (!input.departmentId && managed.length > 1) {
      throw invalidInput('Bạn quản lý nhiều ban, hãy chọn ban quản lý sự kiện.')
    }
    const assigned = input.departmentId ?? managed[0]
    if (!assigned) throw forbidden('Bạn không quản lý ban nào nên không tạo được sự kiện.')
    await assertDepartmentAcceptsEvents(db, assigned)
    departmentId = assigned
  }

  const event = await db.event.create({
    data: {
      title: input.title,
      slug: await uniqueSlug(input.title),
      description: input.description,
      eventType: input.eventType,
      audience: input.audience,
      status: 'DRAFT',
      departmentId,
      contactPoint: input.contactPoint ?? null,
      coverImageUrl: input.coverImageUrl ?? null,
      location: input.location ?? null,
      onlineUrl: input.onlineUrl ?? null,
      startAt: input.startAt,
      endAt: input.endAt,
      registrationOpensAt: input.registrationOpensAt ?? null,
      registrationClosesAt: input.registrationClosesAt ?? null,
      capacity: input.capacity ?? null,
      allowGuestRegistration: input.allowGuestRegistration,
      createdById: user.id,
    },
    select: adminEventSelect,
  })
  return toAdminEvent(event)
}

/**
 * Sửa nội dung sự kiện (FLOW-15): chỉ DRAFT và PUBLISHED sửa được; đã hủy, đã kết thúc, đã lưu trữ
 * là chốt hạ. Kiểm chéo thời gian trên dữ liệu SAU khi gộp (vd PATCH riêng startAt vẫn phải trước
 * endAt đang có); sức chứa không được nhỏ hơn số người đã đăng ký. Đổi đối tượng sang CLUB/PUBLIC
 * chỉ BOARD (chống leo thang quyền công bố qua PATCH).
 */
export async function updateEvent(request: FastifyRequest, id: string, rawBody: unknown) {
  const user = currentUser(request)
  const patch = eventUpdateSchema.parse(rawBody)

  // Không lách quyền công bố qua PATCH (docs/02 §8.3): đặt đối tượng CLUB/PUBLIC là hành vi công bố,
  // chỉ BOARD được làm. Chặn trước cả khi tải bản ghi: quản lý ban công bố sự kiện nội bộ của ban mình
  // rồi PATCH thành PUBLIC sẽ công khai sự kiện mà không qua lượt duyệt của BOARD.
  if (patch.audience && patch.audience !== 'DEPARTMENT' && !hasRole(user, 'BOARD')) {
    await transitionDenied(request, AUDIT_ACTIONS.EVENT_PUBLISH, id, `Đổi đối tượng sang ${patch.audience} — chỉ BOARD được công bố mức này`)
    throw forbidden('Chỉ Ban Chủ nhiệm được đặt đối tượng sự kiện thành toàn CLB hoặc công khai.')
  }

  return db.$transaction(async (tx) => {
    const event = await tx.event.findUnique({
      where: { id },
      select: {
        status: true,
        departmentId: true,
        title: true,
        description: true,
        eventType: true,
        audience: true,
        coverImageUrl: true,
        location: true,
        onlineUrl: true,
        contactPoint: true,
        startAt: true,
        endAt: true,
        registrationOpensAt: true,
        registrationClosesAt: true,
        capacity: true,
        allowGuestRegistration: true,
      },
    })
    if (!event) throw notFound('Không tìm thấy sự kiện.')
    if (event.status !== 'DRAFT' && event.status !== 'PUBLISHED') {
      throw conflict('Sự kiện đã hủy, đã kết thúc hoặc đã lưu trữ nên không sửa được nữa.')
    }

    if (patch.departmentId && patch.departmentId !== event.departmentId) {
      // Đổi ban quản lý: quản lý ban không vượt khỏi các ban mình quản lý; BOARD bất kỳ ban ACTIVE nào.
      if (!hasRole(user, 'BOARD') && !managedDepartmentIds(user).includes(patch.departmentId)) {
        throw forbidden('Bạn chỉ có thể giữ sự kiện ở các ban mình đang quản lý.')
      }
      await assertDepartmentAcceptsEvents(tx, patch.departmentId)
    }

    // Kiểm chéo thời gian trên dữ liệu đã gộp; bỏ qua kết quả, sai thì ZodError tự thành 422.
    eventCreateSchema.parse({ ...event, ...patch })

    if (patch.capacity !== undefined && patch.capacity !== null) {
      const registered = await tx.eventRegistration.count({ where: { eventId: id, status: 'REGISTERED' } })
      if (patch.capacity < registered) {
        throw invalidInput(`Sức chứa không thể nhỏ hơn số người đã đăng ký (hiện có ${registered}).`)
      }
    }

    // Runtime của Prisma coi trường undefined như không gửi; cast chỉ để Prisma nhận kiểu optional
    // có `| undefined` của Zod dưới exactOptionalPropertyTypes.
    const updated = await tx.event.update({
      where: { id },
      data: patch as Prisma.EventUncheckedUpdateInput,
      select: adminEventSelect,
    })
    return toAdminEvent(updated)
  })
}

// ─── QUẢN TRỊ: CHUYỂN TRẠNG THÁI (docs/01 §9.2) ────────────────────────────
// Mỗi bước một route; sai bước trả 409 (BR-16). Bước PUBLISHED → ENDED do tác vụ nền
// 'event-end' làm khi qua endAt, không có route thủ công.

/** Ghi audit FAILURE cho thao tác bị chặn (sai bước chuyển, vượt quyền công bố) — ghi ngoài transaction rồi ném lỗi. */
function transitionDenied(request: FastifyRequest, action: AuditActionName, eventId: string, reason: string) {
  return audit(request, {
    action,
    targetType: 'EVENT',
    targetId: eventId,
    category: AuditCategory.BUSINESS,
    result: AuditResult.FAILURE,
    reason,
  })
}

/**
 * Công bố sự kiện (DRAFT → PUBLISHED). Quyền theo docs/02 §8.3: sự kiện nội bộ trong ban
 * (`audience = DEPARTMENT`) quản lý ban công bố được; `CLUB` và `PUBLIC` chỉ BOARD công bố.
 */
export async function publishEvent(request: FastifyRequest, id: string) {
  const user = currentUser(request)
  const current = await db.event.findUnique({ where: { id }, select: { status: true, audience: true } })
  if (!current) throw notFound('Không tìm thấy sự kiện.')

  if (current.audience !== 'DEPARTMENT' && !hasRole(user, 'BOARD')) {
    await transitionDenied(request, AUDIT_ACTIONS.EVENT_PUBLISH, id, 'Chỉ Ban Chủ nhiệm được công bố sự kiện toàn CLB hoặc công khai')
    throw forbidden('Chỉ Ban Chủ nhiệm được công bố sự kiện toàn CLB hoặc công khai.')
  }

  return db.$transaction(async (tx) => {
    // updateMany kèm điều kiện trạng thái: hai request công bố cùng lúc chỉ một thắng.
    const result = await tx.event.updateMany({ where: { id, status: 'DRAFT' }, data: { status: 'PUBLISHED' } })
    if (result.count === 0) {
      const status = (await tx.event.findUnique({ where: { id }, select: { status: true } }))?.status
      await transitionDenied(request, AUDIT_ACTIONS.EVENT_PUBLISH, id, `Sai bước chuyển từ trạng thái ${status ?? 'không rõ'}`)
      throw conflict('Chỉ sự kiện ở trạng thái bản nháp mới công bố được.')
    }
    const updated = await tx.event.findUnique({ where: { id }, select: adminEventSelect })
    if (!updated) throw notFound('Không tìm thấy sự kiện.')
    await audit(
      request,
      {
        action: AUDIT_ACTIONS.EVENT_PUBLISH,
        targetType: 'EVENT',
        targetId: id,
        category: AuditCategory.BUSINESS,
        result: AuditResult.SUCCESS,
        metadata: { audience: current.audience },
      },
      tx,
    )
    return toAdminEvent(updated)
  })
}

/**
 * Hủy sự kiện (PUBLISHED → CANCELLED), EVT-09: bắt buộc lý do (lưu `cancelReason`, hiện trên trang
 * công khai), GIỮ NGUYÊN mọi dữ liệu đăng ký, gửi email báo hủy cho người còn đăng ký (NTF-01).
 * Tất cả trong một transaction: rollback nghiệp vụ thì không có email nào được xếp (docs/06 §5).
 */
export async function cancelEvent(request: FastifyRequest, id: string, rawBody: unknown) {
  const { reason } = cancelEventSchema.parse(rawBody)
  // Route đã chặn bằng requireRole; dòng này để gọi trực tiếp service cũng phải có người đăng nhập.
  currentUser(request)

  return db.$transaction(async (tx) => {
    const event = await tx.event.findUnique({ where: { id }, select: { status: true, departmentId: true } })
    if (!event) throw notFound('Không tìm thấy sự kiện.')
    if (event.status !== 'PUBLISHED') {
      // Chặn cả DRAFT → CANCELLED lẫn hủy hai lần (docs/01 §9.2, BR-16).
      await transitionDenied(request, AUDIT_ACTIONS.EVENT_CANCEL, id, `Sai bước chuyển từ trạng thái ${event.status}`)
      throw conflict('Chỉ sự kiện đang công bố mới hủy được.')
    }

    const result = await tx.event.updateMany({
      where: { id, status: 'PUBLISHED' },
      data: { status: 'CANCELLED', cancelReason: reason },
    })
    if (result.count === 0) throw conflict('Sự kiện vừa thay đổi trạng thái, hãy tải lại trang.')

    // EVT-09: không đụng các dòng đăng ký; chỉ thông báo người còn REGISTERED.
    // Thành viên lấy email từ User, khách từ guestEmail; trùng email chỉ nhận một thư.
    const registrants = await tx.eventRegistration.findMany({
      where: { eventId: id, status: 'REGISTERED' },
      select: { user: { select: { email: true } }, guestEmail: true },
    })
    const recipients = [
      ...new Set(registrants.map((row) => row.user?.email ?? row.guestEmail).filter((email): email is string => email !== null)),
    ]
    for (const to of recipients) {
      // Chỉ truyền tham chiếu, không truyền mã hay nội dung (FLOW-26, OPS-11).
      await enqueueEmail(tx, { type: 'EVENT_CANCELLED', to, refType: 'EVENT', refId: id, departmentId: event.departmentId ?? undefined })
    }

    await audit(
      request,
      {
        action: AUDIT_ACTIONS.EVENT_CANCEL,
        targetType: 'EVENT',
        targetId: id,
        category: AuditCategory.BUSINESS,
        result: AuditResult.SUCCESS,
        reason,
        metadata: { notified: recipients.length },
      },
      tx,
    )

    const updated = await tx.event.findUnique({ where: { id }, select: adminEventSelect })
    if (!updated) throw notFound('Không tìm thấy sự kiện.')
    return toAdminEvent(updated)
  })
}

/** Lưu trữ sự kiện: chỉ từ CANCELLED hoặc ENDED (docs/01 §9.2); ARCHIVED là trạng thái cuối. */
export async function archiveEvent(request: FastifyRequest, id: string) {
  // Route đã chặn bằng requireRole; dòng này để gọi trực tiếp service cũng phải có người đăng nhập.
  currentUser(request)

  return db.$transaction(async (tx) => {
    const result = await tx.event.updateMany({
      where: { id, status: { in: ['CANCELLED', 'ENDED'] } },
      data: { status: 'ARCHIVED' },
    })
    if (result.count === 0) {
      const status = (await tx.event.findUnique({ where: { id }, select: { status: true } }))?.status
      if (!status) throw notFound('Không tìm thấy sự kiện.')
      await transitionDenied(request, AUDIT_ACTIONS.EVENT_ARCHIVE, id, `Sai bước chuyển từ trạng thái ${status}`)
      throw conflict('Chỉ sự kiện đã hủy hoặc đã kết thúc mới lưu trữ được.')
    }
    const updated = await tx.event.findUnique({ where: { id }, select: adminEventSelect })
    if (!updated) throw notFound('Không tìm thấy sự kiện.')
    await audit(
      request,
      {
        action: AUDIT_ACTIONS.EVENT_ARCHIVE,
        targetType: 'EVENT',
        targetId: id,
        category: AuditCategory.BUSINESS,
        result: AuditResult.SUCCESS,
      },
      tx,
    )
    return toAdminEvent(updated)
  })
}

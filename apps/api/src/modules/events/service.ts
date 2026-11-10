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
import { canAccessDepartment, currentUser, departmentScope, hasRole, type AuthUser } from '../auth/rbac.js'
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

  // Đếm và lấy dòng PHẢI thấy cùng một ảnh chụp dữ liệu: cửa sổ từng nhóm trên trang tính theo số
  // đếm, nên chèn/xóa sự kiện PUBLIC xen vào giữa lúc đếm và lúc lấy (test chạy song song, hoặc người
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
            select: eventListSelect,
          })
        }),
      )

      return toPage(chunks.flat(), total, query)
    },
    { isolationLevel: 'RepeatableRead' },
  )
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

/** Sự kiện có nhận đăng ký của khách không? Không đạt thì 409 kèm lý do rõ ràng (FLOW-14). */
function ensureEventAcceptsGuests(event: RegistrationWindow, now = new Date()) {
  if (event.status === 'CANCELLED') throw conflict('Sự kiện đã bị hủy, không nhận đăng ký.')
  if (event.status !== 'PUBLISHED') throw conflict('Sự kiện đã kết thúc, không nhận đăng ký.')
  if (!event.allowGuestRegistration) throw conflict('Sự kiện này không nhận đăng ký của khách ngoài APC.')
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
 * Chuỗi thời gian ISO 8601 **kèm múi giờ** (Z hoặc ±hh:mm), đổi thành Date. Thay cho `z.coerce.date()`
 * từng nhận mọi thứ JS Date hiểu được: "5" thành mốc lịch sử, thiếu múi giờ thì tùy máy chủ đoán (BR-14).
 */
const isoDateTime = z
  .string()
  .datetime({ offset: true, message: 'Thời gian phải là chuỗi ISO 8601 kèm múi giờ, ví dụ 2026-11-05T08:00:00Z.' })
  .transform((value) => new Date(value))

/**
 * Ảnh bìa chỉ nhận tệp đã tải lên qua module files, theo đúng đường dẫn công khai `/api/public/files/<mã tệp>`
 * (component FileUpload của web sinh đúng dạng này). Chặn URL ngoài và payload như `javascript:` (XSS)
 * vì web render thẳng giá trị này vào `src` của ảnh.
 */
const coverImageUrl = z
  .string()
  .trim()
  .regex(/^\/api\/public\/files\/[A-Za-z0-9]+$/, 'Ảnh bìa phải là tệp đã tải lên của CLB (/api/public/files/<mã tệp>).')

/**
 * Các trường nội dung quản lý sửa được (EVT-02, EVT-03) — không có trường trạng thái.
 * Kiểm chéo thời gian gắn ở `eventCreateSchema`, dùng chung cho tạo và cho sửa (trên dữ liệu đã gộp).
 */
const eventBaseSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().min(1).max(20000),
  eventType: z.string().trim().min(1).max(50),
  audience: z.enum(['PUBLIC', 'CLUB', 'DEPARTMENT']),
  coverImageUrl: coverImageUrl.nullish(),
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
  startAt: isoDateTime,
  endAt: isoDateTime,
  registrationOpensAt: isoDateTime.nullish(),
  registrationClosesAt: isoDateTime.nullish(),
  // null = không giới hạn; chặn trần vô lý (số 2 tỷ khiến đếm chỗ và UI thất thường)
  capacity: z.number().int().min(1).max(1_000_000).nullish(),
  allowGuestRegistration: z.boolean(),
})

export const eventCreateSchema = eventBaseSchema
  .extend({
    audience: eventBaseSchema.shape.audience.default('PUBLIC'),
    allowGuestRegistration: eventBaseSchema.shape.allowGuestRegistration.default(false),
  })
  .superRefine((data, ctx) => {
    // Zod 4 vẫn chạy superRefine với dữ liệu thô khi một trường thời gian sai định dạng (lỗi định dạng
    // đã được báo ở từng trường): bỏ qua kiểm chéo trong lượt đó, không `.getTime()` trên chuỗi.
    const dates = [data.startAt, data.endAt, data.registrationOpensAt, data.registrationClosesAt]
    if (!dates.every((value) => value === null || value === undefined || value instanceof Date)) return
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

/**
 * Slug đè lên trang tĩnh của web dưới `/events/*` (apps/web/src/routes.tsx, Sitemap §15.1): web khớp
 * route tĩnh trước route động `/events/:slug`, nên sự kiện có slug này sẽ không bao giờ mở được trang chi tiết.
 */
const RESERVED_SLUGS = ['registration-lookup']

/** Slug từ tiêu đề; trùng hoặc trùng trang tĩnh của web thì thêm hậu tố ngẫu nhiên (lib/ids.ts). */
async function uniqueSlug(title: string) {
  const base = slugify(title) || 'su-kien'
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = attempt === 0 ? base : `${base}-${randomUUID().slice(0, 6)}`
    const existing = await db.event.findUnique({ where: { slug: candidate }, select: { id: true } })
    if (!existing && !RESERVED_SLUGS.includes(candidate)) return candidate
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
    // Quyền theo ban dùng hàm chung của rbac (không tự so sánh danh sách ban quản lý riêng).
    if (input.departmentId && !canAccessDepartment(user, input.departmentId)) {
      throw forbidden('Bạn chỉ có thể tạo sự kiện cho ban mình đang quản lý.')
    }
    const managed = managedDepartmentIds(user)
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
 * chỉ BOARD (chống leo thang quyền công bố qua PATCH) — form gửi lại đối tượng hiện có thì không chặn.
 * Khóa dòng sự kiện `FOR UPDATE` trước khi đếm chỗ để không đua với đăng ký của khách; hạ sự kiện
 * khỏi PUBLIC thì chạy luồng email báo hủy cho người còn đăng ký (NTF-01) và ghi audit.
 */
export async function updateEvent(request: FastifyRequest, id: string, rawBody: unknown) {
  const user = currentUser(request)
  const patch = eventUpdateSchema.parse(rawBody)

  return db.$transaction(async (tx) => {
    // Khóa dòng sự kiện trước khi đọc (như registerGuest): đếm chỗ dưới đây phải tuần tự với
    // đăng ký/hủy của khách (cùng khóa dòng này) nếu không hai bên đếm chéo lúc vừa có người
    // đăng ký song song sẽ vượt sức chứa hoặc chặn nhầm.
    const locked = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM events WHERE id = ${id} FOR UPDATE`
    if (locked.length === 0) throw notFound('Không tìm thấy sự kiện.')

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

    // Không lách quyền công bố qua PATCH (docs/02 §8.3): ĐỔI đối tượng sang CLUB/PUBLIC là hành vi
    // công bố, chỉ BOARD được làm. Chỉ chặn khi đối tượng thay đổi thật: quản lý ban sửa sự kiện
    // toàn CLB thuộc ban mình mà form gửi lại đối tượng cũ không bị 403 oan.
    if (patch.audience && patch.audience !== event.audience && patch.audience !== 'DEPARTMENT' && !hasRole(user, 'BOARD')) {
      await transitionDenied(request, AUDIT_ACTIONS.EVENT_PUBLISH, id, `Đổi đối tượng sang ${patch.audience} — chỉ BOARD được công bố mức này`)
      throw forbidden('Chỉ Ban Chủ nhiệm được đặt đối tượng sự kiện thành toàn CLB hoặc công khai.')
    }

    if (patch.departmentId !== undefined) {
      if (patch.departmentId === null) {
        // Bỏ trống ban quản lý làm sự kiện rơi khỏi phạm vi mọi quản lý ban (chỉ BOARD còn thấy):
        // quản lý ban bị chặn để sự kiện không mất ngầm khỏi phạm vi; BOARD chủ động bỏ được như khi tạo.
        if (!hasRole(user, 'BOARD')) throw forbidden('Không thể bỏ trống ban quản lý của sự kiện.')
      } else if (patch.departmentId !== event.departmentId) {
        // Đổi ban quản lý: quyền theo ban dùng hàm chung của rbac — quản lý ban không vượt khỏi
        // các ban mình quản lý, BOARD bất kỳ ban ACTIVE nào.
        if (!canAccessDepartment(user, patch.departmentId)) {
          throw forbidden('Bạn chỉ có thể giữ sự kiện ở các ban mình quản lý.')
        }
        await assertDepartmentAcceptsEvents(tx, patch.departmentId)
      }
    }

    // Kiểm chéo thời gian trên dữ liệu đã gộp; sai thì ZodError tự thành 422. Schema giờ nhận chuỗi
    // ISO 8601 (không còn coerce.date), nên đưa Date của bản ghi và của patch (sau transform) về chuỗi ISO.
    const chosen = <T>(patched: T | undefined, current: T): T => (patched !== undefined ? patched : current)
    eventCreateSchema.parse({
      ...event,
      ...patch,
      startAt: chosen(patch.startAt, event.startAt).toISOString(),
      endAt: chosen(patch.endAt, event.endAt).toISOString(),
      registrationOpensAt: chosen(patch.registrationOpensAt, event.registrationOpensAt)?.toISOString() ?? null,
      registrationClosesAt: chosen(patch.registrationClosesAt, event.registrationClosesAt)?.toISOString() ?? null,
    })

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

    // Hạ sự kiện khỏi PUBLIC (vd PUBLIC → DEPARTMENT nội bộ): trang công khai trả 404 trong khi
    // khách vẫn REGISTERED — chạy luồng email báo hủy như khi hủy sự kiện (NTF-01, EVT-09), giữ
    // nguyên dữ liệu đăng ký, và ghi audit để truy vết vì đây là hành động thu hồi công khai.
    if (event.audience === 'PUBLIC' && patch.audience !== undefined && patch.audience !== 'PUBLIC') {
      const registrants = await tx.eventRegistration.findMany({
        where: { eventId: id, status: 'REGISTERED' },
        select: { user: { select: { email: true } }, guestEmail: true },
      })
      const recipients = [
        ...new Set(registrants.map((row) => row.user?.email ?? row.guestEmail).filter((email): email is string => email !== null)),
      ]
      for (const to of recipients) {
        // Chỉ truyền tham chiếu, không truyền mã hay nội dung (FLOW-26, OPS-11).
        await enqueueEmail(tx, { type: 'EVENT_CANCELLED', to, refType: 'EVENT', refId: id, departmentId: updated.departmentId ?? undefined })
      }
      await audit(
        request,
        {
          action: AUDIT_ACTIONS.EVENT_UNPUBLISH,
          targetType: 'EVENT',
          targetId: id,
          category: AuditCategory.BUSINESS,
          result: AuditResult.SUCCESS,
          metadata: { audience: patch.audience, previousAudience: event.audience, notified: recipients.length },
        },
        tx,
      )
    }

    // Timeout 30s như lúc hủy: luồng hạ PUBLIC cũng xếp email tuần tự cho từng người nhận.
    return toAdminEvent(updated)
  }, { timeout: 30_000 })
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

  return db.$transaction(async (tx) => {
    // Đọc đối tượng trong transaction để quyền và điều kiện cập nhật dựa trên một ảnh chụp nhất quán:
    // PATCH đổi đối tượng chạy song song sẽ chờ khóa, không công bố theo đối tượng đã đọc cũ.
    const current = await tx.event.findUnique({ where: { id }, select: { status: true, audience: true } })
    if (!current) throw notFound('Không tìm thấy sự kiện.')

    if (current.audience !== 'DEPARTMENT' && !hasRole(user, 'BOARD')) {
      await transitionDenied(request, AUDIT_ACTIONS.EVENT_PUBLISH, id, 'Chỉ Ban Chủ nhiệm được công bố sự kiện toàn CLB hoặc công khai')
      throw forbidden('Chỉ Ban Chủ nhiệm được công bố sự kiện toàn CLB hoặc công khai.')
    }

    // updateMany kèm điều kiện trạng thái VÀ đối tượng vừa đọc: hai request công bố/đổi đối tượng chạy
    // cùng lúc chỉ một thắng, và không bao giờ công bố nhầm sau khi đối tượng đã bị đổi ở client khác.
    const result = await tx.event.updateMany({
      where: { id, status: 'DRAFT', audience: current.audience },
      data: { status: 'PUBLISHED' },
    })
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

  // Timeout 30s thay mặc định 5s: xếp email báo hủy tuần tự cho từng người nhận (NTF-01), sự kiện
  // lớn dễ vượt 5s và rollback mất cả thao tác hủy.
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
  }, { timeout: 30_000 })
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

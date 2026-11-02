// Logic kiểm tra form tạo sự kiện (E4) — hàm thuần tách riêng để viết unit test,
// cùng cách tổ chức với roundPhase.ts của mảng tuyển thành viên.
//
// Khớp các kiểm chéo của API (eventCreateSchema trong apps/api/src/modules/events/service.ts):
// endAt > startAt, đóng đăng ký sau mở đăng ký, đóng đăng ký không sau endAt, sức chứa nguyên ≥ 1.

import { fromVnDatetimeInput } from '../../../lib/format'
import type { AdminEvent, EventAudience } from './types'

export type EventFormField =
  | 'title'
  | 'description'
  | 'startAt'
  | 'endAt'
  | 'registrationClosesAt'
  | 'capacity'
  | 'departmentId'

export type EventFormErrors = Partial<Record<EventFormField, string>>

export type EventFormValues = {
  title: string
  description: string
  audience: EventAudience
  /** "YYYY-MM-DDTHH:mm" theo giờ Việt Nam — giá trị của <input type="datetime-local"> */
  startAt: string
  endAt: string
  registrationOpensAt: string
  registrationClosesAt: string
  /** Chuỗi số trong ô nhập; rỗng là không giới hạn */
  capacity: string
  departmentId: string
}

export type ValidateEventFormOptions = {
  /**
   * Quản lý ban bắt buộc gắn sự kiện với ban mình (API từ chối "toàn CLB" của quản lý ban — EVT-02);
   * BOARD được bỏ trống. Đặt true kèm thông báo phù hợp khi người gọi biết ngữ cảnh vai trò.
   */
  requireDepartment?: boolean
  requireDepartmentMessage?: string
  /**
   * Số đăng ký còn hiệu lực của sự kiện đang sửa (PATCH /admin/events/:id): sức chứa mới không được
   * nhỏ hơn số này — API trả 422 "Sức chứa không thể nhỏ hơn số người đã đăng ký".
   */
  registeredCount?: number
}

/** Giờ Việt Nam của ô datetime-local quy về timestamp để so sánh, đúng như giá trị gửi lên API (BR-14). */
const vnInputTime = (value: string) => new Date(fromVnDatetimeInput(value)).getTime()

/** Chuỗi trong ô sức chứa quy về giá trị lưu trong database; rỗng là không giới hạn (null). */
export const capacityValue = (value: string) => (value.trim() ? Number(value) : null)

export function validateEventForm(
  values: EventFormValues,
  {
    requireDepartment = false,
    requireDepartmentMessage = 'Bạn chưa chọn ban quản lý sự kiện.',
    registeredCount,
  }: ValidateEventFormOptions = {},
): EventFormErrors {
  const errors: EventFormErrors = {}

  if (!values.title.trim()) errors.title = 'Vui lòng nhập tiêu đề sự kiện.'
  if (!values.description.trim()) errors.description = 'Vui lòng nhập mô tả sự kiện.'

  if (!values.startAt) errors.startAt = 'Vui lòng chọn thời gian bắt đầu.'
  if (!values.endAt) errors.endAt = 'Vui lòng chọn thời gian kết thúc.'
  if (values.startAt && values.endAt && vnInputTime(values.endAt) <= vnInputTime(values.startAt)) {
    errors.endAt = 'Thời gian kết thúc phải sau thời gian bắt đầu.'
  }

  // Kiểm của ô "Đóng đăng ký" — chỉ hiện một thông báo, ưu tiên lỗi so với thời điểm mở đăng ký.
  if (values.registrationClosesAt) {
    if (
      values.registrationOpensAt &&
      vnInputTime(values.registrationClosesAt) <= vnInputTime(values.registrationOpensAt)
    ) {
      errors.registrationClosesAt = 'Thời gian đóng đăng ký phải sau thời gian mở đăng ký.'
    } else if (values.endAt && vnInputTime(values.registrationClosesAt) > vnInputTime(values.endAt)) {
      errors.registrationClosesAt = 'Thời gian đóng đăng ký không được sau thời gian kết thúc sự kiện.'
    }
  }

  if (values.capacity.trim()) {
    const capacity = Number(values.capacity)
    if (!Number.isInteger(capacity) || capacity < 1) {
      errors.capacity = 'Sức chứa phải là số nguyên từ 1 trở lên, hoặc bỏ trống nếu không giới hạn.'
    } else if (registeredCount !== undefined && capacity < registeredCount) {
      // Khớp thông báo 422 của API khi sửa sự kiện đã có người đăng ký (FLOW-15).
      errors.capacity = `Sức chứa không thể nhỏ hơn số người đã đăng ký (hiện có ${registeredCount}).`
    }
  }

  if (requireDepartment && !values.departmentId) {
    errors.departmentId = requireDepartmentMessage
  }
  return errors
}

/**
 * Sửa thời gian diễn ra, sức chứa hoặc đối tượng của sự kiện ĐÃ CÓ NGƯỜI ĐĂNG KÝ là điều kiện
 * bắt buộc hiện hộp xác nhận kèm số người bị ảnh hưởng (FLOW-15 nhánh thay thế). Đổi cửa sổ
 * đăng ký không nằm trong nhóm này. So giá trị đã quy về dạng API để "sửa rồi sửa lại" thành
 * giá trị cũ thì không còn coi là thay đổi.
 */
export function affectsRegisteredUsers(
  event: Pick<AdminEvent, 'startAt' | 'endAt' | 'capacity' | 'audience'>,
  values: Pick<EventFormValues, 'startAt' | 'endAt' | 'capacity' | 'audience'>,
): boolean {
  return (
    fromVnDatetimeInput(values.startAt) !== event.startAt ||
    fromVnDatetimeInput(values.endAt) !== event.endAt ||
    capacityValue(values.capacity) !== event.capacity ||
    values.audience !== event.audience
  )
}

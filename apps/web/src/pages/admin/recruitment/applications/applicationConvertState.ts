import { hasRole, type Me } from '../../../../lib/auth'
import type { ApplicationStatus } from '../../../recruitment/types'

export type ConvertActionState = 'CAN_CONVERT' | 'ALREADY_CONVERTED' | 'BOARD_ONLY' | 'HIDDEN'

/**
 * Xác định trạng thái nút/khung chuyển thành viên theo vai trò và trạng thái hồ sơ (FLOW-08, BR-06, docs/02 §8.1).
 * - CAN_CONVERT: Chỉ hiển thị khi là BOARD, trạng thái ACCEPTED và chưa từng chuyển (convertedUserId == null).
 * - ALREADY_CONVERTED: Đã tạo tài khoản (convertedUserId tồn tại) -> hiện huy hiệu & liên kết sang /admin/members/[id].
 * - BOARD_ONLY: Trạng thái ACCEPTED nhưng người xem không phải BOARD -> thông báo chỉ BCN mới có quyền.
 * - HIDDEN: Các trạng thái khác (NEW, REVIEWING, INTERVIEW, REJECTED, WITHDRAWN) -> ẩn hoàn toàn.
 */
export function getConvertActionState(
  user: Me | null,
  application: { status: ApplicationStatus; convertedUserId?: string | null } | null | undefined,
): ConvertActionState {
  if (!application) {
    return 'HIDDEN'
  }
  if (application.convertedUserId) {
    return 'ALREADY_CONVERTED'
  }
  if (application.status !== 'ACCEPTED') {
    return 'HIDDEN'
  }
  if (hasRole(user, 'BOARD')) {
    return 'CAN_CONVERT'
  }
  return 'BOARD_ONLY'
}

/**
 * Kiểm tra xem có được hiển thị nút "Tạo tài khoản thành viên" hay không.
 */
export function canShowConvertButton(
  user: Me | null,
  application: { status: ApplicationStatus; convertedUserId?: string | null } | null | undefined,
): boolean {
  return getConvertActionState(user, application) === 'CAN_CONVERT'
}

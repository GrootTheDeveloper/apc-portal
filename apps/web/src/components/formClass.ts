// Kiểu ô nhập dùng chung cho mọi form (đăng nhập, mật khẩu, quản trị). Tách file riêng như buttonClass.ts.

/** Ô nhập: viền 2px màu mực, focus đổi sang viền xanh kèm quầng (tín hiệu focus duy nhất của form, DESIGN.md); lỗi viền đỏ. */
export const inputClass =
  'w-full rounded-xl bg-paper px-4 py-3 text-[17px] text-ink shadow-[inset_0_0_0_2px_#081F3D] outline-none transition-shadow focus:shadow-[inset_0_0_0_2px_#1568C9,0_0_0_4px_rgba(21,104,201,0.2)] disabled:opacity-60 aria-[invalid=true]:shadow-[inset_0_0_0_2px_#C23B22]'

/** Nhãn bọc ô nhập (chữ code nhỏ, ô nằm ngay dưới). */
export const labelClass = 'flex flex-col gap-2 font-code text-[13px] font-bold'

/** Mật khẩu ở ô đăng nhập: API nhận tới 512 đơn vị UTF-16 (128 ký tự kể cả emoji). Khớp LOGIN_PASSWORD_MAX của API. */
export const LOGIN_PASSWORD_MAX_LENGTH = 512

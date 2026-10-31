// Tách khỏi component để file component chỉ export component (react-refresh/only-export-components),
// cùng cách với buttonClass.ts. Dùng chung cho mọi form công khai (Đăng nhập, Đăng ký, Tra cứu).

// Viền 2px màu mực, focus đổi sang viền xanh kèm quầng (tín hiệu focus duy nhất của form, DESIGN.md).
export const inputClass =
  'w-full rounded-xl bg-paper px-4 py-3 text-[17px] text-ink shadow-[inset_0_0_0_2px_#081F3D] outline-none transition-shadow focus:shadow-[inset_0_0_0_2px_#1568C9,0_0_0_4px_rgba(21,104,201,0.2)] disabled:opacity-60'
export const labelClass = 'flex flex-col gap-2 font-code text-[13px] font-bold'

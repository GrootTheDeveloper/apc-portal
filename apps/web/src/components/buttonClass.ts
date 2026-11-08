// Tách khỏi Button.tsx để file đó chỉ export component (react-refresh/only-export-components).

// Nút kiểu phím bàn phím: mép dưới đậm màu, rê chuột thì nhô lên, bấm thì lún xuống mất mép.
const VARIANTS = {
  primary: 'bg-apc-red text-paper shadow-[0_5px_0_#9A2A16] hover:bg-[#cf4429] active:shadow-[0_1px_0_#9A2A16]',
  outline:
    'bg-paper text-ink shadow-[inset_0_0_0_2px_#081F3D,0_5px_0_#081F3D] hover:text-apc-red active:shadow-[inset_0_0_0_2px_#081F3D,0_1px_0_#081F3D]',
  light: 'bg-paper text-ink shadow-[0_5px_0_#B87A00] hover:text-apc-red active:shadow-[0_1px_0_#B87A00]',
} as const

export type ButtonVariant = keyof typeof VARIANTS

/** Class của nút; dùng cho <Button> và cho <Link>/<a> cần trông như nút. */
export const buttonClass = (variant: ButtonVariant = 'primary', className = '') =>
  `inline-flex min-h-12 items-center justify-center gap-2 whitespace-nowrap rounded-xl px-7 py-3 font-body text-[17px] font-extrabold leading-none transition-[transform,box-shadow,background-color,color] duration-150 hover:-translate-y-0.5 active:translate-y-1 disabled:pointer-events-none disabled:opacity-50 ${VARIANTS[variant]} ${className}`

/** Nút lọc dạng viên thuốc trên nền sáng; đang chọn thì nền xanh than. */
export const pillClass = (active: boolean) =>
  `inline-flex min-h-10 items-center rounded-full px-4 text-[15px] font-extrabold transition-colors ${
    active ? 'bg-ink text-paper' : 'bg-soft text-ink hover:bg-apc-blue-pale'
  }`

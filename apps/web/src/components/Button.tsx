import type { ButtonHTMLAttributes, ReactNode } from 'react'

const VARIANTS = {
  primary: 'bg-apc-red text-white hover:bg-[#a0220b]',
  outline: 'bg-white text-apc-blue border border-apc-blue hover:bg-surface-container-low',
  light: 'bg-white text-apc-red hover:bg-surface-container-low',
} as const

type ButtonProps = {
  variant?: keyof typeof VARIANTS
  children: ReactNode
} & ButtonHTMLAttributes<HTMLButtonElement>

/** Nút chuẩn hoá cho toàn trang: 3 biến thể, cùng padding/bo góc/hover. Focus a11y do CSS global lo. */
export function Button({ variant = 'primary', className, children, ...rest }: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 px-8 py-3 rounded-apc font-medium shadow-sm transition-colors ${VARIANTS[variant]} ${className ?? ''}`}
      {...rest}
    >
      {children}
    </button>
  )
}

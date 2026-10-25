import type { ButtonHTMLAttributes, ReactNode } from 'react'

import { buttonClass, type ButtonVariant } from './buttonClass'

type ButtonProps = {
  variant?: ButtonVariant
  children: ReactNode
} & ButtonHTMLAttributes<HTMLButtonElement>

/** Nút chuẩn hoá cho toàn trang: viên thuốc bo tròn, 3 biến thể. Focus a11y do CSS global lo. */
export function Button({ variant = 'primary', className, children, ...rest }: ButtonProps) {
  return (
    <button className={buttonClass(variant, className)} {...rest}>
      {children}
    </button>
  )
}

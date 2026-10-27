import type { HTMLAttributes } from 'react'

/**
 * Dòng comment `// ...` phía trên tiêu đề section, chữ mono đậm. Màu truyền qua className;
 * nhận thêm thuộc tính của <p> như `data-rv`, `style` (hiệu ứng hiện dần).
 */
export function Eyebrow({ children, className = '', ...rest }: HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={`font-code text-[16px] font-bold ${className}`} {...rest}>
      <span aria-hidden className="opacity-60">
        {'// '}
      </span>
      {children}
    </p>
  )
}

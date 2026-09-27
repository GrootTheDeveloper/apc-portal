import type { ReactNode } from 'react'

/** Nhãn nhỏ trên tiêu đề section, gắn vạch gradient brand làm motif chung. */
export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={`flex items-center gap-2.5 font-label-mono text-xs font-bold uppercase tracking-[0.2em] ${className ?? ''}`}>
      <span aria-hidden className="h-[2px] w-6 shrink-0 rounded-full bg-gradient-to-r from-apc-red via-apc-gold to-apc-blue" />
      {children}
    </span>
  )
}

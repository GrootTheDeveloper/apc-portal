import type { ReactNode } from 'react'

type StatusScreenProps = {
  /** mã lớn bên trái: 404, 403... */
  code: string
  title: string
  text: ReactNode
  action?: ReactNode
}

/** Màn hình trạng thái cả trang (không tìm thấy, không có quyền, đang xây): mã cỡ lớn màu đỏ cạnh lời giải thích. */
export function StatusScreen({ code, title, text, action }: StatusScreenProps) {
  return (
    <main className="flex min-h-[calc(100svh-72px)] items-center px-4 py-16 md:px-8">
      <section className="mx-auto grid w-full max-w-container-max items-center gap-6 lg:grid-cols-[auto_minmax(0,1fr)] lg:gap-16">
        <p aria-hidden className="font-display text-[clamp(120px,20vw,300px)] font-extrabold leading-[0.8] tracking-[-0.05em] text-apc-red">
          {code}
        </p>
        <div>
          <h1 className="font-display text-[clamp(36px,4.4vw,64px)] font-extrabold leading-none tracking-[-0.03em]">{title}</h1>
          <p className="mt-4 max-w-[48ch] text-[18px] leading-relaxed text-muted">{text}</p>
          {action && <div className="mt-8">{action}</div>}
        </div>
      </section>
    </main>
  )
}

/** Trang tạm cho mục menu portal/quản trị chưa có trang thật (A3). Thay bằng `page` trong src/lib/menu.ts. */
export function AreaPlaceholder({ title }: { title: string }) {
  return (
    <main>
      <h1 className="font-display text-[clamp(32px,4vw,56px)] font-extrabold leading-none tracking-[-0.03em]">{title}</h1>
      <p className="mt-4 max-w-[52ch] text-[18px] leading-relaxed text-muted">Trang này đang được xây dựng.</p>
    </main>
  )
}

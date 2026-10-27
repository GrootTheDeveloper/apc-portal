import { useAuth } from '../../../hooks/useAuth'

/** PAGE-MEM-01 tạm: lời chào. Dashboard thật làm ở việc tương ứng của mảng Thành viên. */
export function PortalHomePage() {
  const { user } = useAuth()
  return (
    <main>
      <p className="font-code text-[16px] font-bold text-muted">
        <span aria-hidden>{'// '}</span>trang thành viên
      </p>
      <h1 className="mt-3 font-display text-[clamp(32px,4vw,56px)] font-extrabold leading-none tracking-[-0.03em]">
        Xin chào, {user?.fullName}
      </h1>
      <p className="mt-4 max-w-[52ch] text-[18px] leading-relaxed text-muted">
        Chọn một mục ở menu để bắt đầu. Các trang đang được các mảng hoàn thiện dần.
      </p>
    </main>
  )
}

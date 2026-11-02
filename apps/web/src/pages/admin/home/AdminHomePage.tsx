import { useAuth } from '../../../hooks/useAuth'

/** PAGE-MGT-01 tạm: chỉ hiện lời chào; khối thông tin theo vai trò làm sau. */
export function AdminHomePage() {
  const { user } = useAuth()
  return (
    <main>
      <p className="font-code text-[16px] font-bold text-muted">
        <span aria-hidden>{'// '}</span>quản trị
      </p>
      <h1 className="mt-3 font-display text-[clamp(32px,4vw,56px)] font-extrabold leading-none tracking-[-0.03em]">
        Tổng quan quản trị
      </h1>
      <p className="mt-4 max-w-[52ch] text-[18px] leading-relaxed text-muted">
        Xin chào {user?.fullName}. Menu bên trái chỉ hiện các phân hệ thuộc vai trò của bạn.
      </p>
    </main>
  )
}

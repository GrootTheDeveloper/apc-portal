import type { AccountStatus } from '../../../lib/auth'
import { formatDateTime } from '../../../lib/format'
import { STATUS_LABEL } from './accountTypes'

const STATUS_CLASS: Record<AccountStatus, string> = {
  PENDING_ACTIVATION: 'bg-apc-gold-pale text-ink',
  ACTIVE: 'bg-apc-blue-pale text-apc-blue',
  LOCKED: 'bg-apc-red/10 text-apc-red',
  INACTIVE: 'bg-soft text-muted',
}

export function StatusBadge({ status }: { status: AccountStatus }) {
  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-[14px] font-extrabold ${STATUS_CLASS[status]}`}>
      {STATUS_LABEL[status]}
    </span>
  )
}

/** STATE-03: mật khẩu tạm chỉ hiện một lần, không gửi email; người tạo tự chuyển cho thành viên. */
export function TemporaryPasswordNotice({ username, password, expiresAt }: { username: string; password: string; expiresAt?: string }) {
  return (
    <div role="status" className="rounded-2xl bg-ink p-5 text-paper">
      <p className="font-code text-[13px] font-bold text-apc-gold-soft">
        <span aria-hidden>{'// '}</span>mật khẩu tạm — chỉ hiện một lần
      </p>
      <p className="mt-3 text-[16px]">
        Tài khoản <strong>{username}</strong>:
      </p>
      <p className="mt-2 select-all break-all font-code text-[24px] font-bold tracking-wide">{password}</p>
      <p className="mt-3 text-[15px] text-paper/80">
        Chuyển trực tiếp cho thành viên (không qua email). Mật khẩu hết hạn
        {expiresAt ? ` lúc ${formatDateTime(expiresAt)}` : ' sau 72 giờ'}; lần đăng nhập đầu phải đổi mật khẩu. Đóng trang
        này là không xem lại được.
      </p>
    </div>
  )
}

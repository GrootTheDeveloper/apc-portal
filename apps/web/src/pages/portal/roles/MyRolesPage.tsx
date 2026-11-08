import { AsyncState } from '../../../components/AsyncState'
import { useApi } from '../../../hooks/useApi'
import { formatDate } from '../../../lib/format'

type RoleItem = {
  id: string
  role: 'MEMBER' | 'DEPARTMENT_MANAGER' | 'BOARD' | 'TECH_ADMIN'
  departmentId: string | null
  department: { id: string; name: string; code: string } | null
  status: 'PENDING' | 'ACTIVE' | 'EXPIRED' | 'REVOKED'
  startsAt: string
  expiresAt: string | null
  isBaseRole: boolean
}

const ROLE_NAMES: Record<string, string> = {
  MEMBER: 'Thành viên CLB',
  DEPARTMENT_MANAGER: 'Quản lý Ban chuyên môn',
  BOARD: 'Ban Chủ nhiệm (BOARD)',
  TECH_ADMIN: 'Quản trị viên kỹ thuật (TECH_ADMIN)',
}

const ROLE_DESCRIPTIONS: Record<string, string> = {
  MEMBER: 'Vai trò nền tảng của mọi tài khoản. Có quyền xem thông tin cá nhân và tài nguyên nội bộ được phân quyền.',
  DEPARTMENT_MANAGER: 'Quản lý thành viên, tài liệu và hoạt động trong phạm vi ban chuyên môn được chỉ định.',
  BOARD: 'Toàn quyền quản trị nghiệp vụ câu lạc bộ trong nhiệm kỳ.',
  TECH_ADMIN: 'Vận hành kỹ thuật hệ thống, cấu hình và giám sát hạ tầng.',
}

const STATUS_BADGES: Record<string, { label: string; className: string }> = {
  ACTIVE: { label: 'Đang hiệu lực', className: 'bg-apc-blue-pale text-apc-blue' },
  PENDING: { label: 'Chờ kích hoạt', className: 'bg-muted/10 text-muted' },
  EXPIRED: { label: 'Đã hết hạn', className: 'bg-paper shadow-[inset_0_0_0_1px_#081F3D] text-ink' },
  REVOKED: { label: 'Đã thu hồi', className: 'bg-apc-red/10 text-apc-red' },
}

function getExpiryWarning(expiresAt: string | null, status: string): { warning: boolean; text?: string } {
  if (!expiresAt || status !== 'ACTIVE') return { warning: false }
  const expireTime = new Date(expiresAt).getTime()
  const now = Date.now()
  const msInDay = 24 * 60 * 60 * 1000
  const daysLeft = Math.ceil((expireTime - now) / msInDay)

  if (daysLeft > 0 && daysLeft <= 30) {
    return {
      warning: true,
      text: `Hết hạn sau ${daysLeft} ngày`,
    }
  }
  return { warning: false }
}

export function MyRolesPage() {
  const { data: roles, loading, error, reload } = useApi<RoleItem[]>('/portal/me/roles')

  return (
    <main>
      <div>
        <span className="font-code text-xs font-bold uppercase tracking-wider text-muted">
          Phân quyền & Phạm vi
        </span>
        <h1 className="mt-2 font-display text-[clamp(28px,3.5vw,48px)] font-extrabold leading-tight tracking-[-0.03em] text-ink">
          Vai trò & Phạm vi của tôi
        </h1>
        <p className="mt-2 text-[17px] leading-relaxed text-muted">
          Danh sách các vai trò quản lý và vai trò nền được cấp cho tài khoản của bạn theo từng nhiệm kỳ hoặc ban chuyên môn.
        </p>
      </div>

      <div className="mt-8 rounded-2xl bg-paper p-6 shadow-[inset_0_0_0_2px_#081F3D]">
        <AsyncState
          loading={loading}
          error={error}
          empty={!roles || roles.length === 0}
          emptyText="Không tìm thấy thông tin vai trò."
          onRetry={reload}
        >
          {roles && (
            <div className="grid gap-6 md:grid-cols-2">
              {roles.map((role) => {
                const statusBadge = STATUS_BADGES[role.status] ?? {
                  label: role.status,
                  className: 'bg-soft text-ink',
                }
                const expiry = getExpiryWarning(role.expiresAt, role.status)

                return (
                  <div
                    key={role.id}
                    className="flex flex-col justify-between rounded-2xl bg-paper p-6 shadow-[inset_0_0_0_2px_#081F3D]"
                  >
                    <div>
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h2 className="font-display text-xl font-bold text-ink">
                              {ROLE_NAMES[role.role] ?? role.role}
                            </h2>
                            {role.isBaseRole && (
                              <span className="rounded-full bg-soft px-2.5 py-0.5 font-code text-[11px] font-bold text-ink">
                                Vai trò nền
                              </span>
                            )}
                          </div>
                          {role.department && (
                            <p className="mt-1 font-body text-sm font-bold text-apc-blue">
                              {role.department.name} ({role.department.code})
                            </p>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`inline-flex rounded-full px-3 py-1 font-code text-xs font-bold ${statusBadge.className}`}
                          >
                            {statusBadge.label}
                          </span>
                          {expiry.warning && (
                            <span className="inline-flex rounded-full border-2 border-apc-red bg-apc-red/10 px-3 py-1 font-code text-xs font-bold text-apc-red">
                              {expiry.text}
                            </span>
                          )}
                        </div>
                      </div>

                      <p className="mt-3 text-sm text-muted">
                        {ROLE_DESCRIPTIONS[role.role] ?? 'Vai trò trong tổ chức APC.'}
                      </p>
                    </div>

                    <div className="mt-6 border-t-2 border-ink/10 pt-4 font-code text-xs text-muted">
                      <div className="flex flex-wrap justify-between gap-2">
                        <span>
                          Hiệu lực từ: <strong className="text-ink">{formatDate(role.startsAt)}</strong>
                        </span>
                        <span>
                          {role.expiresAt ? (
                            <>
                              Hết hạn: <strong className="text-ink">{formatDate(role.expiresAt)}</strong>
                            </>
                          ) : (
                            <span className="text-muted">Không thời hạn</span>
                          )}
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </AsyncState>
      </div>
    </main>
  )
}

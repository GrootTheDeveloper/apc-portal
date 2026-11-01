import { AsyncState } from '../../../components/AsyncState'
import { Eyebrow } from '../../../components/Eyebrow'
import { useApi } from '../../../hooks/useApi'
import { formatDate } from '../../../lib/format'
import { PortalNav } from '../PortalNav'

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
  ACTIVE: { label: 'Đang hiệu lực', className: 'bg-green-100 text-green-800 border-green-200' },
  PENDING: { label: 'Chờ kích hoạt', className: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
  EXPIRED: { label: 'Đã hết hạn', className: 'bg-surface-container-high text-on-surface-variant border-outline-variant' },
  REVOKED: { label: 'Đã thu hồi', className: 'bg-red-100 text-red-800 border-red-200' },
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
    <main className="mx-auto max-w-container-max px-gutter py-8">
      <PortalNav
        breadcrumbs={[
          { label: 'Trang chủ', to: '/' },
          { label: 'Portal', to: '/portal' },
          { label: 'Vai trò của tôi', to: '/portal/account/roles' },
        ]}
      />

      <div className="mb-6">
        <Eyebrow>Phân quyền & Phạm vi</Eyebrow>
        <h1 className="mt-2 text-2xl font-bold text-on-surface sm:text-3xl">Vai trò & Phạm vi của tôi</h1>
        <p className="mt-1 text-sm text-on-surface-variant">
          Danh sách các vai trò quản lý và vai trò nền được cấp cho tài khoản của bạn theo từng nhiệm kỳ hoặc ban chuyên môn.
        </p>
      </div>

      <div className="rounded-apc border border-outline-variant bg-surface-container-lowest p-6">
        <AsyncState
          loading={loading}
          error={error}
          empty={!roles || roles.length === 0}
          emptyText="Không tìm thấy thông tin vai trò."
          onRetry={reload}
        >
          {roles && (
            <div className="grid gap-4 md:grid-cols-2">
              {roles.map((role) => {
                const statusBadge = STATUS_BADGES[role.status] ?? {
                  label: role.status,
                  className: 'bg-surface-container-high text-on-surface-variant border-outline-variant',
                }
                const expiry = getExpiryWarning(role.expiresAt, role.status)

                return (
                  <div
                    key={role.id}
                    className="flex flex-col justify-between rounded-apc border border-outline-variant bg-surface p-5 transition-shadow hover:shadow-sm"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <h2 className="text-base font-bold text-on-surface">{ROLE_NAMES[role.role] ?? role.role}</h2>
                            {role.isBaseRole && (
                              <span className="rounded bg-apc-blue/10 px-2 py-0.5 text-[11px] font-medium text-apc-blue">
                                Vai trò nền
                              </span>
                            )}
                          </div>
                          {role.department && (
                            <p className="mt-1 text-xs font-medium text-apc-blue">
                              Phạm vi: {role.department.name} ({role.department.code})
                            </p>
                          )}
                        </div>
                        <span
                          className={`shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-medium ${statusBadge.className}`}
                        >
                          {statusBadge.label}
                        </span>
                      </div>

                      <p className="mt-3 text-xs text-on-surface-variant leading-relaxed">
                        {ROLE_DESCRIPTIONS[role.role] ?? 'Quyền hạn trong hệ thống.'}
                      </p>
                    </div>

                    <div className="mt-4 border-t border-outline-variant pt-3">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-on-surface-variant">
                        <span>Hiệu lực từ: {formatDate(role.startsAt)}</span>
                        <span>
                          {role.expiresAt ? `Hết hạn: ${formatDate(role.expiresAt)}` : 'Không thời hạn'}
                        </span>
                      </div>

                      {/* Nhãn cảnh báo nếu sắp hết hạn trong 30 ngày (T3 requirement) */}
                      {expiry.warning && (
                        <div
                          role="alert"
                          className="mt-3 flex items-center gap-2 rounded border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs text-amber-800"
                        >
                          <span className="material-symbols-outlined text-[16px] text-amber-600">warning</span>
                          <span className="font-medium">{expiry.text}</span>
                        </div>
                      )}
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

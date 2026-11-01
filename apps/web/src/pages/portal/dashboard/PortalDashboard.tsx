import { Link } from 'react-router-dom'

import { AsyncState } from '../../../components/AsyncState'
import { Button } from '../../../components/Button'
import { Eyebrow } from '../../../components/Eyebrow'
import { useApi } from '../../../hooks/useApi'
import { useAuth } from '../../../hooks/useAuth'
import { formatDate } from '../../../lib/format'
import { PortalNav } from '../PortalNav'

type ActivityResponse = {
  items: Array<{
    id: string
    eventTitle: string
    registeredAt: string
    attended?: boolean
    status?: string
  }>
  total: number
}

export function PortalDashboard() {
  const { user } = useAuth()

  // STATE-12: Mỗi khối gọi API riêng, lỗi khối nào hiện nút Thử lại ở khối đó, không ảnh hưởng khối khác
  const activityApi = useApi<ActivityResponse>('/portal/me/activity')

  return (
    <main className="mx-auto max-w-container-max px-gutter py-8">
      <PortalNav breadcrumbs={[{ label: 'Trang chủ', to: '/' }, { label: 'Portal', to: '/portal' }]} />

      <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <Eyebrow>Trang thành viên</Eyebrow>
          <h1 className="mt-2 text-2xl font-bold text-on-surface sm:text-3xl">
            Xin chào, {user?.fullName ?? 'Thành viên'}!
          </h1>
          <p className="mt-1 text-sm text-on-surface-variant">
            Chào mừng bạn đến với APC Portal. Quản lý hồ sơ, theo dõi hoạt động và vai trò của bạn tại đây.
          </p>
        </div>
        <div className="flex gap-3">
          <Link to="/portal/profile">
            <Button variant="outline" className="px-5 py-2.5 text-sm">
              Chỉnh sửa hồ sơ
            </Button>
          </Link>
        </div>
      </div>

      {/* Lối tắt nhanh */}
      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <Link
          to="/portal/profile"
          className="rounded-apc border border-outline-variant bg-surface-container-lowest p-5 transition-colors hover:border-apc-blue hover:shadow-sm"
        >
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-2xl text-apc-blue">badge</span>
            <div>
              <h2 className="font-semibold text-on-surface">Hồ sơ cá nhân</h2>
              <p className="text-xs text-on-surface-variant">Xem và cập nhật thông tin</p>
            </div>
          </div>
        </Link>
        <Link
          to="/portal/activity-history"
          className="rounded-apc border border-outline-variant bg-surface-container-lowest p-5 transition-colors hover:border-apc-blue hover:shadow-sm"
        >
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-2xl text-apc-blue">event_available</span>
            <div>
              <h2 className="font-semibold text-on-surface">Lịch sử hoạt động</h2>
              <p className="text-xs text-on-surface-variant">Sự kiện đã đăng ký và điểm danh</p>
            </div>
          </div>
        </Link>
        <Link
          to="/portal/account/roles"
          className="rounded-apc border border-outline-variant bg-surface-container-lowest p-5 transition-colors hover:border-apc-blue hover:shadow-sm"
        >
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-2xl text-apc-blue">verified_user</span>
            <div>
              <h2 className="font-semibold text-on-surface">Vai trò & Phạm vi</h2>
              <p className="text-xs text-on-surface-variant">Xem các quyền hạn trong CLB</p>
            </div>
          </div>
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Khối Sự kiện & Đăng ký gần đây (STATE-12: độc lập lỗi) */}
        <section
          aria-labelledby="events-heading"
          className="rounded-apc border border-outline-variant bg-surface-container-lowest p-6"
        >
          <div className="mb-4 flex items-center justify-between">
            <h2 id="events-heading" className="text-lg font-bold text-on-surface">
              Sự kiện & Đăng ký gần đây
            </h2>
            <Link to="/portal/activity-history" className="text-xs text-apc-blue hover:underline">
              Xem tất cả
            </Link>
          </div>

          <AsyncState
            loading={activityApi.loading}
            error={activityApi.error}
            empty={!activityApi.data || activityApi.data.items.length === 0}
            emptyText="Bạn chưa có đăng ký sự kiện nào gần đây."
            onRetry={activityApi.reload}
          >
            <ul className="divide-y divide-outline-variant">
              {activityApi.data?.items.map((item) => (
                <li key={item.id} className="py-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-on-surface">{item.eventTitle}</p>
                      <p className="text-xs text-on-surface-variant">
                        Đăng ký ngày: {formatDate(item.registeredAt)}
                      </p>
                    </div>
                    {item.attended !== undefined && (
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          item.attended
                            ? 'bg-green-100 text-green-800'
                            : 'bg-surface-container-high text-on-surface-variant'
                        }`}
                      >
                        {item.attended ? 'Đã điểm danh' : 'Chưa điểm danh'}
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </AsyncState>
        </section>

        {/* Khối Thông báo nội bộ (Chờ việc C5 merge, STATE-12) */}
        <section
          aria-labelledby="notices-heading"
          className="rounded-apc border border-outline-variant bg-surface-container-lowest p-6"
        >
          <div className="mb-4 flex items-center justify-between">
            <h2 id="notices-heading" className="text-lg font-bold text-on-surface">
              Thông báo mới
            </h2>
            <span className="text-xs text-on-surface-variant">Cập nhật nội bộ</span>
          </div>
          <div className="rounded-apc border border-dashed border-outline-variant p-8 text-center text-on-surface-variant">
            <span className="material-symbols-outlined text-3xl text-outline">campaign</span>
            <p className="mt-2 text-sm">Chưa có thông báo nội bộ mới.</p>
            <p className="mt-1 text-xs text-outline">Thông báo từ Ban Chủ nhiệm sẽ xuất hiện tại đây.</p>
          </div>
        </section>

        {/* Khối Tài liệu mới (Chờ việc D4 merge, STATE-12) */}
        <section
          aria-labelledby="docs-heading"
          className="rounded-apc border border-outline-variant bg-surface-container-lowest p-6 lg:col-span-2"
        >
          <div className="mb-4 flex items-center justify-between">
            <h2 id="docs-heading" className="text-lg font-bold text-on-surface">
              Tài liệu nội bộ mới
            </h2>
            <span className="text-xs text-on-surface-variant">Tài nguyên học tập & quy trình</span>
          </div>
          <div className="rounded-apc border border-dashed border-outline-variant p-8 text-center text-on-surface-variant">
            <span className="material-symbols-outlined text-3xl text-outline">folder_shared</span>
            <p className="mt-2 text-sm">Chưa có tài liệu mới được phân quyền.</p>
            <p className="mt-1 text-xs text-outline">Tài liệu chuyên môn sẽ được cấp quyền theo ban sinh hoạt.</p>
          </div>
        </section>
      </div>
    </main>
  )
}

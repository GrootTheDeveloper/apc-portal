import { useState } from 'react'
import { Link } from 'react-router-dom'

import { AsyncState } from '../../../../components/AsyncState'
import { Button } from '../../../../components/Button'
import { buttonClass } from '../../../../components/buttonClass'
import { PageHero } from '../../../../components/PageHero'
import { useApi } from '../../../../hooks/useApi'
import { api, ApiError } from '../../../../lib/api'
import type { AdminDepartment } from '../types'

export function AdminDepartmentsListPage() {
  const { data, loading, error, reload } = useApi<AdminDepartment[]>('/admin/organization/departments')

  return (
    <div className="min-h-screen bg-soft pb-16">
      <PageHero
        comment="cấu hình tổ chức"
        title="Ban chuyên môn"
        lede="Quản lý danh sách các ban, sắp xếp thứ tự hiển thị và quản lý trạng thái hoạt động."
        aside={
          <Link className={buttonClass('primary')} to="/admin/organization/departments/new">
            + Thêm ban chuyên môn
          </Link>
        }
      />

      <div className="mx-auto mt-8 max-w-container-max px-4 md:px-8">
        <AsyncState loading={loading} error={error} empty={!data || data.length === 0} onRetry={reload}>
          {data && <DepartmentsTable initialDepartments={data} reload={reload} />}
        </AsyncState>
      </div>
    </div>
  )
}

function DepartmentsTable({
  initialDepartments,
  reload,
}: {
  initialDepartments: AdminDepartment[]
  reload: () => void
}) {
  const [departments, setDepartments] = useState<AdminDepartment[]>(initialDepartments)
  const [savingOrder, setSavingOrder] = useState(false)
  const [orderMessage, setOrderMessage] = useState<string | null>(null)
  const [hasOrderChanges, setHasOrderChanges] = useState(false)

  function move(index: number, direction: 'up' | 'down') {
    const targetIndex = direction === 'up' ? index - 1 : index + 1
    if (targetIndex < 0 || targetIndex >= departments.length) return

    const updated = [...departments]
    const temp = updated[index]
    const target = updated[targetIndex]
    if (!temp || !target) return

    updated[index] = target
    updated[targetIndex] = temp

    setDepartments(updated)
    setHasOrderChanges(true)
    setOrderMessage(null)
  }

  async function handleSaveOrder() {
    setSavingOrder(true)
    setOrderMessage(null)
    try {
      await api('/admin/organization/departments/order', {
        method: 'PUT',
        body: { departmentIds: departments.map((d) => d.id) },
      })
      setHasOrderChanges(false)
      setOrderMessage('Đã lưu thứ tự hiển thị các ban.')
      reload()
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Không thể lưu thứ tự ban.'
      setOrderMessage(message)
    } finally {
      setSavingOrder(false)
    }
  }

  return (
    <div>
      {orderMessage && (
        <div className="mb-6 rounded-xl border-2 border-ink bg-apc-gold p-4 font-bold text-ink">
          {orderMessage}
        </div>
      )}

      {hasOrderChanges && (
        <div className="mb-6 flex items-center justify-between rounded-xl border-2 border-ink bg-paper p-4">
          <span className="font-bold text-ink">Thứ tự hiển thị các ban đã thay đổi.</span>
          <Button disabled={savingOrder} variant="primary" onClick={handleSaveOrder}>
            {savingOrder ? 'Đang lưu...' : 'Lưu thứ tự mới'}
          </Button>
        </div>
      )}

      <div className="overflow-x-auto rounded-2xl border-2 border-ink bg-paper shadow-none">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b-2 border-ink bg-soft font-code text-[14px] uppercase text-ink">
              <th className="px-4 py-3">Thứ tự</th>
              <th className="px-4 py-3">Tên ban</th>
              <th className="px-4 py-3">Mã ban</th>
              <th className="px-4 py-3">Đầu mối liên hệ</th>
              <th className="px-4 py-3 text-center">Thành viên hoạt động</th>
              <th className="px-4 py-3">Trạng thái</th>
              <th className="px-4 py-3 text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y-2 divide-ink/20 font-sans text-[16px]">
            {departments.map((dept, index) => {
              const isActive = dept.status === 'ACTIVE'
              return (
                <tr key={dept.id} className="hover:bg-soft/40 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button
                        aria-label="Đẩy lên"
                        className="rounded border border-ink/40 px-2 py-0.5 text-xs font-bold hover:bg-ink hover:text-paper disabled:opacity-30"
                        disabled={index === 0}
                        type="button"
                        onClick={() => move(index, 'up')}
                      >
                        ▲
                      </button>
                      <button
                        aria-label="Đẩy xuống"
                        className="rounded border border-ink/40 px-2 py-0.5 text-xs font-bold hover:bg-ink hover:text-paper disabled:opacity-30"
                        disabled={index === departments.length - 1}
                        type="button"
                        onClick={() => move(index, 'down')}
                      >
                        ▼
                      </button>
                      <span className="ml-2 font-code font-bold text-sm">{dept.order}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-bold text-ink">
                    <Link className="hover:text-apc-red hover:underline" to={`/admin/organization/departments/${dept.id}`}>
                      {dept.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 font-code text-sm text-ink/75">{dept.code}</td>
                  <td className="px-4 py-3 text-sm text-ink/85">{dept.contactPoint || '—'}</td>
                  <td className="px-4 py-3 text-center font-bold">{dept.activeMemberCount ?? 0}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2.5 py-0.5 font-code text-xs font-bold ${
                        isActive ? 'bg-apc-blue/10 text-apc-blue' : 'bg-soft text-muted'
                      }`}
                    >
                      {isActive ? 'Đang hoạt động' : 'Lưu trữ'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      className={buttonClass('outline')}
                      to={`/admin/organization/departments/${dept.id}`}
                    >
                      Chỉnh sửa
                    </Link>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

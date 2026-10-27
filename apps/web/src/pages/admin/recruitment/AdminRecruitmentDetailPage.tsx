import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { AsyncState } from '../../../components/AsyncState'
import { Button } from '../../../components/Button'
import { Eyebrow } from '../../../components/Eyebrow'
import { useApi } from '../../../hooks/useApi'
import { useAuth } from '../../../hooks/useAuth'
import { api, ApiError } from '../../../lib/api'
import { hasRole } from '../../../lib/auth'
import { formatDateTime } from '../../../lib/format'
import type { RecruitmentRound, RecruitmentRoundStatus } from '../../recruitment/types'

const STATUS_CONFIG: Record<RecruitmentRoundStatus, { label: string; color: string; desc: string }> = {
  DRAFT: {
    label: 'Bản nháp',
    color: 'bg-surface-container-high text-on-surface-variant',
    desc: 'Đợt tuyển chưa công khai, ứng viên chưa thể nhìn thấy hoặc nộp hồ sơ.',
  },
  OPEN: {
    label: 'Đang mở nhận đơn',
    color: 'bg-emerald-50 text-emerald-700 font-semibold',
    desc: 'Đợt tuyển đang công khai trên website và đang tiếp nhận hồ sơ ứng tuyển.',
  },
  CLOSED: {
    label: 'Đã đóng nhận đơn',
    color: 'bg-amber-50 text-amber-700',
    desc: 'Đã hết hạn hoặc đóng nhận đơn. Ứng viên không thể nộp thêm hồ sơ.',
  },
  ARCHIVED: {
    label: 'Đã lưu trữ',
    color: 'bg-surface-container text-on-surface-variant/60',
    desc: 'Đợt tuyển đã được lưu trữ trong lịch sử, không nhận đơn và không công khai.',
  },
}

const QUESTION_TYPE_LABELS: Record<string, string> = {
  short_text: 'Văn bản ngắn',
  long_text: 'Đoạn văn dài',
  single_choice: 'Trắc nghiệm một lựa chọn',
  multiple_choice: 'Nhiều lựa chọn (Hộp kiểm)',
}

export function AdminRecruitmentDetailPage() {
  const { id } = useParams<{ id: string }>()

  const { user } = useAuth()
  const isBoard = hasRole(user, 'BOARD')

  const { data: round, loading, error, reload } = useApi<RecruitmentRound>(
    id ? `/admin/recruitment/${id}` : null,
  )

  const [updatingStatus, setUpdatingStatus] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  async function handleStatusChange(newStatus: RecruitmentRoundStatus) {
    if (!id || !round) return

    let confirmMsg = ''
    if (newStatus === 'OPEN') {
      confirmMsg = 'Bạn có chắc chắn muốn mở đợt tuyển này? Đợt tuyển sẽ hiển thị công khai trên website.'
    } else if (newStatus === 'CLOSED') {
      confirmMsg = 'Bạn có chắc muốn đóng đợt tuyển? Ứng viên sẽ không thể gửi thêm hồ sơ.'
    } else if (newStatus === 'ARCHIVED') {
      confirmMsg = 'Bạn có chắc muốn lưu trữ đợt tuyển này vào kho lưu trữ?'
    }

    if (confirmMsg && !window.confirm(confirmMsg)) {
      return
    }

    setUpdatingStatus(true)
    setErrorMessage(null)

    try {
      await api(`/admin/recruitment/${id}/status`, {
        method: 'PATCH',
        body: { status: newStatus },
      })
      reload()
    } catch (err) {
      if (err instanceof ApiError) {
        setErrorMessage(err.message)
      } else {
        setErrorMessage('Không thể chuyển trạng thái đợt tuyển. Vui lòng thử lại.')
      }
    } finally {
      setUpdatingStatus(false)
    }
  }

  return (
    <main className="mx-auto max-w-container-max px-gutter py-10 md:py-14">
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="mb-4 flex items-center gap-2 text-sm text-on-surface-variant">
        <Link to="/admin" className="hover:text-apc-red transition-colors">Quản trị</Link>
        <span>/</span>
        <Link to="/admin/recruitment" className="hover:text-apc-red transition-colors">Tuyển thành viên</Link>
        <span>/</span>
        <span className="text-on-surface font-medium truncate max-w-xs">{round?.title ?? 'Chi tiết'}</span>
      </nav>

      <AsyncState loading={loading} error={error} empty={!round} onRetry={reload} emptyText="Không tìm thấy đợt tuyển.">
        {round && (
          <div>
            {/* Header */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 border-b border-outline-variant/60 pb-6">
              <div>
                <div className="flex items-center gap-3">
                  <Eyebrow>Chi tiết đợt tuyển</Eyebrow>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${STATUS_CONFIG[round.status].color}`}>
                    {STATUS_CONFIG[round.status].label}
                  </span>
                </div>
                <h1 className="mt-2 text-2xl md:text-3xl font-extrabold text-on-surface">{round.title}</h1>
                <p className="mt-1 text-sm text-on-surface-variant">{STATUS_CONFIG[round.status].desc}</p>
              </div>

              {/* Action buttons */}
              <div className="flex flex-wrap items-center gap-3">
                <Link to={`/admin/recruitment/${round.id}/preview`}>
                  <Button variant="outline" className="shadow-sm">
                    <span className="material-symbols-outlined text-lg">visibility</span>
                    Xem trước giao diện
                  </Button>
                </Link>

                {isBoard && (
                  <Link to={`/admin/recruitment/${round.id}/edit`}>
                    <Button variant="outline" className="shadow-sm">
                      <span className="material-symbols-outlined text-lg">edit</span>
                      Chỉnh sửa
                    </Button>
                  </Link>
                )}

                {/* Chuyển trạng thái */}
                {isBoard && round.status === 'DRAFT' && (
                  <Button
                    variant="primary"
                    disabled={updatingStatus}
                    onClick={() => handleStatusChange('OPEN')}
                    className="shadow-sm"
                  >
                    <span className="material-symbols-outlined text-lg">rocket_launch</span>
                    Mở nhận đơn
                  </Button>
                )}

                {isBoard && round.status === 'OPEN' && (
                  <Button
                    variant="outline"
                    disabled={updatingStatus}
                    onClick={() => handleStatusChange('CLOSED')}
                    className="shadow-sm"
                  >
                    <span className="material-symbols-outlined text-lg">lock</span>
                    Đóng nhận đơn
                  </Button>
                )}

                {isBoard && round.status === 'CLOSED' && (
                  <Button
                    variant="outline"
                    disabled={updatingStatus}
                    onClick={() => handleStatusChange('ARCHIVED')}
                    className="shadow-sm text-on-surface-variant"
                  >
                    <span className="material-symbols-outlined text-lg">archive</span>
                    Lưu trữ đợt tuyển
                  </Button>
                )}
              </div>
            </div>

            {errorMessage && (
              <div className="mt-6 rounded-apc bg-error-container p-4 text-sm font-medium text-on-error-container">
                {errorMessage}
              </div>
            )}

            {/* Thống kê & Tổng quan */}
            <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="rounded-apc border border-outline-variant bg-surface-container-lowest p-6 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">Thời gian nhận đơn</p>
                <p className="mt-2 text-base font-semibold text-on-surface">
                  {formatDateTime(round.opensAt)}
                </p>
                <p className="text-xs text-on-surface-variant">đến {formatDateTime(round.closesAt)}</p>
              </div>

              <div className="rounded-apc border border-outline-variant bg-surface-container-lowest p-6 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">Hồ sơ ứng tuyển</p>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-3xl font-extrabold text-apc-red">
                    {round._count?.applications ?? 0}
                  </span>
                  <span className="text-xs text-on-surface-variant">hồ sơ đã nộp</span>
                </div>
                <div className="mt-3">
                  <Link
                    to={`/admin/recruitment/${round.id}/applications`}
                    className="text-xs font-semibold text-apc-blue hover:text-apc-red inline-flex items-center gap-1"
                  >
                    Xem danh sách hồ sơ →
                  </Link>
                </div>
              </div>

              <div className="rounded-apc border border-outline-variant bg-surface-container-lowest p-6 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">Đường dẫn công khai</p>
                <p className="mt-2 text-sm font-mono text-on-surface truncate">/recruitment/{round.slug}</p>
                <p className="mt-3 text-xs text-on-surface-variant">
                  {round.status === 'OPEN' ? '🟢 Đang công khai' : '⚪ Chưa công khai'}
                </p>
              </div>
            </div>

            {/* Nội dung chi tiết */}
            <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-8">
                {/* Giới thiệu */}
                <div className="rounded-apc border border-outline-variant bg-surface-container-lowest p-6">
                  <h2 className="text-base font-bold text-on-surface">Mô tả đợt tuyển</h2>
                  <p className="mt-3 text-sm text-on-surface-variant leading-relaxed whitespace-pre-line">
                    {round.description}
                  </p>
                </div>

                {/* Đối tượng & Yêu cầu */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="rounded-apc border border-outline-variant bg-surface-container-lowest p-6">
                    <h3 className="text-sm font-bold text-on-surface flex items-center gap-2">
                      <span className="material-symbols-outlined text-apc-blue text-lg">group</span>
                      Đối tượng
                    </h3>
                    <p className="mt-2 text-sm text-on-surface-variant leading-relaxed whitespace-pre-line">
                      {round.audience}
                    </p>
                  </div>

                  <div className="rounded-apc border border-outline-variant bg-surface-container-lowest p-6">
                    <h3 className="text-sm font-bold text-on-surface flex items-center gap-2">
                      <span className="material-symbols-outlined text-apc-red text-lg">fact_check</span>
                      Yêu cầu
                    </h3>
                    <p className="mt-2 text-sm text-on-surface-variant leading-relaxed whitespace-pre-line">
                      {round.requirements}
                    </p>
                  </div>
                </div>

                {/* Câu hỏi ứng tuyển */}
                <div className="rounded-apc border border-outline-variant bg-surface-container-lowest p-6">
                  <div className="flex items-center justify-between border-b border-outline-variant pb-4">
                    <h2 className="text-base font-bold text-on-surface">
                      Bộ câu hỏi nghiệp vụ ({round.questions?.length ?? 0})
                    </h2>
                  </div>

                  {(!round.questions || round.questions.length === 0) ? (
                    <p className="py-6 text-center text-sm text-on-surface-variant italic">
                      Đợt tuyển chưa thiết lập câu hỏi nghiệp vụ riêng.
                    </p>
                  ) : (
                    <div className="mt-4 space-y-4">
                      {round.questions.map((q, idx) => (
                        <div
                          key={q.id || idx}
                          className={`rounded-apc border p-4 text-sm ${
                            q.hidden
                              ? 'border-dashed border-outline-variant bg-surface-container/50 opacity-60'
                              : 'border-outline-variant bg-surface-container-lowest'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-on-surface">Câu {idx + 1}: {q.label}</span>
                                {q.required && (
                                  <span className="rounded bg-rose-50 px-1.5 py-0.5 text-[10px] font-bold text-rose-700">
                                    Bắt buộc
                                  </span>
                                )}
                                {q.hidden && (
                                  <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-800">
                                    Đã ẩn
                                  </span>
                                )}
                              </div>
                              <p className="mt-1 text-xs text-on-surface-variant">
                                Loại câu hỏi: {QUESTION_TYPE_LABELS[q.type] || q.type}
                              </p>
                            </div>
                          </div>

                          {q.options && q.options.length > 0 && (
                            <div className="mt-3 pl-4 border-l-2 border-outline-variant/60 space-y-1">
                              {q.options.map((opt) => (
                                <p key={opt.id} className="text-xs text-on-surface-variant">
                                  • {opt.label}
                                </p>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Ban chuyên môn */}
              <div className="space-y-6">
                <div className="rounded-apc border border-outline-variant bg-surface-container-lowest p-6">
                  <h2 className="text-base font-bold text-on-surface mb-4">
                    Ban chuyên môn ({round.departments?.length ?? 0})
                  </h2>
                  {(!round.departments || round.departments.length === 0) ? (
                    <p className="text-sm text-on-surface-variant italic">
                      Chưa chọn ban chuyên môn nào.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {round.departments.map((dept) => (
                        <div key={dept.id} className="rounded-apc border border-outline-variant p-3 bg-surface-container-low">
                          <span className="inline-block rounded bg-primary-pale px-2 py-0.5 text-[11px] font-bold text-apc-red mb-1">
                            {dept.code}
                          </span>
                          <p className="text-sm font-semibold text-on-surface">{dept.name}</p>
                          {dept.description && (
                            <p className="mt-1 text-xs text-on-surface-variant line-clamp-2">{dept.description}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </AsyncState>
    </main>
  )
}
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { AsyncState } from '../../../../components/AsyncState'
import { Breadcrumb } from '../../../../components/Breadcrumb'
import { buttonClass } from '../../../../components/buttonClass'
import { ConfirmDialog, type ConfirmValues } from '../../../../components/ConfirmDialog'
import { Eyebrow } from '../../../../components/Eyebrow'
import { inputClass, labelClass } from '../../../../components/formClass'
import { useApi } from '../../../../hooks/useApi'
import { useAuth } from '../../../../hooks/useAuth'
import { api, ApiError } from '../../../../lib/api'
import { hasRole } from '../../../../lib/auth'
import { formatDateTime } from '../../../../lib/format'
import { fieldErrors } from '../../../../lib/formErrors'
import type {
  ApplicationDetail,
  ApplicationStatus,
  RecruitmentQuestion,
} from '../../../recruitment/types'
import { getConvertActionState } from './applicationConvertState'

const STATUS_CONFIG: Record<
  ApplicationStatus,
  { label: string; badgeClass: string; desc: string }
> = {
  NEW: {
    label: 'Mới nộp',
    badgeClass: 'bg-soft text-ink font-bold',
    desc: 'Hồ sơ vừa nộp, chưa được chuyển vào danh sách xét duyệt.',
  },
  REVIEWING: {
    label: 'Đang xét duyệt',
    badgeClass: 'bg-apc-gold text-ink font-bold',
    desc: 'Hồ sơ đang trong quá trình sàng lọc và đánh giá ban đầu.',
  },
  INTERVIEW: {
    label: 'Mời phỏng vấn',
    badgeClass: 'bg-apc-blue text-paper font-bold',
    desc: 'Ứng viên đã vượt qua vòng hồ sơ và được mời tham gia phỏng vấn.',
  },
  ACCEPTED: {
    label: 'Đã chấp nhận',
    badgeClass: 'bg-emerald-600 text-paper font-bold',
    desc: 'Hồ sơ trúng tuyển (kết quả cuối cùng).',
  },
  REJECTED: {
    label: 'Không chấp nhận',
    badgeClass: 'bg-apc-red text-paper font-bold',
    desc: 'Hồ sơ không trúng tuyển (kết quả cuối cùng).',
  },
  WITHDRAWN: {
    label: 'Đã rút đơn',
    badgeClass: 'bg-soft text-muted font-bold',
    desc: 'Hồ sơ đã được rút, dừng quá trình ứng tuyển.',
  },
}

const QUESTION_TYPE_LABELS: Record<string, string> = {
  short_text: 'Văn bản ngắn',
  long_text: 'Đoạn văn dài',
  single_choice: 'Trắc nghiệm một lựa chọn',
  multiple_choice: 'Nhiều lựa chọn (Hộp kiểm)',
}

export function AdminApplicationDetailPage() {
  const { id, applicationId } = useParams<{ id: string; applicationId: string }>()
  const { user } = useAuth()
  const isBoard = hasRole(user, 'BOARD')

  const { data: app, loading, error, reload } = useApi<ApplicationDetail>(
    id && applicationId ? `/admin/recruitment/${id}/applications/${applicationId}` : null,
  )
  const convertAction = getConvertActionState(user, app)

  // Trạng thái modal đổi trạng thái
  const [targetStatus, setTargetStatus] = useState<ApplicationStatus | null>(null)
  const [convertModalOpen, setConvertModalOpen] = useState(false)

  async function handleConfirmStatusChange(values: ConfirmValues) {
    if (!id || !applicationId || !app || !targetStatus) return

    await api(`/admin/recruitment/${id}/applications/${applicationId}/status`, {
      method: 'POST',
      body: {
        status: targetStatus,
        reason: values.reason || undefined,
        updatedAt: app.updatedAt,
      },
    })

    setTargetStatus(null)
    reload()
  }

  function renderAnswer(question: RecruitmentQuestion, answers: Record<string, unknown> | null) {
    if (!answers || answers[question.id] === undefined || answers[question.id] === null) {
      return <span className="text-sm italic text-muted">(Không trả lời)</span>
    }

    const val = answers[question.id]

    if (question.type === 'single_choice') {
      const selectedOption = question.options?.find((opt) => opt.id === val)
      return (
        <span className="font-semibold text-ink">
          {selectedOption ? selectedOption.label : String(val)}
        </span>
      )
    }

    if (question.type === 'multiple_choice' && Array.isArray(val)) {
      if (val.length === 0) return <span className="text-sm italic text-muted">(Không chọn)</span>
      const selectedLabels = val.map((optId) => {
        const option = question.options?.find((opt) => opt.id === optId)
        return option ? option.label : String(optId)
      })
      return (
        <ul className="list-inside list-disc space-y-1">
          {selectedLabels.map((lbl, idx) => (
            <li key={idx} className="font-semibold text-ink">
              {lbl}
            </li>
          ))}
        </ul>
      )
    }

    return <p className="whitespace-pre-line text-sm text-ink">{String(val)}</p>
  }

  return (
    <main className="mx-auto max-w-container-max px-gutter py-10 md:py-14">
      {/* Breadcrumb */}
      <Breadcrumb
        items={[
          { label: 'quản trị', to: '/admin' },
          { label: 'tuyển thành viên', to: '/admin/recruitment' },
          { label: app?.recruitmentRound.title ?? 'đợt tuyển', to: id ? `/admin/recruitment/${id}` : '/admin/recruitment' },
          { label: 'hồ sơ ứng tuyển', to: id ? `/admin/recruitment/${id}/applications` : '/admin/recruitment' },
          { label: app?.applicantName ?? 'chi tiết hồ sơ' },
        ]}
      />

      <AsyncState
        loading={loading}
        error={error}
        empty={!app}
        emptyText="Không tìm thấy thông tin hồ sơ ứng tuyển."
        onRetry={reload}
      >
        {app && (
          <div className="mt-6 space-y-10">
            {/* Header hồ sơ */}
            <div className="flex flex-col justify-between gap-6 border-b-2 border-ink pb-8 lg:flex-row lg:items-center">
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <Eyebrow className="text-apc-blue">chi tiết ứng viên</Eyebrow>
                  <span className="font-mono text-xs font-bold text-muted">
                    MÃ HỒ SƠ: {app.profileCode}
                  </span>
                </div>
                <h1 className="mt-2 font-display text-3xl font-extrabold text-ink md:text-4xl">
                  {app.applicantName}
                </h1>
                <p className="mt-1 text-sm text-muted">
                  Nộp đơn lúc {formatDateTime(app.submittedAt)} &bull; Cập nhật lúc {formatDateTime(app.updatedAt)}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-4">
                <div className="flex flex-col items-start lg:items-end">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted">
                    Trạng thái hiện tại
                  </span>
                  <span
                    className={`mt-1 inline-block rounded-full px-4 py-1.5 text-sm font-bold ${
                      STATUS_CONFIG[app.status]?.badgeClass ?? 'bg-soft text-ink'
                    }`}
                  >
                    {STATUS_CONFIG[app.status]?.label ?? app.status}
                  </span>
                </div>
              </div>
            </div>

            {/* Layout nội dung 2 cột */}
            <div className="grid grid-cols-1 gap-10 lg:grid-cols-3">
              {/* Cột trái: Thông tin ứng viên & Câu trả lời */}
              <div className="space-y-10 lg:col-span-2">
                {/* 1. Thông tin cá nhân & Học tập */}
                <div className="rounded-[20px] border-2 border-ink bg-soft p-8">
                  <h2 className="font-display text-xl font-bold text-ink">
                    1. Thông tin cá nhân & Học tập
                  </h2>
                  <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2">
                    <div>
                      <span className="font-code text-xs font-bold uppercase text-muted">Email</span>
                      <p className="mt-1 font-semibold text-ink">{app.applicantEmail}</p>
                    </div>
                    <div>
                      <span className="font-code text-xs font-bold uppercase text-muted">MSSV</span>
                      <p className="mt-1 font-mono font-bold text-ink">{app.studentId}</p>
                    </div>
                    <div>
                      <span className="font-code text-xs font-bold uppercase text-muted">Khoa / Viện</span>
                      <p className="mt-1 text-ink">{app.faculty || '—'}</p>
                    </div>
                    <div>
                      <span className="font-code text-xs font-bold uppercase text-muted">Chuyên ngành</span>
                      <p className="mt-1 text-ink">{app.major || '—'}</p>
                    </div>
                    <div>
                      <span className="font-code text-xs font-bold uppercase text-muted">Niên khóa</span>
                      <p className="mt-1 text-ink">{app.cohort || '—'}</p>
                    </div>
                    <div>
                      <span className="font-code text-xs font-bold uppercase text-muted">Ban mong muốn</span>
                      <p className="mt-1 font-bold text-apc-blue">
                        {app.desiredDepartment?.name ?? 'Chưa chọn'}
                      </p>
                    </div>
                  </div>

                  {/* Kỹ năng & Kinh nghiệm */}
                  <div className="mt-6 border-t-2 border-ink pt-6 space-y-4">
                    <div>
                      <span className="font-code text-xs font-bold uppercase text-muted">Kỹ năng sở trường</span>
                      <p className="mt-1 whitespace-pre-line text-sm text-ink">{app.skills || '—'}</p>
                    </div>
                    <div>
                      <span className="font-code text-xs font-bold uppercase text-muted">Kinh nghiệm & Dự án</span>
                      <p className="mt-1 whitespace-pre-line text-sm text-ink">{app.experience || '—'}</p>
                    </div>
                  </div>
                </div>

                {/* 2. Câu hỏi bổ sung của đợt tuyển */}
                <div className="rounded-[20px] border-2 border-ink bg-soft p-8">
                  <h2 className="font-display text-xl font-bold text-ink">
                    2. Câu hỏi bổ sung của đợt tuyển
                  </h2>
                  {app.recruitmentRound.questions && app.recruitmentRound.questions.length > 0 ? (
                    <div className="mt-6 space-y-6">
                      {app.recruitmentRound.questions.map((q, idx) => (
                        <div
                          key={q.id}
                          className="rounded-xl border-2 border-ink bg-paper p-5 transition-colors"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="font-code text-xs font-bold text-muted">
                              Câu hỏi {idx + 1} &bull; {QUESTION_TYPE_LABELS[q.type] ?? q.type}
                            </span>
                            {q.required && (
                              <span className="rounded bg-apc-red/10 px-2 py-0.5 text-[11px] font-bold text-apc-red">
                                Bắt buộc
                              </span>
                            )}
                          </div>
                          <h3 className="mt-2 text-base font-bold text-ink">{q.label}</h3>
                          <div className="mt-3 rounded-lg bg-soft/60 p-4">
                            <span className="block font-code text-xs font-bold uppercase text-muted mb-1">
                              Câu trả lời của ứng viên:
                            </span>
                            {renderAnswer(q, app.answers)}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-4 text-sm text-muted">
                      Đợt tuyển này không cấu hình câu hỏi bổ sung nào.
                    </p>
                  )}
                </div>

                {/* 3. Lịch sử thay đổi trạng thái (Timeline) */}
                <div className="rounded-[20px] border-2 border-ink bg-soft p-8">
                  <h2 className="font-display text-xl font-bold text-ink">
                    3. Lịch sử thay đổi trạng thái
                  </h2>
                  {app.statusHistories && app.statusHistories.length > 0 ? (
                    <div className="mt-6 space-y-4">
                      {app.statusHistories.map((hist) => (
                        <div
                          key={hist.id}
                          className="relative flex items-start gap-4 rounded-xl border-2 border-ink bg-paper p-4"
                        >
                          <div className="mt-1 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-apc-blue text-xs font-bold text-paper">
                            &bull;
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-xs font-bold uppercase text-muted">
                                {STATUS_CONFIG[hist.fromStatus]?.label ?? hist.fromStatus}
                              </span>
                              <span className="text-muted">&rarr;</span>
                              <span
                                className={`rounded px-2 py-0.5 text-xs font-bold ${
                                  STATUS_CONFIG[hist.toStatus]?.badgeClass ?? 'bg-soft text-ink'
                                }`}
                              >
                                {STATUS_CONFIG[hist.toStatus]?.label ?? hist.toStatus}
                              </span>
                            </div>
                            {hist.reason && (
                              <p className="mt-2 text-sm text-ink">
                                <span className="font-bold text-muted">Lý do: </span>
                                {hist.reason}
                              </p>
                            )}
                            <div className="mt-2 flex items-center gap-2 text-xs text-muted">
                              <span>Bởi: <strong className="text-ink">{hist.changedBy.fullName}</strong></span>
                              <span>&bull;</span>
                              <span>{formatDateTime(hist.changedAt)}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-4 text-sm text-muted">
                      Chưa có thay đổi trạng thái nào được ghi nhận.
                    </p>
                  )}
                </div>
              </div>

              {/* Cột phải: Ghi chú nội bộ & Thao tác chuyển trạng thái */}
              <div className="space-y-10">
                {/* Khung Hành động Chuyển trạng thái */}
                <div className="rounded-[20px] border-2 border-ink bg-paper p-6">
                  <h2 className="font-display text-lg font-bold text-ink">
                    Thao tác xét duyệt
                  </h2>
                  <p className="mt-1 text-xs text-muted">
                    {STATUS_CONFIG[app.status]?.desc}
                  </p>

                  <div className="mt-6 flex flex-col gap-3">
                    {/* Trạng thái NEW */}
                    {app.status === 'NEW' && (
                      <>
                        <button
                          type="button"
                          onClick={() => setTargetStatus('REVIEWING')}
                          className={buttonClass('primary')}
                        >
                          Đưa vào xét duyệt &rarr;
                        </button>
                        {isBoard && (
                          <button
                            type="button"
                            onClick={() => setTargetStatus('WITHDRAWN')}
                            className={buttonClass('outline')}
                          >
                            Rút đơn ứng viên
                          </button>
                        )}
                      </>
                    )}

                    {/* Trạng thái REVIEWING */}
                    {app.status === 'REVIEWING' && (
                      <>
                        <button
                          type="button"
                          onClick={() => setTargetStatus('INTERVIEW')}
                          className={buttonClass('primary')}
                        >
                          Mời phỏng vấn &rarr;
                        </button>
                        {isBoard && (
                          <>
                            <button
                              type="button"
                              onClick={() => setTargetStatus('ACCEPTED')}
                              className="rounded-xl bg-emerald-600 px-5 py-3 font-bold text-paper transition-transform active:translate-y-1 hover:bg-emerald-700"
                            >
                              Chấp nhận ứng viên
                            </button>
                            <button
                              type="button"
                              onClick={() => setTargetStatus('REJECTED')}
                              className="rounded-xl border-2 border-apc-red bg-paper px-5 py-3 font-bold text-apc-red transition-transform active:translate-y-1 hover:bg-apc-red hover:text-paper"
                            >
                              Không chấp nhận
                            </button>
                            <button
                              type="button"
                              onClick={() => setTargetStatus('WITHDRAWN')}
                              className={buttonClass('outline')}
                            >
                              Rút đơn ứng viên
                            </button>
                          </>
                        )}
                      </>
                    )}

                    {/* Trạng thái INTERVIEW */}
                    {app.status === 'INTERVIEW' && (
                      <>
                        {isBoard ? (
                          <>
                            <button
                              type="button"
                              onClick={() => setTargetStatus('ACCEPTED')}
                              className="rounded-xl bg-emerald-600 px-5 py-3 font-bold text-paper transition-transform active:translate-y-1 hover:bg-emerald-700"
                            >
                              Chốt Đã chấp nhận
                            </button>
                            <button
                              type="button"
                              onClick={() => setTargetStatus('REJECTED')}
                              className="rounded-xl border-2 border-apc-red bg-paper px-5 py-3 font-bold text-apc-red transition-transform active:translate-y-1 hover:bg-apc-red hover:text-paper"
                            >
                              Không chấp nhận
                            </button>
                            <button
                              type="button"
                              onClick={() => setTargetStatus('WITHDRAWN')}
                              className={buttonClass('outline')}
                            >
                              Rút đơn ứng viên
                            </button>
                          </>
                        ) : (
                          <div className="rounded-xl bg-soft p-4 text-xs font-semibold text-muted">
                            Hồ sơ đã được xếp lịch phỏng vấn. Chỉ Ban Chủ nhiệm mới có quyền chốt kết quả tuyển chọn.
                          </div>
                        )}
                      </>
                    )}

                    {/* Trạng thái ACCEPTED: Chuyển thành viên (R6, FLOW-08, BR-06) */}
                    {convertAction === 'ALREADY_CONVERTED' && (
                      <div className="rounded-xl border-2 border-emerald-600 bg-emerald-50 p-4">
                        <div className="flex items-center justify-between">
                          <span className="rounded-full bg-emerald-200 px-2.5 py-0.5 text-xs font-bold text-emerald-900">
                            Đã tạo tài khoản thành viên
                          </span>
                          {app.convertedAt && (
                            <span className="text-[11px] text-muted">
                              {formatDateTime(app.convertedAt)}
                            </span>
                          )}
                        </div>
                        <p className="mt-2 text-sm font-semibold text-ink">
                          Tài khoản:{' '}
                          <strong className="font-mono text-apc-blue">
                            @{app.convertedUser?.username ?? '—'}
                          </strong>
                          {app.convertedUser?.fullName && ` (${app.convertedUser.fullName})`}
                        </p>
                        <div className="mt-3">
                          <Link
                            to={`/admin/members/${app.convertedUserId}`}
                            className="inline-flex items-center gap-1 text-xs font-bold text-apc-blue hover:underline"
                          >
                            Xem trang chi tiết thành viên &rarr;
                          </Link>
                        </div>
                      </div>
                    )}

                    {convertAction === 'CAN_CONVERT' && (
                      <div className="rounded-xl border-2 border-emerald-600 bg-emerald-50 p-4">
                        <span className="rounded-full bg-emerald-200 px-2.5 py-0.5 text-xs font-bold text-emerald-900">
                          TRÚNG TUYỂN
                        </span>
                        <h3 className="mt-2 text-sm font-bold text-ink">
                          Chuyển thành viên chính thức
                        </h3>
                        <p className="mt-1 text-xs text-muted">
                          Hồ sơ đã được chấp nhận. BCN có thể tạo tài khoản thành viên và phân ban chính thức.
                        </p>
                        <button
                          type="button"
                          onClick={() => setConvertModalOpen(true)}
                          className="mt-3 w-full rounded-xl bg-emerald-600 px-4 py-2.5 font-bold text-paper transition-transform active:translate-y-1 hover:bg-emerald-700"
                        >
                          Tạo tài khoản thành viên &rarr;
                        </button>
                      </div>
                    )}

                    {convertAction === 'BOARD_ONLY' && (
                      <div className="rounded-xl bg-soft p-4 text-center">
                        <span className="font-bold text-ink">Hồ sơ đã chấp nhận</span>
                        <p className="mt-1 text-xs text-muted">
                          Hồ sơ đã trúng tuyển. Ban Chủ nhiệm sẽ tạo tài khoản thành viên chính thức.
                        </p>
                      </div>
                    )}

                    {/* Trạng thái kết thúc: REJECTED, WITHDRAWN */}
                    {['REJECTED', 'WITHDRAWN'].includes(app.status) && (
                      <div className="rounded-xl bg-soft p-4 text-center">
                        <span className="font-bold text-ink">Hồ sơ đã kết thúc</span>
                        <p className="mt-1 text-xs text-muted">
                          Hồ sơ đang ở trạng thái cuối cùng, không thể chuyển đổi trạng thái thêm nữa.
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Khung Ghi chú nội bộ & Đánh giá */}
                <InternalNoteCard
                  key={app.id + app.updatedAt}
                  app={app}
                  roundId={id!}
                  applicationId={applicationId!}
                  onReload={reload}
                />
              </div>
            </div>

            {/* Modal ConfirmDialog chuyển trạng thái */}
            {targetStatus && (
              <ConfirmDialog
                open={Boolean(targetStatus)}
                title={
                  targetStatus === 'WITHDRAWN'
                    ? 'Xác nhận rút đơn ứng viên'
                    : targetStatus === 'ACCEPTED'
                      ? 'Xác nhận Chấp nhận ứng viên'
                      : targetStatus === 'REJECTED'
                        ? 'Xác nhận Không chấp nhận ứng viên'
                        : targetStatus === 'INTERVIEW'
                          ? 'Xác nhận Mời phỏng vấn'
                          : 'Xác nhận Chuyển trạng thái'
                }
                description={
                  targetStatus === 'WITHDRAWN' ? (
                    <div>
                      <p>
                        Bạn đang rút hồ sơ của ứng viên <strong>{app.applicantName}</strong>. 
                        Sau khi rút, ứng viên sẽ nhận được email thông báo và hồ sơ sẽ bị dừng tuyển dụng.
                      </p>
                      <p className="mt-2 font-bold text-apc-red">
                        Hành động này không thể hoàn tác. Bạn bắt buộc phải cung cấp lý do rút đơn.
                      </p>
                    </div>
                  ) : targetStatus === 'ACCEPTED' ? (
                    <div>
                      <p>
                        Chấp nhận hồ sơ của <strong>{app.applicantName}</strong> vào đợt tuyển thành viên.
                      </p>
                      <p className="mt-2 text-sm text-muted">
                        Ứng viên sẽ nhận được email thông báo trúng tuyển và kết quả sẽ được ghi vào nhật ký.
                      </p>
                    </div>
                  ) : targetStatus === 'REJECTED' ? (
                    <div>
                      <p>
                        Bạn có chắc chắn chuyển hồ sơ của <strong>{app.applicantName}</strong> sang trạng thái Không chấp nhận?
                      </p>
                      <p className="mt-2 text-sm text-muted">
                        Ứng viên sẽ nhận được email thông báo kết quả.
                      </p>
                    </div>
                  ) : (
                    <p>
                      Chuyển hồ sơ của <strong>{app.applicantName}</strong> sang trạng thái{' '}
                      <strong>{STATUS_CONFIG[targetStatus]?.label ?? targetStatus}</strong>.
                    </p>
                  )
                }
                confirmLabel={
                  targetStatus === 'WITHDRAWN'
                    ? 'Rút đơn ngay'
                    : targetStatus === 'REJECTED'
                      ? 'Không chấp nhận'
                      : targetStatus === 'ACCEPTED'
                        ? 'Chấp nhận ứng viên'
                        : 'Xác nhận'
                }
                danger={targetStatus === 'WITHDRAWN' || targetStatus === 'REJECTED'}
                reason={targetStatus === 'WITHDRAWN' ? 'required' : 'optional'}
                onConfirm={handleConfirmStatusChange}
                onClose={() => setTargetStatus(null)}
                onReload={reload}
              />
            )}

            {/* Modal Chuyển hồ sơ thành thành viên (R6, FLOW-08, BR-06, STATE-03) */}
            {convertModalOpen && (
              <ConvertMemberModal
                app={app}
                roundId={id!}
                applicationId={applicationId!}
                onClose={() => setConvertModalOpen(false)}
                onSuccess={() => {
                  reload()
                }}
              />
            )}
          </div>
        )}
      </AsyncState>
    </main>
  )
}

function InternalNoteCard({
  app,
  roundId,
  applicationId,
  onReload,
}: {
  app: ApplicationDetail
  roundId: string
  applicationId: string
  onReload: () => void
}) {
  const [internalNote, setInternalNote] = useState(app.internalNote ?? '')
  const [savingNote, setSavingNote] = useState(false)
  const [noteSuccess, setNoteSuccess] = useState(false)
  const [noteError, setNoteError] = useState<string | null>(null)

  async function handleSaveNote() {
    setSavingNote(true)
    setNoteError(null)
    setNoteSuccess(false)

    try {
      await api(`/admin/recruitment/${roundId}/applications/${applicationId}/review`, {
        method: 'PATCH',
        body: {
          internalNote: internalNote.trim() || null,
          updatedAt: app.updatedAt,
        },
      })
      setNoteSuccess(true)
      onReload()
    } catch (err) {
      if (err instanceof ApiError) {
        setNoteError(err.message)
      } else {
        setNoteError('Không thể lưu ghi chú. Vui lòng thử lại.')
      }
    } finally {
      setSavingNote(false)
    }
  }

  return (
    <div className="rounded-[20px] border-2 border-ink bg-soft p-6">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-bold text-ink">Ghi chú nội bộ</h2>
        <span className="font-code text-[11px] font-bold uppercase text-apc-red">Nội bộ APC</span>
      </div>
      <p className="mt-1 text-xs text-muted">
        Ghi chú này tuyệt đối không hiển thị cho ứng viên khi tra cứu.
      </p>

      {noteSuccess && (
        <div className="mt-4 rounded-lg bg-emerald-100 p-3 text-xs font-bold text-emerald-800">
          Ghi chú đã được lưu thành công!
        </div>
      )}

      {noteError && (
        <div className="mt-4 rounded-lg bg-apc-red-pale p-3 text-xs font-bold text-apc-red">
          {noteError}
        </div>
      )}

      <div className="mt-4">
        <textarea
          rows={5}
          value={internalNote}
          onChange={(e) => setInternalNote(e.target.value)}
          placeholder="Ghi nhận xét, đánh giá phỏng vấn, điểm mạnh, điểm yếu của ứng viên..."
          className="w-full rounded-xl border-2 border-ink bg-paper p-3 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-apc-blue"
        />
      </div>

      <div className="mt-4 flex items-center justify-between">
        <div className="text-[11px] text-muted">
          {app.reviewedBy && (
            <span>
              Duyệt lần cuối: <strong>{app.reviewedBy.fullName}</strong>
              {app.reviewedAt && ` (${formatDateTime(app.reviewedAt)})`}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={handleSaveNote}
          disabled={savingNote}
          className={buttonClass('primary')}
        >
          {savingNote ? 'Đang lưu...' : 'Lưu ghi chú'}
        </button>
      </div>
    </div>
  )
}

function ConvertMemberModal({
  app,
  roundId,
  applicationId,
  onClose,
  onSuccess,
}: {
  app: ApplicationDetail
  roundId: string
  applicationId: string
  onClose: () => void
  onSuccess: () => void
}) {
  const departments = useApi<{ id: string; name: string }[]>('/admin/accounts/departments')
  const suggestion = useApi<{ suggestedUsername: string }>(
    `/admin/recruitment/${roundId}/applications/${applicationId}/suggest-username`,
  )
  const [customUsername, setCustomUsername] = useState<string | null>(null)
  const username = customUsername ?? suggestion.data?.suggestedUsername ?? ''
  const [departmentId, setDepartmentId] = useState(app.desiredDepartmentId ?? '')
  const [submitting, setSubmitting] = useState(false)
  const [copiedPassword, setCopiedPassword] = useState(false)
  const [copiedCredentials, setCopiedCredentials] = useState(false)
  const [error, setError] = useState<{
    message: string
    existingUserId?: string
    fields?: Record<string, string[]>
  } | null>(null)
  const [result, setResult] = useState<{
    alreadyConverted: boolean
    user: { id: string; username: string; fullName: string; email: string }
    temporaryPassword?: string
  } | null>(null)

  function handleResetSuggestion() {
    setCustomUsername(null)
    suggestion.reload()
  }

  function handleCloseModal() {
    // Xóa mật khẩu tạm khỏi component state, không lưu vào local storage (STATE-03)
    setResult(null)
    onClose()
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)

    try {
      const res = await api<{
        alreadyConverted: boolean
        user: { id: string; username: string; fullName: string; email: string }
        temporaryPassword?: string
      }>(`/admin/recruitment/${roundId}/applications/${applicationId}/convert`, {
        method: 'POST',
        body: {
          username: username.trim(),
          departmentId: departmentId || null,
        },
      })
      setResult(res)
    } catch (caught) {
      if (caught instanceof ApiError) {
        const existingId = (caught.data as { existingUserId?: string } | undefined)?.existingUserId
        setError({
          message: caught.message,
          existingUserId: existingId,
          fields: fieldErrors(caught),
        })
      } else {
        setError({
          message: 'Không thể tạo tài khoản thành viên. Vui lòng thử lại.',
        })
      }
    } finally {
      setSubmitting(false)
    }
  }

  async function handleCopyPassword() {
    if (!result?.temporaryPassword) return
    await navigator.clipboard.writeText(result.temporaryPassword)
    setCopiedPassword(true)
    setTimeout(() => setCopiedPassword(false), 2500)
  }

  async function handleCopyCredentials() {
    if (!result?.temporaryPassword) return
    const credentialsText = `Tên đăng nhập: ${result.user.username}\nMật khẩu tạm thời: ${result.temporaryPassword}\n(Hạn sử dụng: 72 giờ — Yêu cầu đổi mật khẩu ở lần đăng nhập đầu tiên)`
    await navigator.clipboard.writeText(credentialsText)
    setCopiedCredentials(true)
    setTimeout(() => setCopiedCredentials(false), 2500)
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-4"
    >
      <div className="relative w-full max-w-lg rounded-2xl border-2 border-ink bg-paper p-6 text-ink">
        {result ? (
          /* Màn hình kết quả */
          result.alreadyConverted ? (
            <div className="space-y-5">
              <div className="rounded-xl border-2 border-ink bg-soft p-5">
                <span className="font-code text-xs font-bold uppercase text-muted">
                  Thông báo
                </span>
                <h3 className="mt-1 font-display text-lg font-bold text-ink">
                  Hồ sơ này đã được chuyển thành viên trước đó
                </h3>
                <p className="mt-2 text-sm text-ink">
                  Tài khoản:{' '}
                  <strong className="font-mono text-apc-blue">
                    @{result.user.username}
                  </strong>{' '}
                  ({result.user.fullName})
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-3">
                <Link
                  to={`/admin/members/${result.user.id}`}
                  className={buttonClass('primary')}
                >
                  Xem trang chi tiết thành viên &rarr;
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    handleCloseModal()
                    onSuccess()
                  }}
                  className={buttonClass('outline')}
                >
                  Đóng
                </button>
              </div>
            </div>
          ) : (
            /* STATE-03: Hiện mật khẩu tạm một lần duy nhất */
            <div className="space-y-5">
              <div className="rounded-xl border-2 border-emerald-600 bg-emerald-50 p-4">
                <div className="flex items-center gap-2 text-emerald-800">
                  <span className="text-base font-bold">✓</span>
                  <h3 className="font-display text-base font-bold">
                    Tạo tài khoản thành viên thành công!
                  </h3>
                </div>
                <p className="mt-1 text-xs text-emerald-900">
                  Thành viên <strong>{result.user.fullName}</strong> (@{result.user.username}) đã được tạo ở trạng thái Chờ kích hoạt.
                </p>
              </div>

              {/* Mật khẩu tạm STATE-03 */}
              <div role="status" className="rounded-2xl border-2 border-ink bg-ink p-5 text-paper">
                <p className="font-code text-xs font-bold text-apc-gold">
                  <span aria-hidden>{'// '}</span>mật khẩu tạm — chỉ hiển thị một lần duy nhất
                </p>
                <div className="mt-2 text-xs text-paper/80">
                  Tên đăng nhập: <strong className="font-mono text-paper">@{result.user.username}</strong>
                </div>

                <div className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-paper/20 bg-paper/10 p-3">
                  <span className="select-all font-mono text-xl font-bold tracking-wider text-paper">
                    {result.temporaryPassword}
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyPassword}
                    className="rounded-lg border-2 border-paper bg-paper px-3 py-1.5 font-display text-xs font-bold text-ink transition-transform active:translate-y-0.5 hover:bg-soft"
                  >
                    {copiedPassword ? '✓ Đã chép' : 'Sao chép mật khẩu'}
                  </button>
                </div>

                <div className="mt-3">
                  <button
                    type="button"
                    onClick={handleCopyCredentials}
                    className="w-full rounded-lg border-2 border-apc-gold bg-apc-gold/20 px-3 py-2 font-display text-xs font-bold text-apc-gold transition-colors hover:bg-apc-gold/30 active:translate-y-0.5"
                  >
                    {copiedCredentials ? '✓ Đã chép thông tin đăng nhập' : 'Sao chép thông tin đăng nhập'}
                  </button>
                </div>

                <div className="mt-4 rounded-lg bg-apc-red/20 p-3 text-xs leading-relaxed text-paper">
                  <strong className="text-apc-gold">Cảnh báo bảo mật:</strong> Mật khẩu tạm thời chỉ hiển thị một lần duy nhất và hết hạn sau 72 giờ. Hãy gửi thông tin này cho thành viên qua kênh nội bộ an toàn.
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <Link
                  to={`/admin/members/${result.user.id}`}
                  className="text-xs font-bold text-apc-blue hover:underline"
                >
                  Mở trang chi tiết thành viên &rarr;
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    handleCloseModal()
                    onSuccess()
                  }}
                  className={buttonClass('primary')}
                >
                  Đã lưu thông tin & Đóng
                </button>
              </div>
            </div>
          )
        ) : (
          /* Form chuyển thành viên */
          <form onSubmit={handleSubmit} noValidate className="space-y-5">
            <div className="flex items-start justify-between border-b-2 border-ink pb-4">
              <div>
                <Eyebrow className="text-apc-blue">FLOW-08 &bull; BR-06</Eyebrow>
                <h2 className="mt-1 font-display text-2xl font-extrabold text-ink">
                  Xác nhận tạo thành viên
                </h2>
              </div>
              <button
                type="button"
                onClick={handleCloseModal}
                disabled={submitting}
                className="rounded-lg p-1 text-muted hover:text-ink"
                aria-label="Đóng"
              >
                ✕
              </button>
            </div>

            {/* Thông tin kiểm tra ứng viên */}
            <div className="rounded-xl border-2 border-ink bg-soft p-4">
              <span className="font-code text-xs font-bold uppercase text-muted">
                Thông tin kiểm tra ứng viên
              </span>
              <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-muted">Họ và tên:</span>{' '}
                  <strong className="text-ink">{app.applicantName}</strong>
                </div>
                <div>
                  <span className="text-muted">MSSV:</span>{' '}
                  <strong className="font-mono text-ink">{app.studentId}</strong>
                </div>
                <div className="col-span-2">
                  <span className="text-muted">Email:</span>{' '}
                  <strong className="text-ink">{app.applicantEmail}</strong>
                </div>
                <div className="col-span-2">
                  <span className="text-muted">Khoa / Ngành:</span>{' '}
                  <span className="text-ink">
                    {app.faculty || '—'} {app.major ? `(${app.major})` : ''}
                  </span>
                </div>
                <div className="col-span-2">
                  <span className="text-muted">Ban chuyên môn nguyện vọng:</span>{' '}
                  <strong className="text-apc-blue">
                    {app.desiredDepartment?.name ?? 'Chưa chọn'}
                  </strong>
                </div>
              </div>
            </div>

            {/* Input tên đăng nhập */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label htmlFor="convert-username" className={labelClass}>
                  Tên đăng nhập (username)
                </label>
                <button
                  type="button"
                  onClick={handleResetSuggestion}
                  disabled={suggestion.loading || submitting}
                  className="font-code text-xs font-bold text-apc-blue hover:underline"
                >
                  {suggestion.loading ? 'Đang gợi ý...' : 'Lấy lại gợi ý'}
                </button>
              </div>
              <input
                id="convert-username"
                type="text"
                value={username}
                onChange={(e) => setCustomUsername(e.target.value.toLowerCase())}
                placeholder="vd: nguyen.van.a"
                pattern="^[a-z0-9._-]+$"
                className={inputClass}
                required
                disabled={submitting}
              />
              {error?.fields?.username?.map((msg) => (
                <p key={msg} className="text-xs font-bold text-apc-red">
                  {msg}
                </p>
              ))}
              <p className="text-[11px] text-muted">
                3–50 ký tự, chữ thường không dấu, số, dấu chấm, gạch dưới, gạch ngang.
              </p>
            </div>

            {/* Select Ban chính thức */}
            <div className="space-y-1">
              <label htmlFor="convert-dept" className={labelClass}>
                Ban chuyên môn chính thức
              </label>
              <select
                id="convert-dept"
                value={departmentId}
                onChange={(e) => setDepartmentId(e.target.value)}
                className={inputClass}
                disabled={submitting || departments.loading}
              >
                <option value="">Chưa phân ban</option>
                {departments.data?.map((dept) => (
                  <option key={dept.id} value={dept.id}>
                    {dept.name}
                  </option>
                ))}
              </select>
              {error?.fields?.departmentId?.map((msg) => (
                <p key={msg} className="text-xs font-bold text-apc-red">
                  {msg}
                </p>
              ))}
              <p className="text-[11px] text-muted">
                Danh sách các ban đang hoạt động (ACTIVE).
              </p>
            </div>

            {/* Cảnh báo trùng thành viên */}
            {error && (
              <div className="rounded-xl border-2 border-apc-red bg-apc-red/10 p-4 text-xs font-bold text-apc-red">
                <p>{error.message}</p>
                {error.existingUserId && (
                  <div className="mt-2">
                    <Link
                      to={`/admin/members/${error.existingUserId}`}
                      className="inline-flex items-center gap-1 font-bold text-apc-blue underline hover:opacity-80"
                    >
                      Mở hồ sơ thành viên trùng khớp &rarr;
                    </Link>
                  </div>
                )}
              </div>
            )}

            {/* Nút hành động */}
            <div className="flex flex-wrap items-center justify-end gap-3 border-t-2 border-ink pt-4">
              <button
                type="button"
                onClick={handleCloseModal}
                disabled={submitting}
                className={buttonClass('outline')}
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={submitting || !username.trim()}
                className={buttonClass('primary')}
              >
                {submitting ? 'Đang tạo...' : 'Xác nhận tạo tài khoản'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}


import { useState } from 'react'
import { useParams } from 'react-router-dom'

import { AsyncState } from '../../../../components/AsyncState'
import { Breadcrumb } from '../../../../components/Breadcrumb'
import { buttonClass } from '../../../../components/buttonClass'
import { ConfirmDialog, type ConfirmValues } from '../../../../components/ConfirmDialog'
import { Eyebrow } from '../../../../components/Eyebrow'
import { useApi } from '../../../../hooks/useApi'
import { useAuth } from '../../../../hooks/useAuth'
import { api, ApiError } from '../../../../lib/api'
import { hasRole } from '../../../../lib/auth'
import { formatDateTime } from '../../../../lib/format'
import type {
  ApplicationDetail,
  ApplicationStatus,
  RecruitmentQuestion,
} from '../../../recruitment/types'

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

  // Trạng thái modal đổi trạng thái
  const [targetStatus, setTargetStatus] = useState<ApplicationStatus | null>(null)

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
                <div className="rounded-[20px] bg-soft p-8">
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
                <div className="rounded-[20px] bg-soft p-8">
                  <h2 className="font-display text-xl font-bold text-ink">
                    2. Câu hỏi bổ sung của đợt tuyển
                  </h2>
                  {app.recruitmentRound.questions && app.recruitmentRound.questions.length > 0 ? (
                    <div className="mt-6 space-y-6">
                      {app.recruitmentRound.questions.map((q, idx) => (
                        <div
                          key={q.id}
                          className="rounded-xl border-2 border-ink bg-paper p-5"
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
                <div className="rounded-[20px] bg-soft p-8">
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
                              <span>Bởi: <strong className="text-ink">{hist.changedBy?.fullName ?? 'Ứng viên'}</strong></span>
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

                    {/* Trạng thái cuối cùng: ACCEPTED, REJECTED, WITHDRAWN */}
                    {['ACCEPTED', 'REJECTED', 'WITHDRAWN'].includes(app.status) && (
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
    <div className="rounded-[20px] bg-soft p-6">
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


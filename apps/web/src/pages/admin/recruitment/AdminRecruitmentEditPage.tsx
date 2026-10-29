import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { AsyncState } from '../../../components/AsyncState'
import { Button } from '../../../components/Button'
import { Eyebrow } from '../../../components/Eyebrow'
import { useApi } from '../../../hooks/useApi'
import { api, ApiError } from '../../../lib/api'
import type { QuestionType, RecruitmentQuestion, RecruitmentRound } from '../../recruitment/types'

type AboutData = {
  departments: { id: string; name: string }[]
}

function toInputDateTime(isoStr?: string): string {
  if (!isoStr) return ''
  const d = new Date(isoStr)
  if (isNaN(d.getTime())) return ''
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function makeId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`
}

export function AdminRecruitmentEditPage() {
  const { id } = useParams<{ id: string }>()
  const { data: round, loading, error, reload } = useApi<RecruitmentRound>(
    id ? `/admin/recruitment/${id}` : null,
  )
  const { data: aboutData } = useApi<AboutData>('/public/about')
  const departments = aboutData?.departments ?? []

  return (
    <main className="mx-auto max-w-container-max px-gutter py-10 md:py-14">
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="mb-4 flex items-center gap-2 text-sm text-on-surface-variant">
        <Link to="/admin" className="hover:text-apc-red transition-colors">Quản trị</Link>
        <span>/</span>
        <Link to="/admin/recruitment" className="hover:text-apc-red transition-colors">Tuyển thành viên</Link>
        <span>/</span>
        <Link to={id ? `/admin/recruitment/${id}` : '/admin/recruitment'} className="hover:text-apc-red transition-colors">
          {round?.title ?? 'Chi tiết'}
        </Link>
        <span>/</span>
        <span className="text-on-surface font-medium">Chỉnh sửa</span>
      </nav>

      <AsyncState loading={loading} error={error} empty={!round} onRetry={reload} emptyText="Không tìm thấy đợt tuyển.">
        {round && <EditRoundForm round={round} departments={departments} />}
      </AsyncState>
    </main>
  )
}

function EditRoundForm({
  round,
  departments,
}: {
  round: RecruitmentRound
  departments: { id: string; name: string }[]
}) {
  const navigate = useNavigate()

  const [title, setTitle] = useState(round.title)
  const [slug, setSlug] = useState(round.slug)
  const [description, setDescription] = useState(round.description)
  const [audience, setAudience] = useState(round.audience)
  const [requirements, setRequirements] = useState(round.requirements)
  const [opensAt, setOpensAt] = useState(toInputDateTime(round.opensAt))
  const [closesAt, setClosesAt] = useState(toInputDateTime(round.closesAt))
  const [selectedDeptIds, setSelectedDeptIds] = useState<string[]>(
    round.departments?.map((d) => d.id) ?? [],
  )
  const [questions, setQuestions] = useState<RecruitmentQuestion[]>(round.questions ?? [])
  const originalQuestionIds = new Set((round.questions ?? []).map((q) => q.id))

  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const hasApplications = (round._count?.applications ?? 0) > 0

  function toggleDept(deptId: string) {
    setSelectedDeptIds((prev) =>
      prev.includes(deptId) ? prev.filter((d) => d !== deptId) : [...prev, deptId],
    )
  }

  function addQuestion(type: QuestionType) {
    const qId = makeId('q')
    const newQ: RecruitmentQuestion = {
      id: qId,
      type,
      label: '',
      required: false,
      options:
        type === 'single_choice' || type === 'multiple_choice'
          ? [{ id: makeId('opt'), label: 'Lựa chọn 1' }]
          : [],
    }
    setQuestions([...questions, newQ])
  }

  function removeQuestion(index: number) {
    const q = questions[index]
    if (hasApplications && originalQuestionIds.has(q.id)) {
      alert('Không thể xóa câu hỏi đã có hồ sơ nộp (REC-15). Bạn có thể chọn Ẩn câu hỏi.')
      return
    }
    setQuestions(questions.filter((_, i) => i !== index))
  }

  function toggleHideQuestion(index: number) {
    const q = questions[index]
    updateQuestion(index, { hidden: !q.hidden })
  }

  function updateQuestion(index: number, patch: Partial<RecruitmentQuestion>) {
    setQuestions(questions.map((q, i) => (i === index ? { ...q, ...patch } : q)))
  }

  function addOption(qIndex: number) {
    const q = questions[qIndex]
    const optId = makeId('opt')
    const newOpts = [...(q.options ?? []), { id: optId, label: `Lựa chọn ${(q.options?.length ?? 0) + 1}` }]
    updateQuestion(qIndex, { options: newOpts })
  }

  function removeOption(qIndex: number, optId: string) {
    const q = questions[qIndex]
    if (hasApplications && originalQuestionIds.has(q.id)) {
      alert('Không thể xóa lựa chọn của câu hỏi đã có hồ sơ nộp (REC-15).')
      return
    }
    const newOpts = (q.options ?? []).filter((o) => o.id !== optId)
    updateQuestion(qIndex, { options: newOpts })
  }

  function updateOptionLabel(qIndex: number, optId: string, label: string) {
    const q = questions[qIndex]
    const newOpts = (q.options ?? []).map((o) => (o.id === optId ? { ...o, label } : o))
    updateQuestion(qIndex, { options: newOpts })
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setErrorMessage(null)
    setSubmitting(true)

    try {
      const payload = {
        title: title.trim(),
        slug: slug.trim(),
        description: description.trim(),
        audience: audience.trim(),
        requirements: requirements.trim(),
        opensAt: new Date(opensAt).toISOString(),
        closesAt: new Date(closesAt).toISOString(),
        departmentIds: selectedDeptIds,
        questions,
      }

      await api(`/admin/recruitment/${round.id}`, {
        method: 'PATCH',
        body: payload,
      })

      navigate(`/admin/recruitment/${round.id}`)
    } catch (err) {
      if (err instanceof ApiError) {
        setErrorMessage(err.message)
      } else {
        setErrorMessage('Không thể cập nhật đợt tuyển. Vui lòng kiểm tra lại thông tin.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <div className="border-b border-outline-variant/60 pb-6">
        <Eyebrow>Chỉnh sửa đợt tuyển</Eyebrow>
        <h1 className="mt-2 text-2xl md:text-3xl font-extrabold text-on-surface">{round.title}</h1>
      </div>

      {hasApplications && (
        <div className="mt-6 rounded-apc border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <div className="flex items-center gap-2 font-bold text-amber-800">
            <span className="material-symbols-outlined text-lg">warning</span>
            Lưu ý về quy tắc dữ liệu (REC-15)
          </div>
          <p className="mt-1">
            Đợt tuyển này đã có <strong>{round._count?.applications}</strong> hồ sơ nộp. Hệ thống khóa các thao tác: không thể xóa câu hỏi cũ, không thể đổi kiểu câu hỏi và không thể xóa lựa chọn đã có. Bạn có thể ẩn câu hỏi, sửa nhãn câu hỏi hoặc thêm câu hỏi mới.
          </p>
        </div>
      )}

      {errorMessage && (
        <div className="mt-6 rounded-apc bg-error-container p-4 text-sm font-medium text-on-error-container">
          {errorMessage}
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-8 space-y-8">
        {/* Thông tin chung */}
        <div className="rounded-apc border border-outline-variant bg-surface-container-lowest p-6 shadow-sm space-y-6">
          <h2 className="text-lg font-bold text-on-surface">Thông tin chung</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-semibold text-on-surface mb-1">
                Tên đợt tuyển <span className="text-apc-red">*</span>
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded-apc border border-outline-variant bg-surface-container-low px-4 py-2.5 text-sm text-on-surface focus:border-apc-red focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-on-surface mb-1">
                Đường dẫn (Slug) <span className="text-apc-red">*</span>
              </label>
              <input
                type="text"
                required
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                className="w-full rounded-apc border border-outline-variant bg-surface-container-low px-4 py-2.5 text-sm font-mono text-on-surface focus:border-apc-red focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-on-surface mb-1">
              Mô tả tổng quan <span className="text-apc-red">*</span>
            </label>
            <textarea
              required
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-apc border border-outline-variant bg-surface-container-low px-4 py-2.5 text-sm text-on-surface focus:border-apc-red focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-semibold text-on-surface mb-1">
                Đối tượng tuyển chọn <span className="text-apc-red">*</span>
              </label>
              <textarea
                required
                rows={3}
                value={audience}
                onChange={(e) => setAudience(e.target.value)}
                className="w-full rounded-apc border border-outline-variant bg-surface-container-low px-4 py-2.5 text-sm text-on-surface focus:border-apc-red focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-on-surface mb-1">
                Yêu cầu & Điều kiện <span className="text-apc-red">*</span>
              </label>
              <textarea
                required
                rows={3}
                value={requirements}
                onChange={(e) => setRequirements(e.target.value)}
                className="w-full rounded-apc border border-outline-variant bg-surface-container-low px-4 py-2.5 text-sm text-on-surface focus:border-apc-red focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-semibold text-on-surface mb-1">
                Thời gian mở nhận đơn <span className="text-apc-red">*</span>
              </label>
              <input
                type="datetime-local"
                required
                value={opensAt}
                onChange={(e) => setOpensAt(e.target.value)}
                className="w-full rounded-apc border border-outline-variant bg-surface-container-low px-4 py-2.5 text-sm text-on-surface focus:border-apc-red focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-on-surface mb-1">
                Thời gian kết thúc nhận đơn <span className="text-apc-red">*</span>
              </label>
              <input
                type="datetime-local"
                required
                value={closesAt}
                onChange={(e) => setClosesAt(e.target.value)}
                className="w-full rounded-apc border border-outline-variant bg-surface-container-low px-4 py-2.5 text-sm text-on-surface focus:border-apc-red focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Chọn ban chuyên môn */}
        <div className="rounded-apc border border-outline-variant bg-surface-container-lowest p-6 shadow-sm">
          <h2 className="text-lg font-bold text-on-surface mb-4">Các ban chuyên môn tuyển đợt này</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {departments.map((dept) => {
              const checked = selectedDeptIds.includes(dept.id)
              return (
                <label
                  key={dept.id}
                  className={`flex items-center gap-3 p-3 rounded-apc border cursor-pointer transition-colors ${
                    checked
                      ? 'border-apc-red bg-primary-pale/30 text-on-surface font-semibold'
                      : 'border-outline-variant bg-surface-container-low hover:bg-surface-container text-on-surface-variant'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleDept(dept.id)}
                    className="accent-apc-red h-4 w-4"
                  />
                  <span className="text-sm">{dept.name}</span>
                </label>
              )
            })}
          </div>
        </div>

        {/* Thiết kế câu hỏi nghiệp vụ */}
        <div className="rounded-apc border border-outline-variant bg-surface-container-lowest p-6 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-outline-variant pb-4">
            <div>
              <h2 className="text-lg font-bold text-on-surface">Câu hỏi nghiệp vụ ứng tuyển</h2>
              <p className="text-xs text-on-surface-variant mt-1">
                Đã thêm {questions.length} câu hỏi
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" variant="outline" className="text-xs px-3 py-1.5" onClick={() => addQuestion('short_text')}>
                + Văn bản ngắn
              </Button>
              <Button type="button" variant="outline" className="text-xs px-3 py-1.5" onClick={() => addQuestion('long_text')}>
                + Đoạn văn dài
              </Button>
              <Button type="button" variant="outline" className="text-xs px-3 py-1.5" onClick={() => addQuestion('single_choice')}>
                + Một lựa chọn
              </Button>
              <Button type="button" variant="outline" className="text-xs px-3 py-1.5" onClick={() => addQuestion('multiple_choice')}>
                + Nhiều lựa chọn
              </Button>
            </div>
          </div>

          {questions.length === 0 ? (
            <div className="py-8 text-center text-sm text-on-surface-variant">
              Chưa có câu hỏi nào. Nhấn các nút trên để thêm câu hỏi nghiệp vụ.
            </div>
          ) : (
            <div className="space-y-6">
              {questions.map((q, qIndex) => {
                const isExistingQuestion = hasApplications && originalQuestionIds.has(q.id)

                return (
                  <div
                    key={q.id || qIndex}
                    className={`rounded-apc border p-5 transition-all ${
                      q.hidden
                        ? 'border-dashed border-outline-variant bg-surface-container/50 opacity-60'
                        : 'border-outline-variant bg-surface-container-low'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-4 mb-3">
                      <span className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                        Câu {qIndex + 1}
                      </span>

                      <div className="flex items-center gap-3">
                        {isExistingQuestion ? (
                          <button
                            type="button"
                            onClick={() => toggleHideQuestion(qIndex)}
                            className={`text-xs font-medium px-2.5 py-1 rounded ${
                              q.hidden ? 'bg-amber-100 text-amber-800' : 'bg-surface-container-high text-on-surface'
                            }`}
                          >
                            {q.hidden ? 'Bỏ ẩn' : 'Ẩn câu hỏi'}
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => removeQuestion(qIndex)}
                            className="text-xs font-semibold text-rose-600 hover:underline"
                          >
                            Xóa câu hỏi
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                      <div className="md:col-span-2">
                        <label className="block text-xs font-semibold text-on-surface mb-1">
                          Nội dung câu hỏi <span className="text-apc-red">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={q.label}
                          onChange={(e) => updateQuestion(qIndex, { label: e.target.value })}
                          placeholder="Nhập nội dung câu hỏi..."
                          className="w-full rounded border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm text-on-surface focus:border-apc-red focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-on-surface mb-1">Loại câu hỏi</label>
                        <select
                          disabled={isExistingQuestion}
                          value={q.type}
                          onChange={(e) => updateQuestion(qIndex, { type: e.target.value as QuestionType })}
                          className="w-full rounded border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm text-on-surface focus:border-apc-red focus:outline-none disabled:opacity-60"
                        >
                          <option value="short_text">Văn bản ngắn</option>
                          <option value="long_text">Đoạn văn dài</option>
                          <option value="single_choice">Một lựa chọn</option>
                          <option value="multiple_choice">Nhiều lựa chọn</option>
                        </select>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 mb-3">
                      <input
                        type="checkbox"
                        id={`required_${qIndex}`}
                        checked={q.required ?? false}
                        onChange={(e) => updateQuestion(qIndex, { required: e.target.checked })}
                        className="accent-apc-red h-4 w-4"
                      />
                      <label htmlFor={`required_${qIndex}`} className="text-xs font-medium text-on-surface cursor-pointer">
                        Bắt buộc ứng viên trả lời
                      </label>
                    </div>

                    {/* Các lựa chọn cho trắc nghiệm */}
                    {(q.type === 'single_choice' || q.type === 'multiple_choice') && (
                      <div className="mt-3 pl-4 border-l-2 border-outline-variant space-y-2">
                        <p className="text-xs font-semibold text-on-surface-variant">Danh sách lựa chọn:</p>
                        {(q.options ?? []).map((opt) => (
                          <div key={opt.id} className="flex items-center gap-2">
                            <input
                              type="text"
                              required
                              value={opt.label}
                              onChange={(e) => updateOptionLabel(qIndex, opt.id, e.target.value)}
                              className="flex-1 rounded border border-outline-variant bg-surface-container-lowest px-3 py-1.5 text-xs text-on-surface focus:border-apc-red focus:outline-none"
                            />
                            {(!isExistingQuestion || !originalQuestionIds.has(q.id)) && (
                              <button
                                type="button"
                                onClick={() => removeOption(qIndex, opt.id)}
                                className="text-xs text-on-surface-variant hover:text-rose-600 px-2"
                              >
                                ✕
                              </button>
                            )}
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={() => addOption(qIndex)}
                          className="text-xs font-semibold text-apc-blue hover:underline mt-1"
                        >
                          + Thêm lựa chọn
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Nút submit */}
        <div className="flex items-center justify-end gap-3">
          <Link to={`/admin/recruitment/${round.id}`}>
            <Button type="button" variant="outline">Hủy bỏ</Button>
          </Link>
          <Button type="submit" variant="primary" disabled={submitting}>
            {submitting ? 'Đang lưu...' : 'Lưu thay đổi'}
          </Button>
        </div>
      </form>
    </>
  )
}

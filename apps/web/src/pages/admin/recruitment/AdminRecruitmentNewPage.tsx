import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '../../../components/Button'
import { Eyebrow } from '../../../components/Eyebrow'
import { useApi } from '../../../hooks/useApi'
import { api, ApiError } from '../../../lib/api'
import type { QuestionType, RecruitmentQuestion } from '../../recruitment/types'

type AboutData = {
  departments: { id: string; name: string }[]
}

export function AdminRecruitmentNewPage() {
  const navigate = useNavigate()
  const { data: aboutData } = useApi<AboutData>('/public/about')
  const departments = aboutData?.departments ?? []

  const [title, setTitle] = useState('')
  const [slug, setSlug] = useState('')
  const [description, setDescription] = useState('')
  const [audience, setAudience] = useState('')
  const [requirements, setRequirements] = useState('')
  const [opensAt, setOpensAt] = useState('')
  const [closesAt, setClosesAt] = useState('')
  const [selectedDeptIds, setSelectedDeptIds] = useState<string[]>([])
  const [questions, setQuestions] = useState<RecruitmentQuestion[]>([])

  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Tự động sinh slug từ tiêu đề
  function handleTitleChange(val: string) {
    setTitle(val)
    const autoSlug = val
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[đĐ]/g, 'd')
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-')
    setSlug(autoSlug)
  }

  function toggleDept(id: string) {
    setSelectedDeptIds((prev) =>
      prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id],
    )
  }

  // Thêm câu hỏi
  function addQuestion(type: QuestionType) {
    const qId = `q_${Date.now()}`
    const newQ: RecruitmentQuestion = {
      id: qId,
      type,
      label: '',
      required: false,
      options: type === 'single_choice' || type === 'multiple_choice'
        ? [{ id: `opt_${Date.now()}_1`, label: 'Lựa chọn 1' }]
        : [],
    }
    setQuestions([...questions, newQ])
  }

  function removeQuestion(index: number) {
    setQuestions(questions.filter((_, i) => i !== index))
  }

  function updateQuestion(index: number, patch: Partial<RecruitmentQuestion>) {
    setQuestions(questions.map((q, i) => (i === index ? { ...q, ...patch } : q)))
  }

  function addOption(qIndex: number) {
    const q = questions[qIndex]
    const optId = `opt_${Date.now()}`
    const newOpts = [...(q.options ?? []), { id: optId, label: `Lựa chọn ${(q.options?.length ?? 0) + 1}` }]
    updateQuestion(qIndex, { options: newOpts })
  }

  function removeOption(qIndex: number, optId: string) {
    const q = questions[qIndex]
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

      const res = await api<{ id: string }>('/admin/recruitment', {
        method: 'POST',
        body: payload,
      })
      navigate(`/admin/recruitment/${res.id}`)
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setErrorMessage(err.message)
      } else {
        setErrorMessage('Đã có lỗi xảy ra. Vui lòng thử lại.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="mx-auto max-w-4xl px-gutter py-10 md:py-14">
      <nav aria-label="Breadcrumb" className="mb-4 flex items-center gap-2 text-sm text-on-surface-variant">
        <Link to="/admin" className="hover:text-apc-red transition-colors">Quản trị</Link>
        <span>/</span>
        <Link to="/admin/recruitment" className="hover:text-apc-red transition-colors">Tuyển thành viên</Link>
        <span>/</span>
        <span className="text-on-surface font-medium">Tạo đợt tuyển mới</span>
      </nav>

      <Eyebrow>Ban Chủ nhiệm</Eyebrow>
      <h1 className="mt-2 text-3xl font-extrabold text-on-surface">Tạo đợt tuyển thành viên mới</h1>

      {errorMessage && (
        <div className="mt-6 rounded-apc bg-red-50 border border-red-200 p-4 text-sm font-medium text-red-700">
          {errorMessage}
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-8 space-y-8">
        {/* Thông tin cơ bản */}
        <section className="rounded-apc border border-outline-variant bg-surface-container-lowest p-6 space-y-5">
          <h2 className="text-lg font-bold text-on-surface">1. Thông tin chung</h2>

          <div>
            <label className="block text-xs font-semibold uppercase text-on-surface-variant mb-1">
              Tiêu đề đợt tuyển *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => handleTitleChange(e.target.value)}
              placeholder="VD: Tuyển thành viên Gen 5 - Khơi nguồn sáng tạo"
              className="w-full rounded-apc border border-outline-variant px-4 py-2.5 text-sm outline-none focus:border-apc-blue"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-on-surface-variant mb-1">
              Slug đường dẫn *
            </label>
            <input
              type="text"
              required
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="VD: tuyen-thanh-vien-gen-5"
              className="w-full rounded-apc border border-outline-variant px-4 py-2.5 text-sm outline-none focus:border-apc-blue"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-on-surface-variant mb-1">
              Mô tả ngắn *
            </label>
            <textarea
              required
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Giới thiệu mục tiêu của đợt tuyển..."
              className="w-full rounded-apc border border-outline-variant px-4 py-2.5 text-sm outline-none focus:border-apc-blue"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase text-on-surface-variant mb-1">
                Đối tượng tuyển chọn *
              </label>
              <textarea
                required
                rows={2}
                value={audience}
                onChange={(e) => setAudience(e.target.value)}
                placeholder="VD: Sinh viên trường UMT khóa 2024 - 2026..."
                className="w-full rounded-apc border border-outline-variant px-4 py-2.5 text-sm outline-none focus:border-apc-blue"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase text-on-surface-variant mb-1">
                Yêu cầu & Điều kiện *
              </label>
              <textarea
                required
                rows={2}
                value={requirements}
                onChange={(e) => setRequirements(e.target.value)}
                placeholder="VD: Đam mê lập trình, cam kết tham gia sinh hoạt..."
                className="w-full rounded-apc border border-outline-variant px-4 py-2.5 text-sm outline-none focus:border-apc-blue"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase text-on-surface-variant mb-1">
                Thời gian mở nhận đơn *
              </label>
              <input
                type="datetime-local"
                required
                value={opensAt}
                onChange={(e) => setOpensAt(e.target.value)}
                className="w-full rounded-apc border border-outline-variant px-4 py-2.5 text-sm outline-none focus:border-apc-blue"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase text-on-surface-variant mb-1">
                Thời gian đóng nhận đơn *
              </label>
              <input
                type="datetime-local"
                required
                value={closesAt}
                onChange={(e) => setClosesAt(e.target.value)}
                className="w-full rounded-apc border border-outline-variant px-4 py-2.5 text-sm outline-none focus:border-apc-blue"
              />
            </div>
          </div>
        </section>

        {/* Các ban tuyển */}
        <section className="rounded-apc border border-outline-variant bg-surface-container-lowest p-6">
          <h2 className="text-lg font-bold text-on-surface">2. Ban chuyên môn tuyển đợt này *</h2>
          <p className="mt-1 text-xs text-on-surface-variant">Chọn ít nhất một ban chuyên môn mở nhận đơn.</p>

          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
            {departments.map((dept) => (
              <label
                key={dept.id}
                className={`flex items-center gap-3 p-3 rounded-apc border cursor-pointer transition-colors ${
                  selectedDeptIds.includes(dept.id)
                    ? 'border-apc-blue bg-blue-50/40 text-apc-blue font-semibold'
                    : 'border-outline-variant hover:bg-surface-container-low text-on-surface'
                }`}
              >
                <input
                  type="checkbox"
                  checked={selectedDeptIds.includes(dept.id)}
                  onChange={() => toggleDept(dept.id)}
                  className="rounded text-apc-blue focus:ring-apc-blue"
                />
                <span className="text-sm">{dept.name}</span>
              </label>
            ))}
          </div>
        </section>

        {/* Cấu hình câu hỏi bổ sung */}
        <section className="rounded-apc border border-outline-variant bg-surface-container-lowest p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-lg font-bold text-on-surface">3. Câu hỏi bổ sung của biểu mẫu</h2>
              <p className="text-xs text-on-surface-variant">Cấu hình các câu hỏi ứng viên phải trả lời khi nộp đơn.</p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" className="text-xs px-3 py-1.5" onClick={() => addQuestion('short_text')}>
                + Đoạn ngắn
              </Button>
              <Button type="button" variant="outline" className="text-xs px-3 py-1.5" onClick={() => addQuestion('long_text')}>
                + Đoạn dài
              </Button>
              <Button type="button" variant="outline" className="text-xs px-3 py-1.5" onClick={() => addQuestion('single_choice')}>
                + 1 Lựa chọn
              </Button>
              <Button type="button" variant="outline" className="text-xs px-3 py-1.5" onClick={() => addQuestion('multiple_choice')}>
                + Nhiều lựa chọn
              </Button>
            </div>
          </div>

          {questions.length === 0 ? (
            <div className="py-8 text-center text-xs text-on-surface-variant border border-dashed rounded-apc border-outline-variant">
              Chưa có câu hỏi bổ sung nào. Hãy bấm các nút trên để thêm câu hỏi nếu cần.
            </div>
          ) : (
            <div className="space-y-4 pt-2">
              {questions.map((q, qIndex) => (
                <div key={q.id} className="rounded-apc border border-outline-variant bg-surface-container p-4 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs font-bold uppercase text-apc-blue">
                      Câu {qIndex + 1}: {q.type}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeQuestion(qIndex)}
                      className="text-xs text-red-600 hover:underline font-semibold"
                    >
                      Xóa câu hỏi
                    </button>
                  </div>

                  <input
                    type="text"
                    required
                    value={q.label}
                    onChange={(e) => updateQuestion(qIndex, { label: e.target.value })}
                    placeholder="Nhập nội dung câu hỏi..."
                    className="w-full rounded border border-outline-variant px-3 py-2 text-sm bg-surface-container-lowest outline-none focus:border-apc-blue"
                  />

                  <div className="flex items-center gap-4 text-xs">
                    <label className="flex items-center gap-1.5 cursor-pointer font-medium">
                      <input
                        type="checkbox"
                        checked={q.required}
                        onChange={(e) => updateQuestion(qIndex, { required: e.target.checked })}
                      />
                      Bắt buộc trả lời
                    </label>
                  </div>

                  {/* Lựa chọn cho trắc nghiệm */}
                  {(q.type === 'single_choice' || q.type === 'multiple_choice') && (
                    <div className="pl-4 border-l-2 border-outline-variant space-y-2 pt-1">
                      <p className="text-xs font-semibold text-on-surface-variant">Các lựa chọn:</p>
                      {q.options?.map((opt) => (
                        <div key={opt.id} className="flex items-center gap-2">
                          <input
                            type="text"
                            required
                            value={opt.label}
                            onChange={(e) => updateOptionLabel(qIndex, opt.id, e.target.value)}
                            className="w-full max-w-sm rounded border border-outline-variant px-2.5 py-1 text-xs bg-surface-container-lowest outline-none focus:border-apc-blue"
                          />
                          {(q.options?.length ?? 0) > 1 && (
                            <button
                              type="button"
                              onClick={() => removeOption(qIndex, opt.id)}
                              className="text-xs text-red-500 hover:text-red-700"
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => addOption(qIndex)}
                        className="text-xs text-apc-blue hover:underline font-medium pt-1"
                      >
                        + Thêm lựa chọn
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Nút hành động */}
        <div className="flex items-center justify-end gap-3 pt-4">
          <Link to="/admin/recruitment">
            <Button type="button" variant="outline">
              Hủy bỏ
            </Button>
          </Link>
          <Button type="submit" variant="primary" disabled={submitting}>
            {submitting ? 'Đang lưu…' : 'Lưu bản nháp'}
          </Button>
        </div>
      </form>
    </main>
  )
}
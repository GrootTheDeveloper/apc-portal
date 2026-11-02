import { useId, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { AsyncState } from '../../../components/AsyncState'
import { Breadcrumb } from '../../../components/Breadcrumb'
import { Button } from '../../../components/Button'
import { buttonClass } from '../../../components/buttonClass'
import { Eyebrow } from '../../../components/Eyebrow'
import { PageHero } from '../../../components/PageHero'
import { useApi } from '../../../hooks/useApi'
import { api, ApiError } from '../../../lib/api'
import { roundPhase } from '../roundPhase'
import { Seo } from '../../../components/Seo'
import type { RecruitmentQuestion, RecruitmentRound } from '../types'

export function RecruitmentApplyPage() {
  const { slug } = useParams<{ slug: string }>()
  const { data: round, loading, error, reload } = useApi<RecruitmentRound>(
    slug ? `/public/recruitment-rounds/${slug}` : null,
  )

   return (
    <>
      <Seo
        title={round ? `Nộp đơn: ${round.title}` : 'Nộp đơn ứng tuyển'}
        path={slug ? `/recruitment/${slug}/apply` : '/recruitment'}
        robots="noindex, nofollow"
      />
      <AsyncState loading={loading} error={error} empty={false} onRetry={reload}>
        {round && <RecruitmentApplyWizard round={round} />}
      </AsyncState>
    </>
  )
}

function RecruitmentApplyWizard({ round }: { round: RecruitmentRound }) {
  const phase = roundPhase(round)
  const isClosed = phase !== 'open'

  // Chống gửi trùng lặp (FLOW-04, STATE-01)
  const [idempotencyKey] = useState(() => crypto.randomUUID())

  // Trạng thái wizard: 1, 2, 3, 4 hoặc 'success'
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1)
  const [submitting, setSubmitting] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [createdProfileCode, setCreatedProfileCode] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  // Dữ liệu form
  const [applicantName, setApplicantName] = useState('')
  const [applicantEmail, setApplicantEmail] = useState('')
  const [studentId, setStudentId] = useState('')
  const [faculty, setFaculty] = useState('')
  const [major, setMajor] = useState('')
  const [cohort, setCohort] = useState('')

  const [desiredDepartmentId, setDesiredDepartmentId] = useState(round.departments[0]?.id ?? '')
  const [skills, setSkills] = useState('')
  const [experience, setExperience] = useState('')

  // Câu hỏi bổ sung (chỉ lấy các câu không bị ẩn)
  const visibleQuestions = round.questions?.filter((q) => !q.hidden) ?? []
  const [answers, setAnswers] = useState<Record<string, unknown>>({})

  // Đồng ý điều khoản
  const [consent, setConsent] = useState(false)

  // Kiểm tra hợp lệ bước 1 trước khi sang bước 2
  function handleNextStep1(e: FormEvent) {
    e.preventDefault()
    const errs: Record<string, string> = {}
    if (!applicantName.trim()) errs.applicantName = 'Vui lòng nhập họ và tên'
    if (!applicantEmail.trim() || !applicantEmail.includes('@')) errs.applicantEmail = 'Email không hợp lệ'
    if (!studentId.trim()) errs.studentId = 'Vui lòng nhập MSSV'
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs)
      return
    }
    setFieldErrors({})
    setStep(2)
  }

  // Kiểm tra hợp lệ bước 2 trước khi sang bước 3
  function handleNextStep2(e: FormEvent) {
    e.preventDefault()
    if (!desiredDepartmentId) {
      setFieldErrors({ desiredDepartmentId: 'Vui lòng chọn một ban bạn muốn gia nhập' })
      return
    }
    setFieldErrors({})
    if (visibleQuestions.length > 0) {
      setStep(3)
    } else {
      setStep(4)
    }
  }

  // Kiểm tra hợp lệ bước 3 trước khi sang bước 4
  function handleNextStep3(e: FormEvent) {
    e.preventDefault()
    const errs: Record<string, string> = {}
    for (const q of visibleQuestions) {
      if (q.required) {
        const val = answers[q.id]
        if (!val || (Array.isArray(val) && val.length === 0) || (typeof val === 'string' && !val.trim())) {
          errs[`answers.${q.id}`] = 'Câu hỏi này là bắt buộc'
        }
      }
    }
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs)
      return
    }
    setFieldErrors({})
    setStep(4)
  }

  // Gửi hồ sơ ứng tuyển
  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setServerError(null)
    setFieldErrors({})

    if (!consent) {
      setFieldErrors({ consent: 'Bạn cần đồng ý với chính sách xử lý dữ liệu trước khi nộp' })
      return
    }

    setSubmitting(true)
    try {
      const result = await api<{ profileCode: string }>(
        `/public/recruitment-rounds/${round.slug}/applications`,
        {
          method: 'POST',
          headers: {
            'idempotency-key': idempotencyKey,
          },
          body: {
            applicantName,
            applicantEmail,
            studentId,
            faculty: faculty || undefined,
            major: major || undefined,
            cohort: cohort || undefined,
            desiredDepartmentId: desiredDepartmentId || undefined,
            skills: skills || undefined,
            experience: experience || undefined,
            answers,
            consent,
          },
        },
      )
      setCreatedProfileCode(result.profileCode)
      
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 422 && Array.isArray(err.issues)) {
          const mapped: Record<string, string> = {}
          for (const item of err.issues as Array<{ path: (string | number)[]; message: string }>) {
            const key = item.path.join('.')
            mapped[key] = item.message
          }
          setFieldErrors(mapped)
          setServerError('Vui lòng kiểm tra lại các trường thông tin có dấu đỏ.')
          // Tự động chuyển về bước đầu tiên có lỗi để người dùng sửa ô đó
          const step1Keys = ['applicantName', 'applicantEmail', 'studentId', 'faculty', 'major', 'cohort']
          const step2Keys = ['desiredDepartmentId', 'skills', 'experience']
          const errorKeys = Object.keys(mapped)
          if (errorKeys.some((k) => step1Keys.includes(k))) {
            setStep(1)
          } else if (errorKeys.some((k) => step2Keys.includes(k))) {
            setStep(2)
          } else if (errorKeys.some((k) => k.startsWith('answers'))) {
            setStep(3)
          } else if (errorKeys.some((k) => k === 'consent')) {
            setStep(4)
          }
          window.scrollTo({ top: 0, behavior: 'smooth' })
        } else {
          setServerError(err.message)
        }
      } else {
        setServerError('Đã có lỗi xảy ra khi nộp đơn. Vui lòng thử lại.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  function handleCopyCode() {
    if (createdProfileCode) {
      navigator.clipboard.writeText(createdProfileCode)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  // Màn hình thành công (hiển thị mã hồ sơ một lần)
  if (createdProfileCode) {
    return (
      <main className="min-h-[70vh]">
        <section className="px-4 py-16 md:px-8">
          <div data-rv className="mx-auto max-w-2xl rounded-[20px] bg-soft p-8 text-center md:p-12">
            <Eyebrow className="text-apc-blue">nộp đơn thành công</Eyebrow>
            <h1 className="mt-3 font-display text-3xl font-extrabold text-ink md:text-4xl">
              Đơn Ứng Tuyển Đã Được Ghi Nhận!
            </h1>
            <p className="mt-4 text-muted">
              Cảm ơn bạn <b>{applicantName}</b> đã quan tâm và ứng tuyển vào CLB APC. Email xác nhận đã được gửi tới <b>{applicantEmail}</b>.
            </p>

            {/* Khối mã hồ sơ: dùng mảng màu paper phẳng chuẩn DESIGN.md */}
            <div className="my-8 rounded-[20px] bg-paper p-6 text-center">
              <span className="font-code text-xs font-bold uppercase tracking-wider text-apc-red">
                Mã hồ sơ tra cứu của bạn
              </span>
              <div className="mt-2 font-code text-3xl font-black tracking-widest text-ink md:text-4xl">
                {createdProfileCode}
              </div>
              <button
                type="button"
                onClick={handleCopyCode}
                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-ink px-4 py-2 font-code text-xs font-bold text-paper transition hover:bg-apc-red"
              >
                {copied ? 'Đã sao chép vào bộ nhớ tạm' : 'Sao chép mã hồ sơ'}
              </button>
            </div>

            <div className="rounded-[20px] bg-paper p-5 text-left text-sm text-ink">
              <p className="font-display font-bold text-apc-red">Lưu ý quan trọng:</p>
              <ul className="mt-2 list-inside list-disc space-y-1 text-muted">
                <li>Mã hồ sơ này chỉ hiển thị một lần duy nhất trên màn hình này.</li>
                <li>Bạn dùng mã này cùng email để theo dõi tiến độ hoặc rút đơn tại trang tra cứu.</li>
              </ul>
            </div>

            <div className="mt-8 flex flex-wrap justify-center gap-4">
              <Link to="/recruitment/application-lookup" className={buttonClass('primary')}>
                Đến trang tra cứu hồ sơ →
              </Link>
              <Link to={`/recruitment/${round.slug}`} className={buttonClass('outline')}>
                Về trang đợt tuyển
              </Link>
            </div>
          </div>
        </section>
      </main>
    )
  }

  // Đợt đã đóng hoặc chưa mở
  if (isClosed) {
    return (
      <main className="min-h-[60vh]">
        <section className="px-4 py-16 md:px-8">
          <div data-rv className="mx-auto max-w-xl text-center">
            <Eyebrow className="text-apc-red">tuyển thành viên</Eyebrow>
            <h1 className="mt-4 font-display text-3xl font-extrabold text-ink">Đợt tuyển hiện không mở nhận đơn</h1>
            <p className="mt-3 text-muted">
              Đợt tuyển <b>{round.title}</b> hiện chưa đến hạn nhận đơn hoặc đã kết thúc thời gian nộp hồ sơ.
            </p>
            <div className="mt-8">
              <Link to={`/recruitment/${round.slug}`} className={buttonClass('outline')}>
                ← Quay lại chi tiết đợt tuyển
              </Link>
            </div>
          </div>
        </section>
      </main>
    )
  }

  return (
    <main>
      <PageHero
        tone="red"
        compact
        top={
          <Breadcrumb
            items={[
              { label: 'trang chủ', to: '/' },
              { label: 'tuyển thành viên', to: '/recruitment' },
              { label: round.title, to: `/recruitment/${round.slug}` },
              { label: 'nộp đơn' },
            ]}
          />
        }
        comment="hồ sơ gia nhập apc"
        title="Đơn Ứng Tuyển"
        lede={`Bạn đang ứng tuyển vào đợt "${round.title}". Vui lòng điền đầy đủ và chính xác các thông tin bên dưới.`}
      />

      <section className="px-4 py-12 md:px-8">
        <div className="mx-auto max-w-3xl">
          {/* Thanh chỉ báo bước */}
          <div data-rv className="mb-10 flex items-center justify-between border-b-2 border-ink pb-4">
            {[
              { num: 1, label: 'Thông tin cá nhân' },
              { num: 2, label: 'Nguyện vọng' },
              ...(visibleQuestions.length > 0 ? [{ num: 3, label: 'Câu hỏi bổ sung' }] : []),
              { num: 4, label: 'Xác nhận & Nộp' },
            ].map((s) => (
              <div
                key={s.num}
                className={`flex items-center gap-2 font-display text-sm font-bold md:text-base ${
                  step === s.num ? 'text-apc-red' : step > s.num ? 'text-ink' : 'text-muted opacity-50'
                }`}
              >
                <span
                  className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-black ${
                    step === s.num
                      ? 'bg-apc-red text-paper'
                      : step > s.num
                      ? 'bg-ink text-paper'
                      : 'bg-soft text-muted'
                  }`}
                >
                  {s.num}
                </span>
                <span className="hidden sm:inline">{s.label}</span>
              </div>
            ))}
          </div>

          {/* Banner thông báo lỗi nếu có */}
          {serverError && (
            <div className="mb-6 rounded-xl border-2 border-apc-red bg-apc-red-pale/40 p-4 font-bold text-apc-red">
              {serverError}
            </div>
          )}

          {/* ── BƯỚC 1: THÔNG TIN CÁ NHÂN & HỌC TẬP ── */}
          {step === 1 && (
            <form data-rv onSubmit={handleNextStep1} className="space-y-6">
              <h2 className="font-display text-2xl font-extrabold text-ink">1. Thông tin cá nhân & học tập</h2>

              <div>
                <label className="block text-sm font-bold text-ink">Họ và tên *</label>
                <input
                  type="text"
                  required
                  value={applicantName}
                  onChange={(e) => setApplicantName(e.target.value)}
                  placeholder="Nguyễn Văn A"
                  className={`mt-1.5 w-full rounded-xl border-2 bg-paper px-4 py-3 font-body text-ink outline-none transition focus:border-apc-blue ${
                    fieldErrors.applicantName ? 'border-apc-red' : 'border-ink'
                  }`}
                />
                {fieldErrors.applicantName && (
                  <p className="mt-1 text-xs font-bold text-apc-red">{fieldErrors.applicantName}</p>
                )}
              </div>

              <div className="grid gap-6 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-bold text-ink">Email liên hệ *</label>
                  <input
                    type="email"
                    required
                    value={applicantEmail}
                    onChange={(e) => setApplicantEmail(e.target.value)}
                    placeholder="nguyenvana@example.com"
                    className={`mt-1.5 w-full rounded-xl border-2 bg-paper px-4 py-3 font-body text-ink outline-none transition focus:border-apc-blue ${
                      fieldErrors.applicantEmail ? 'border-apc-red' : 'border-ink'
                    }`}
                  />
                  {fieldErrors.applicantEmail && (
                    <p className="mt-1 text-xs font-bold text-apc-red">{fieldErrors.applicantEmail}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-bold text-ink">Mã số sinh viên (MSSV) *</label>
                  <input
                    type="text"
                    required
                    value={studentId}
                    onChange={(e) => setStudentId(e.target.value)}
                    placeholder="VD: 24010001"
                    className={`mt-1.5 w-full rounded-xl border-2 bg-paper px-4 py-3 font-body text-ink outline-none transition focus:border-apc-blue ${
                      fieldErrors.studentId ? 'border-apc-red' : 'border-ink'
                    }`}
                  />
                  {fieldErrors.studentId && (
                    <p className="mt-1 text-xs font-bold text-apc-red">{fieldErrors.studentId}</p>
                  )}
                </div>
              </div>

              <div className="grid gap-6 sm:grid-cols-3">
                <div>
                  <label className="block text-sm font-bold text-ink">Khoa</label>
                  <input
                    type="text"
                    value={faculty}
                    onChange={(e) => setFaculty(e.target.value)}
                    placeholder="Công nghệ thông tin"
                    className="mt-1.5 w-full rounded-xl border-2 border-ink bg-paper px-4 py-3 font-body text-ink outline-none transition focus:border-apc-blue"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-ink">Ngành học</label>
                  <input
                    type="text"
                    value={major}
                    onChange={(e) => setMajor(e.target.value)}
                    placeholder="Kỹ thuật phần mềm"
                    className="mt-1.5 w-full rounded-xl border-2 border-ink bg-paper px-4 py-3 font-body text-ink outline-none transition focus:border-apc-blue"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-ink">Niên khóa</label>
                  <input
                    type="text"
                    value={cohort}
                    onChange={(e) => setCohort(e.target.value)}
                    placeholder="K24"
                    className="mt-1.5 w-full rounded-xl border-2 border-ink bg-paper px-4 py-3 font-body text-ink outline-none transition focus:border-apc-blue"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-4">
                <Button variant="primary">
                  Tiếp tục: Chọn ban ứng tuyển →
                </Button>
              </div>
            </form>
          )}

          {/* ── BƯỚC 2: NGUYỆN VỌNG & NĂNG LỰC ── */}
          {step === 2 && (
            <form data-rv onSubmit={handleNextStep2} className="space-y-6">
              <h2 className="font-display text-2xl font-extrabold text-ink">2. Nguyện vọng & Năng lực</h2>

              <div>
                <label className="block text-sm font-bold text-ink">Ban bạn muốn gia nhập *</label>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {round.departments.map((dept) => (
                    <label
                      key={dept.id}
                      className={`flex cursor-pointer items-start gap-3 rounded-xl border-2 p-4 transition ${
                        desiredDepartmentId === dept.id
                          ? 'border-apc-red bg-apc-red-pale/40'
                          : 'border-ink bg-paper hover:bg-soft'
                      }`}
                    >
                      <input
                        type="radio"
                        name="desiredDept"
                        value={dept.id}
                        checked={desiredDepartmentId === dept.id}
                        onChange={() => setDesiredDepartmentId(dept.id)}
                        className="mt-1 accent-red"
                      />
                      <div>
                        <span className="font-display font-bold text-ink">{dept.name}</span>
                        {dept.description && (
                          <p className="mt-1 text-xs text-muted leading-relaxed">{dept.description}</p>
                        )}
                      </div>
                    </label>
                  ))}
                </div>
                {fieldErrors.desiredDepartmentId && (
                  <p className="mt-1 text-xs font-bold text-apc-red">{fieldErrors.desiredDepartmentId}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-bold text-ink">Kỹ năng hiện có</label>
                <textarea
                  rows={3}
                  value={skills}
                  onChange={(e) => setSkills(e.target.value)}
                  placeholder="VD: HTML/CSS, JavaScript, React, Git, Figma, giải quyết vấn đề..."
                  className="mt-1.5 w-full rounded-xl border-2 border-ink bg-paper px-4 py-3 font-body text-ink outline-none transition focus:border-apc-blue"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-ink">Kinh nghiệm & Dự án đã làm (nếu có)</label>
                <textarea
                  rows={3}
                  value={experience}
                  onChange={(e) => setExperience(e.target.value)}
                  placeholder="VD: Đã làm web đồ án cá nhân, tham gia CLB thời THPT..."
                  className="mt-1.5 w-full rounded-xl border-2 border-ink bg-paper px-4 py-3 font-body text-ink outline-none transition focus:border-apc-blue"
                />
              </div>

              <div className="flex justify-between pt-4">
                <Button type="button"  variant="outline" onClick={() => setStep(1)}>
                  ← Quay lại
                </Button>
                <Button variant="primary">
                  {visibleQuestions.length > 0 ? 'Tiếp tục: Câu hỏi bổ sung →' : 'Tiếp tục: Xem lại & Nộp →'}
                </Button>
              </div>
            </form>
          )}

          {/* ── BƯỚC 3: CÂU HỎI BỔ SUNG CỦA ĐỢT ── */}
          {step === 3 && (
            <form data-rv onSubmit={handleNextStep3} className="space-y-6">
              <h2 className="font-display text-2xl font-extrabold text-ink">3. Câu hỏi từ Ban Tuyển sinh</h2>

              <div className="space-y-6">
                {visibleQuestions.map((q) => (
                  <QuestionField
                    key={q.id}
                    question={q}
                    value={answers[q.id]}
                    onChange={(val) => setAnswers((prev) => ({ ...prev, [q.id]: val }))}
                    error={fieldErrors[`answers.${q.id}`]}
                  />
                ))}
              </div>

              <div className="flex justify-between pt-4">
                <Button type="button" variant="outline" onClick={() => setStep(2)}>
                  ← Quay lại
                </Button>
                <Button type="submit" variant="primary">
                  Tiếp tục: Xem lại & Nộp →
                </Button>
              </div>
            </form>
          )}

          {/* ── BƯỚC 4: XEM LẠI & ĐỒNG Ý CHÍNH SÁCH ── */}
          {step === 4 && (
            <form data-rv onSubmit={handleSubmit} className="space-y-6">
              <h2 className="font-display text-2xl font-extrabold text-ink">4. Xem lại thông tin & Xác nhận nộp</h2>

              <div className="rounded-[20px] bg-soft p-6 space-y-4">
                <div className="grid gap-4 sm:grid-cols-2 text-sm">
                  <div>
                    <span className="font-bold text-muted">Họ và tên:</span>
                    <p className="font-bold text-ink">{applicantName}</p>
                  </div>
                  <div>
                    <span className="font-bold text-muted">Email liên hệ:</span>
                    <p className="font-bold text-ink">{applicantEmail}</p>
                  </div>
                  <div>
                    <span className="font-bold text-muted">MSSV:</span>
                    <p className="font-bold text-ink">{studentId}</p>
                  </div>
                  <div>
                    <span className="font-bold text-muted">Khoa / Ngành / Khóa:</span>
                    <p className="font-bold text-ink">
                      {[faculty, major, cohort].filter(Boolean).join(' - ') || 'Chưa điền'}
                    </p>
                  </div>
                  <div className="sm:col-span-2">
                    <span className="font-bold text-muted">Ban mong muốn gia nhập:</span>
                    <p className="font-bold text-apc-red">
                      {round.departments.find((d) => d.id === desiredDepartmentId)?.name}
                    </p>
                  </div>

                  {/* Kỹ năng hiện có */}
                  <div className="sm:col-span-2">
                    <span className="font-bold text-muted">Kỹ năng hiện có:</span>
                    <p className="font-body text-ink whitespace-pre-line">{skills.trim() || 'Chưa điền'}</p>
                  </div>

                  {/* Kinh nghiệm & Dự án */}
                  <div className="sm:col-span-2">
                    <span className="font-bold text-muted">Kinh nghiệm & Dự án:</span>
                    <p className="font-body text-ink whitespace-pre-line">{experience.trim() || 'Chưa điền'}</p>
                  </div>

                  {/* Câu hỏi bổ sung từ đợt tuyển */}
                  {visibleQuestions.length > 0 && (
                    <div className="border-t border-ink/10 pt-4 sm:col-span-2 space-y-3">
                      <p className="font-display font-bold text-ink">Câu hỏi bổ sung:</p>
                      {visibleQuestions.map((q) => {
                        const val = answers[q.id]
                        let displayVal = 'Chưa điền'
                        if (q.type === 'single_choice') {
                          displayVal =
                            q.options?.find((o) => o.id === val)?.label ??
                            (typeof val === 'string' && val.trim() ? val : 'Chưa điền')
                        } else if (q.type === 'multiple_choice') {
                          const arr = Array.isArray(val) ? (val as string[]) : []
                          const labels = arr.map((optId) => q.options?.find((o) => o.id === optId)?.label ?? optId)
                          displayVal = labels.length > 0 ? labels.join(', ') : 'Chưa điền'
                        } else if (typeof val === 'string' && val.trim()) {
                          displayVal = val.trim()
                        }

                        return (
                          <div key={q.id} className="text-sm">
                            <span className="font-bold text-muted">{q.label}:</span>
                            <p className="font-body text-ink whitespace-pre-line">{displayVal}</p>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-[20px] bg-soft p-5">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={consent}
                    onChange={(e) => {
                      setConsent(e.target.checked)
                      if (e.target.checked) setFieldErrors({})
                    }}
                    className="mt-1 h-5 w-5 rounded accent-red"
                  />
                  <span className="text-sm leading-relaxed text-ink">
                    Tôi xác nhận các thông tin trên là chính xác và <b>đồng ý</b> cho phép CLB APC thu thập, lưu trữ và
                    xử lý dữ liệu cá nhân theo{' '}
                    <Link to="/privacy" target="_blank" className="font-bold text-apc-blue underline">
                      Chính sách bảo vệ dữ liệu cá nhân
                    </Link>{' '}
                    nhằm phục vụ công tác tuyển thành viên.
                  </span>
                </label>
                {fieldErrors.consent && (
                  <p className="mt-2 text-xs font-bold text-apc-red">{fieldErrors.consent}</p>
                )}
              </div>

              <div className="flex justify-between pt-4">
                <Button
                  type="button"
                  variant="outline"
                  disabled={submitting}
                  onClick={() => setStep(visibleQuestions.length > 0 ? 3 : 2)}
                >
                  ← Sửa lại
                </Button>
                <Button type="submit" variant="primary" disabled={submitting}>
                  {submitting ? 'Đang gửi hồ sơ...' : 'Nộp Đơn Ứng Tuyển'}
                </Button>
              </div>
            </form>
          )}
        </div>
      </section>
    </main>
  )
}

function QuestionField({
  question,
  value,
  onChange,
  error,
}: {
  question: RecruitmentQuestion
  value: unknown
  onChange: (val: unknown) => void
  error?: string
}) {
  const autoId = useId()

  return (
    <div>
      <label htmlFor={autoId} className="block text-sm font-bold text-ink">
        {question.label} {question.required && <span className="text-apc-red">*</span>}
      </label>

      {question.type === 'short_text' && (
        <input
          id={autoId}
          type="text"
          value={(value as string) ?? ''}
          onChange={(e) => onChange(e.target.value)}
          className={`mt-1.5 w-full rounded-xl border-2 bg-paper px-4 py-3 font-body text-ink outline-none transition focus:border-apc-blue ${
            error ? 'border-apc-red' : 'border-ink'
          }`}
        />
      )}

      {question.type === 'long_text' && (
        <textarea
          id={autoId}
          rows={3}
          value={(value as string) ?? ''}
          onChange={(e) => onChange(e.target.value)}
          className={`mt-1.5 w-full rounded-xl border-2 bg-paper px-4 py-3 font-body text-ink outline-none transition focus:border-apc-blue ${
            error ? 'border-apc-red' : 'border-ink'
          }`}
        />
      )}

      {question.type === 'single_choice' && (
        <div className="mt-2 space-y-2">
          {question.options?.map((opt) => (
            <label key={opt.id} className="flex items-center gap-2 text-sm text-ink cursor-pointer">
              <input
                type="radio"
                name={`q_${question.id}`}
                value={opt.id}
                checked={value === opt.id}
                onChange={() => onChange(opt.id)}
                className="accent-red"
              />
              <span>{opt.label}</span>
            </label>
          ))}
        </div>
      )}

      {question.type === 'multiple_choice' && (
        <div className="mt-2 space-y-2">
          {question.options?.map((opt) => {
            const arr = Array.isArray(value) ? (value as string[]) : []
            const isChecked = arr.includes(opt.id)
            return (
              <label key={opt.id} className="flex items-center gap-2 text-sm text-ink cursor-pointer">
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={(e) => {
                    if (e.target.checked) onChange([...arr, opt.id])
                    else onChange(arr.filter((id) => id !== opt.id))
                  }}
                  className="accent-red"
                />
                <span>{opt.label}</span>
              </label>
            )
          })}
        </div>
      )}

      {error && <p className="mt-1 text-xs font-bold text-apc-red">{error}</p>}
    </div>
  )
}
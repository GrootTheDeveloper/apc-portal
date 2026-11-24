import { useState } from 'react'

import { Breadcrumb } from '../../../../components/Breadcrumb'
import { Button } from '../../../../components/Button'
import { buttonClass } from '../../../../components/buttonClass'
import { Seo } from '../../../../components/Seo'
import { api, ApiError } from '../../../../lib/api'

type ImportIssue = { row: number; column: string; message: string }
type Validation = { batchId: string; fileHash: string; validRows: number; totalRows: number; errors: ImportIssue[] }
type CommitResult = { batchId: string; importedRows: number; alreadyImported: boolean }

function downloadIssues(errors: ImportIssue[]) {
  const escape = (value: string | number) => `"${String(value).replaceAll('"', '""')}"`
  const csv = ['row,column,message', ...errors.map((issue) => [issue.row, issue.column, issue.message].map(escape).join(','))].join('\r\n')
  const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = 'loi-nhap-thanh-vien.csv'
  anchor.click()
  URL.revokeObjectURL(url)
}

export function AdminMemberImportPage() {
  const [file, setFile] = useState<File | null>(null)
  const [validation, setValidation] = useState<Validation | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [completed, setCompleted] = useState<CommitResult | null>(null)

  async function validateFile(event: React.FormEvent) {
    event.preventDefault()
    if (!file) return
    setBusy(true)
    setError('')
    setCompleted(null)
    setValidation(null)
    const body = new FormData()
    body.append('file', file)
    try {
      setValidation(await api<Validation>('/admin/members/import/validate', { method: 'POST', body }))
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Không thể kiểm tra tệp. Vui lòng thử lại.')
    } finally {
      setBusy(false)
    }
  }

  async function commitImport() {
    if (!file || !validation || validation.errors.length > 0) return
    setBusy(true)
    setError('')
    const body = new FormData()
    body.append('batchId', validation.batchId)
    body.append('file', file)
    try {
      setCompleted(await api<CommitResult>('/admin/members/import/commit', { method: 'POST', body }))
      setValidation(null)
      setFile(null)
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Không thể nhập tệp. Vui lòng thử lại.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="mx-auto max-w-4xl px-gutter py-10 md:py-14">
      <Seo title="Nhập thành viên từ CSV" description="Kiểm tra và nhập danh sách thành viên APC từ CSV." path="/admin/members/import" robots="noindex, nofollow" />
      <Breadcrumb items={[{ label: 'quản trị', to: '/admin' }, { label: 'thành viên', to: '/admin/members' }, { label: 'nhập CSV' }]} />
      <header className="mt-6">
        <p className="font-code text-xs font-bold uppercase text-apc-blue">quản trị thành viên · bước 1 và 2</p>
        <h1 className="mt-2 font-display text-4xl font-extrabold text-ink">Nhập danh sách CSV</h1>
        <p className="mt-3 max-w-2xl text-muted">Tải mẫu, điền UTF-8 rồi kiểm tra. Hệ thống chưa tạo tài khoản cho đến khi bạn xác nhận nhập.</p>
      </header>

      <section className="mt-8 space-y-6" aria-label="Nhập danh sách thành viên">
        <div className="bg-apc-blue p-6 text-paper md:p-8">
          <h2 className="font-display text-2xl font-bold">Định dạng tệp</h2>
          <p className="mt-2">CSV UTF-8, tối đa 2 MB và 500 dòng. Cột bắt buộc: fullName, username, email, studentId, departmentCode. faculty, major, cohort có thể để trống.</p>
          <a className={`${buttonClass('outline')} mt-5 border-paper text-paper`} href="/api/admin/members/import/template" download>
            Tải file mẫu
          </a>
        </div>

        <form className="space-y-5 bg-soft p-6 md:p-8" onSubmit={validateFile}>
          <label className="flex flex-col gap-2 font-code text-sm font-bold" htmlFor="member-csv">Chọn file CSV</label>
          <input id="member-csv" className="block w-full text-sm" type="file" accept=".csv,text/csv" onChange={(event) => {
            setFile(event.target.files?.[0] ?? null)
            setValidation(null)
            setCompleted(null)
            setError('')
          }} />
          <div className="flex flex-wrap gap-3">
            <Button type="submit" disabled={!file || busy}>{busy ? 'Đang kiểm tra…' : 'Kiểm tra tệp'}</Button>
          </div>
        </form>

        {error && <p role="alert" className="bg-apc-red p-4 font-bold text-paper">{error}</p>}
        {validation && (
          <section className="space-y-4 bg-ink p-6 text-paper md:p-8" aria-live="polite">
            <h2 className="font-display text-2xl font-bold">Kết quả kiểm tra</h2>
            <p>{validation.validRows} / {validation.totalRows} dòng hợp lệ</p>
            {validation.errors.length > 0 ? (
              <>
                <p className="font-bold text-apc-gold-soft">Tìm thấy {validation.errors.length} lỗi. Không dòng nào được nhập.</p>
                <div className="max-h-72 overflow-auto">
                  <table className="w-full text-left text-sm">
                    <thead><tr><th className="p-2">Dòng</th><th className="p-2">Cột</th><th className="p-2">Lỗi</th></tr></thead>
                    <tbody>{validation.errors.map((issue, index) => <tr key={`${issue.row}-${issue.column}-${index}`} className="border-t border-paper/20"><td className="p-2">{issue.row}</td><td className="p-2">{issue.column}</td><td className="p-2">{issue.message}</td></tr>)}</tbody>
                  </table>
                </div>
                <Button variant="outline" onClick={() => downloadIssues(validation.errors)}>Tải file lỗi</Button>
              </>
            ) : (
              <>
                <p>Không còn lỗi. Khi xác nhận, tài khoản sẽ ở trạng thái chờ kích hoạt; mật khẩu tạm không được ghi vào tệp.</p>
                <Button onClick={commitImport} disabled={busy}>{busy ? 'Đang nhập…' : 'Nhập toàn bộ danh sách'}</Button>
              </>
            )}
          </section>
        )}

        {completed && (
          <section className="bg-apc-gold p-6 text-ink" role="status">
            <h2 className="font-display text-2xl font-bold">Đã nhập thành công</h2>
            <p className="mt-2">{completed.alreadyImported ? 'Lô này đã được xử lý trước đó; lần gửi lại không tạo tài khoản trùng.' : `${completed.importedRows} tài khoản đã được tạo ở trạng thái chờ kích hoạt.`} Mã lô: <code>{completed.batchId}</code></p>
          </section>
        )}
      </section>
    </main>
  )
}

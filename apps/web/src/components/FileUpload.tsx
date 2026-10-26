import { useEffect, useId, useRef, useState } from 'react'

import { api, ApiError } from '../lib/api'

// Upload một tệp lên POST /portal/files (D2). Server tự quyết định visibility và kiểm tra nội dung tệp;
// phần kiểm tra ở đây chỉ để báo lỗi sớm cho người dùng.
//
// Ví dụ:
//   <FileUpload purpose="CONTENT_IMAGE" label="Ảnh bìa" onUploaded={(id) => setCoverId(id)} />
//   Ảnh công khai hiển thị qua `/api/public/files/${id}`; ảnh đại diện qua `/api/portal/files/${id}`.

export type FilePurpose = 'CONTENT_IMAGE' | 'AVATAR' | 'DOCUMENT'

const MAX_SIZE = 20 * 1024 * 1024
const IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp,image/gif'
const DOCUMENT_ACCEPT = [
  IMAGE_ACCEPT,
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
].join(',')

type Status = 'idle' | 'uploading' | 'done' | 'error'

type FileUploadProps = {
  purpose: FilePurpose
  label?: string
  onUploaded: (id: string) => void
  disabled?: boolean
}

export function FileUpload({ purpose, label = 'Chọn tệp', onUploaded, disabled }: FileUploadProps) {
  const inputId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState('')
  const [fileName, setFileName] = useState('')
  const [preview, setPreview] = useState('')

  const accept = purpose === 'DOCUMENT' ? DOCUMENT_ACCEPT : IMAGE_ACCEPT

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview) }, [preview])

  async function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    setError('')
    setFileName(file.name)
    setPreview(file.type.startsWith('image/') ? URL.createObjectURL(file) : '')

    if (file.size > MAX_SIZE) {
      setStatus('error')
      setError('Tệp vượt quá 20 MB.')
      return
    }

    const form = new FormData()
    form.append('purpose', purpose) // purpose phải đứng trước file (server đọc tuần tự)
    form.append('file', file)

    setStatus('uploading')
    try {
      const { id } = await api<{ id: string }>('/portal/files', { body: form })
      setStatus('done')
      onUploaded(id)
    } catch (caught) {
      setStatus('error')
      setError(caught instanceof ApiError ? caught.message : 'Tải tệp thất bại. Vui lòng thử lại.')
    }
  }

  const uploading = status === 'uploading'

  return (
    <div className="flex flex-col gap-3">
      <label
        htmlFor={inputId}
        className={`flex flex-col items-center justify-center gap-2 rounded-apc border-2 border-dashed px-6 py-8 text-center transition-colors ${
          status === 'error' ? 'border-error bg-error-container/30' : 'border-outline hover:border-apc-blue hover:bg-surface-container-low'
        } ${disabled || uploading ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
      >
        <span className="font-medium text-apc-blue">{label}</span>
        <span className="text-sm text-on-surface-variant">
          {purpose === 'DOCUMENT' ? 'Ảnh, PDF, DOCX, XLSX, PPTX' : 'JPG, PNG, WebP, GIF'} · tối đa 20 MB
        </span>
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept={accept}
          className="sr-only"
          disabled={disabled || uploading}
          onChange={handleChange}
        />
      </label>

      {preview && (
        <img src={preview} alt="Xem trước" className="max-h-48 w-auto self-start rounded-apc border border-outline-variant object-contain" />
      )}

      <div aria-live="polite" className="text-sm">
        {uploading && <p className="text-on-surface-variant">Đang tải lên và kiểm tra “{fileName}”…</p>}
        {status === 'done' && <p className="text-apc-blue">Đã tải lên “{fileName}”.</p>}
        {status === 'error' && <p role="alert" className="text-error">{error}</p>}
      </div>
    </div>
  )
}

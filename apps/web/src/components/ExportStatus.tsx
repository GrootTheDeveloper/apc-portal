import { formatDateTime } from '../lib/format'
import { buttonClass } from './buttonClass'

export type ExportStatusValue = 'CREATING' | 'READY' | 'EXPIRED'

type ExportStatusProps = {
  id: string
  status: ExportStatusValue
  filename: string
  expiresAt: string
}

/** Trạng thái file xuất bảo vệ dùng lại tại màn hình danh sách hoặc yêu cầu dữ liệu (STATE-06). */
export function ExportStatus({ id, status, filename, expiresAt }: ExportStatusProps) {
  return (
    <section aria-live="polite" className="flex flex-col gap-3 bg-soft p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
      <div className="min-w-0">
        <p className="font-code text-[12px] font-bold uppercase tracking-[0.12em] text-muted">
          {status === 'CREATING' ? 'Đang tạo tệp xuất' : status === 'READY' ? 'Tệp đã sẵn sàng' : 'Tệp đã hết hạn'}
        </p>
        <p className="mt-1 break-words font-display text-[18px] font-bold text-ink">{filename}</p>
        {status !== 'EXPIRED' && (
          <p className="mt-1 font-body text-[14px] text-muted">Có thể tải đến {formatDateTime(expiresAt)}.</p>
        )}
      </div>
      {status === 'READY' && (
        <a className={buttonClass('primary')} href={`/api/portal/exports/${encodeURIComponent(id)}/download`}>
          Tải CSV
        </a>
      )}
    </section>
  )
}

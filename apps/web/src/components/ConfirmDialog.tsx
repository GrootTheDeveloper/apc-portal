import { type FormEvent, type ReactNode, useEffect, useRef, useState } from 'react'

import { ApiError } from '../lib/api'
import { fieldErrors } from '../lib/formErrors'
import { Button } from './Button'

export type ConfirmValues = { reason: string; incidentId?: string }

type ConfirmDialogProps = {
  open: boolean
  title: string
  /** nêu rõ đối tượng và ảnh hưởng của hành động (STATE-07) */
  description: ReactNode
  confirmLabel: string
  /** nút xác nhận màu đỏ cho hành động khó hoàn tác */
  danger?: boolean
  /** lý do: bắt buộc (mặc định), không bắt buộc, hoặc không hỏi */
  reason?: 'required' | 'optional' | 'none'
  /** mã sự cố INC-YYYYMMDD-NN cho quyền INCIDENT */
  incident?: 'required' | 'optional'
  onConfirm: (values: ConfirmValues) => Promise<void>
  onClose: () => void
}

const inputClass =
  'w-full rounded-xl bg-paper px-4 py-3 text-[17px] text-ink shadow-[inset_0_0_0_2px_#081F3D] outline-none focus:shadow-[inset_0_0_0_2px_#1568C9,0_0_0_4px_rgba(21,104,201,0.2)] aria-[invalid=true]:shadow-[inset_0_0_0_2px_#C23B22]'

/**
 * Hộp xác nhận cho hành động nhạy cảm (khóa, hủy, lưu trữ, chốt…): nêu đối tượng, ảnh hưởng, hỏi lý do.
 * Lỗi API (422 theo ô, 403, 409) hiện ngay trong hộp, giữ nguyên dữ liệu đã nhập.
 */
export function ConfirmDialog(props: ConfirmDialogProps) {
  const { open, title, description, confirmLabel, danger = false, reason = 'required', incident, onConfirm, onClose } = props
  const ref = useRef<HTMLDialogElement>(null)
  const [values, setValues] = useState<ConfirmValues>({ reason: '' })
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<{ message: string; fields: Record<string, string[]> } | null>(null)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    setError(null)
    try {
      await onConfirm({ reason: values.reason.trim(), ...(values.incidentId ? { incidentId: values.incidentId.trim() } : {}) })
      setValues({ reason: '' })
    } catch (caught) {
      const fields = fieldErrors(caught)
      // Lỗi của ô nằm ngoài hộp (vd chọn ban trong phần mô tả) gộp vào dòng thông báo chung.
      const others = Object.entries(fields)
        .filter(([field]) => field !== 'reason' && field !== 'incidentId')
        .flatMap(([, messages]) => messages)
      const message =
        caught instanceof ApiError && caught.status !== 422
          ? caught.message
          : others.length > 0
            ? others.join(' ')
            : 'Kiểm tra lại các ô được đánh dấu.'
      setError({ message, fields })
    } finally {
      setPending(false)
    }
  }

  const fields = error?.fields ?? {}
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      className="w-[min(560px,calc(100vw-32px))] rounded-2xl bg-paper p-0 text-ink backdrop:bg-ink/60"
    >
      <form method="dialog" onSubmit={handleSubmit} noValidate className="flex flex-col gap-5 p-6">
        <h2 className="font-display text-[28px] font-extrabold leading-tight tracking-[-0.02em]">{title}</h2>
        <div className="text-[16px] leading-relaxed text-muted">{description}</div>

        {incident && (
          <label className="flex flex-col gap-2 font-code text-[13px] font-bold">
            mã sự cố {incident === 'optional' && '(nếu có)'}
            <input
              className={inputClass}
              placeholder="INC-20261027-01"
              value={values.incidentId ?? ''}
              onChange={(event) => setValues((current) => ({ ...current, incidentId: event.target.value }))}
              aria-invalid={!!fields.incidentId}
              required={incident === 'required'}
            />
            {fields.incidentId?.map((message) => (
              <span key={message} className="font-body text-[15px] text-apc-red">
                {message}
              </span>
            ))}
          </label>
        )}

        {reason !== 'none' && (
          <label className="flex flex-col gap-2 font-code text-[13px] font-bold">
            lý do {reason === 'optional' && '(không bắt buộc)'}
            <textarea
              className={`${inputClass} min-h-24 resize-y`}
              value={values.reason}
              maxLength={500}
              onChange={(event) => setValues((current) => ({ ...current, reason: event.target.value }))}
              aria-invalid={!!fields.reason}
              required={reason === 'required'}
            />
            {fields.reason?.map((message) => (
              <span key={message} className="font-body text-[15px] text-apc-red">
                {message}
              </span>
            ))}
          </label>
        )}

        {error && (
          <p role="alert" className="rounded-xl bg-apc-red/10 px-4 py-3 text-[15px] font-bold text-apc-red">
            {error.message}
          </p>
        )}

        <div className="flex flex-wrap justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => ref.current?.close()} disabled={pending}>
            Hủy
          </Button>
          <Button
            type="submit"
            variant={danger ? 'primary' : 'light'}
            disabled={pending || (reason === 'required' && values.reason.trim().length === 0)}
          >
            {pending ? 'Đang xử lý…' : confirmLabel}
          </Button>
        </div>
      </form>
    </dialog>
  )
}

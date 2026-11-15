import { type FormEvent, useState } from 'react'

import { Button } from '../../../components/Button'
import { inputClass, labelClass } from '../../../components/formClass'
import type { IncidentAccess } from './types'

/**
 * TECH_ADMIN chỉ xem email theo quyền INCIDENT (README kế hoạch §7.2): nhập mã sự cố và lý do trước khi tải dữ liệu.
 * Mỗi lần tải ghi nhật ký bảo mật; sai dạng mã thì API trả 422 và trang gọi hiện lại form kèm lỗi (`error`).
 */
export function IncidentGate({ onSubmit, error }: { onSubmit: (access: IncidentAccess) => void; error?: string }) {
  const [incidentId, setIncidentId] = useState('')
  const [reason, setReason] = useState('')

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    onSubmit({ incidentId: incidentId.trim(), reason: reason.trim() })
  }

  return (
    <form onSubmit={handleSubmit} className="mt-8 flex max-w-xl flex-col gap-5 rounded-2xl bg-soft p-6">
      <p className="text-[16px] leading-relaxed text-muted">
        Tài khoản kỹ thuật chỉ xem được thông tin giao nhận (loại, trạng thái, số lần thử, lỗi), không thấy người nhận,
        và chỉ khi có sự cố đã ghi trong sổ sự cố. Mỗi lần xem đều được ghi nhật ký.
      </p>
      <label className={labelClass}>
        mã sự cố
        <input className={inputClass} placeholder="INC-20261027-01" value={incidentId} onChange={(event) => setIncidentId(event.target.value)} required />
      </label>
      <label className={labelClass}>
        lý do
        <textarea className={`${inputClass} min-h-24 resize-y`} maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} required />
      </label>
      {error && (
        <p role="alert" className="rounded-xl bg-apc-red/10 px-4 py-3 text-[15px] font-bold text-apc-red">
          {error}
        </p>
      )}
      <div>
        <Button type="submit" disabled={incidentId.trim() === '' || reason.trim().length < 3}>
          Xem email
        </Button>
      </div>
    </form>
  )
}

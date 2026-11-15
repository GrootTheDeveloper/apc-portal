import { type DeliveryStatus, STATUS_LABEL } from './types'

const TONE: Record<DeliveryStatus, string> = {
  PENDING: 'bg-soft text-muted',
  SENDING: 'bg-soft text-apc-blue',
  RETRY: 'bg-soft text-ink',
  SENT: 'bg-apc-blue text-paper',
  FAILED: 'bg-apc-red text-paper',
}

export function StatusBadge({ status }: { status: DeliveryStatus }) {
  return <span className={`inline-block rounded-full px-3 py-1 font-code text-xs font-bold ${TONE[status]}`}>{STATUS_LABEL[status]}</span>
}

// Màu/icon theo loại sự kiện và nhãn trạng thái — dùng chung cho EventCard và trang chi tiết.
// Tách khỏi EventCard.tsx để file đó chỉ export component (react-refresh/only-export-components).

export type EventCardStatus = 'PUBLISHED' | 'CANCELLED' | 'ENDED'

export type TypeStyle = { chipClass: string; coverClass: string; iconClass: string; icon: string }

// Class màu để literal (không nội suy) để Tailwind JIT nhận diện được.
const TYPE_STYLES: Record<string, TypeStyle> = {
  Workshop: {
    chipClass: 'bg-apc-blue/10 text-apc-blue',
    coverClass: 'from-apc-blue/15 to-surface-container-high',
    iconClass: 'text-apc-blue/50',
    icon: 'code',
  },
  Training: {
    chipClass: 'bg-apc-gold/10 text-apc-gold',
    coverClass: 'from-apc-gold/20 to-surface-container-high',
    iconClass: 'text-apc-gold/60',
    icon: 'science',
  },
  'Tech Talk': {
    chipClass: 'bg-apc-gold/10 text-apc-gold',
    coverClass: 'from-apc-gold/20 to-surface-container-high',
    iconClass: 'text-apc-gold/60',
    icon: 'campaign',
  },
  'Cuộc thi': {
    chipClass: 'bg-apc-red/10 text-apc-red',
    coverClass: 'from-apc-red/15 to-surface-container-high',
    iconClass: 'text-apc-red/50',
    icon: 'emoji_events',
  },
  Hackathon: {
    chipClass: 'bg-apc-blue/10 text-apc-blue',
    coverClass: 'from-apc-blue/15 to-surface-container-high',
    iconClass: 'text-apc-blue/50',
    icon: 'bolt',
  },
}

const FALLBACK_STYLE: TypeStyle = {
  chipClass: 'bg-apc-blue/10 text-apc-blue',
  coverClass: 'from-apc-blue/15 to-surface-container-high',
  iconClass: 'text-apc-blue/50',
  icon: 'event',
}

export const EVENT_STATUS_STYLES: Record<EventCardStatus, { label: string; chipClass: string }> = {
  PUBLISHED: { label: 'Sắp diễn ra', chipClass: 'bg-apc-blue text-white' },
  CANCELLED: { label: 'Đã hủy', chipClass: 'bg-apc-red text-white' },
  ENDED: { label: 'Đã kết thúc', chipClass: 'bg-on-surface-variant text-white' },
}

/** Màu/icon theo loại sự kiện — loại chưa map thì dùng màu trung tính. */
export function eventTypeVisual(eventType: string): TypeStyle {
  return TYPE_STYLES[eventType] ?? FALLBACK_STYLE
}

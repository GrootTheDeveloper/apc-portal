// Ảnh minh hoạ theo loại sự kiện và nhãn trạng thái — dùng chung cho trang chủ, EventCard và trang chi tiết.
// Tách khỏi EventCard.tsx để file đó chỉ export component (react-refresh/only-export-components).

export type EventCardStatus = 'PUBLISHED' | 'CANCELLED' | 'ENDED'

// Ảnh minh hoạ theo loại, dùng khi sự kiện chưa có ảnh bìa.
const TYPE_PHOTOS: Record<string, string> = {
  Workshop: '/assets/home/photos/workshop.jpg',
  Training: '/assets/home/photos/training.jpg',
  'Tech Talk': '/assets/home/photos/techtalk.jpg',
  'Cuộc thi': '/assets/home/photos/award.jpg',
  Hackathon: '/assets/home/photos/hackathon.jpg',
}

// Class màu để literal (không nội suy) để Tailwind JIT nhận diện được.
export const EVENT_STATUS_STYLES: Record<EventCardStatus, { label: string; chipClass: string }> = {
  PUBLISHED: { label: 'Sắp diễn ra', chipClass: 'bg-apc-blue text-paper' },
  CANCELLED: { label: 'Đã hủy', chipClass: 'bg-apc-red text-paper' },
  ENDED: { label: 'Đã kết thúc', chipClass: 'bg-ink text-paper' },
}

/** Ảnh bìa của sự kiện, chưa có thì lấy ảnh minh hoạ theo loại. */
export function eventPhoto(eventType: string, coverImageUrl?: string | null): string {
  return coverImageUrl ?? TYPE_PHOTOS[eventType] ?? TYPE_PHOTOS.Workshop
}

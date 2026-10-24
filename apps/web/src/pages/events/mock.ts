import type { Page } from '../../lib/api'
import { ApiError } from '../../lib/api'
import { currentMonthKey, monthKeyOf, vnTodayParts } from '../../lib/vnTime'

// Dữ liệu giả cho E1 — E2 sẽ xóa file này và thay bằng useApi(...) + GET /public/events.
// Hình dạng dữ liệu bám theo phản hồi dự kiến của API ở E2 (Page<T> + các trường của Event sau migration).

export type EventStatus = 'PUBLISHED' | 'CANCELLED' | 'ENDED'

export type EventListItem = {
  slug: string
  title: string
  coverImageUrl: string | null
  eventType: string
  status: EventStatus
  startAt: string
  endAt: string
  location: string | null
  onlineUrl: string | null
}

export type EventDetail = EventListItem & {
  id: string
  description: string
  departmentName: string | null
  contactPoint: string | null
  registrationOpensAt: string | null
  registrationClosesAt: string | null
  capacity: number | null
  cancelReason: string | null
}

export const EVENT_TYPES = ['Workshop', 'Training', 'Tech Talk', 'Cuộc thi', 'Hackathon'] as const

/** ISO time = ngày hôm nay (giờ VN) + `days` ngày, lúc `hour`:`minute` giờ VN. Để bản demo luôn còn sự kiện sắp diễn ra. */
function at(days: number, hour: number, minute: number): string {
  const today = vnTodayParts()
  return new Date(Date.UTC(today.year, today.month - 1, today.day + days, hour - 7, minute)).toISOString()
}

type MockEvent = EventDetail

const MOCK_EVENTS: MockEvent[] = [
  {
    id: 'evt_training_git',
    slug: 'git-github-cho-thanh-vien-moi',
    title: 'Training: Git & GitHub cho thành viên mới',
    description:
      'Buổi training nền tảng cho thành viên mới của CLB: làm việc với branch, commit theo chuẩn, mở và review pull request.\n\nMang theo laptop đã cài sẵn Git. Link tham gia trực tuyến sẽ hiển thị ngay trên trang này trước giờ diễn ra.',
    coverImageUrl: null,
    eventType: 'Training',
    status: 'PUBLISHED',
    startAt: at(2, 18, 30),
    endAt: at(2, 20, 30),
    location: null,
    onlineUrl: 'https://meet.google.com/apc-training',
    departmentName: 'Ban Chuyên môn',
    contactPoint: 'Ban Chuyên môn APC',
    registrationOpensAt: at(-7, 0, 0),
    registrationClosesAt: at(1, 23, 59),
    capacity: 40,
    cancelReason: null,
  },
  {
    id: 'evt_ws_clean_code',
    slug: 'clean-code-design-pattern-co-ban',
    title: 'Clean Code & Design Pattern cơ bản',
    description:
      'Workshop hai phím về viết code sạch và các design pattern thông dụng: đặt tên, hàm ngắn, nguyên tắc SOLID qua ví dụ thực tế của các dự án trong CLB.\n\nCó phần thực hành trên máy, mang theo laptop.',
    coverImageUrl: null,
    eventType: 'Workshop',
    status: 'PUBLISHED',
    startAt: at(6, 14, 0),
    endAt: at(6, 17, 0),
    location: 'Lab Công Nghệ UMT',
    onlineUrl: null,
    departmentName: 'Ban Chuyên môn',
    contactPoint: 'Ban Chuyên môn APC',
    registrationOpensAt: at(-7, 0, 0),
    registrationClosesAt: at(5, 23, 59),
    capacity: null,
    cancelReason: null,
  },
  {
    id: 'evt_ct_ideathon',
    slug: 'ideathon-2026',
    title: 'Cuộc thi Ideathon 2026',
    description: 'Sân chơi ý tưởng khởi nguồn cho sinh viên UMT: đăng ký đội, trình bày ý tưởng trong 10 phút và nhận phản hồi từ Ban giám khảo.',
    coverImageUrl: null,
    eventType: 'Cuộc thi',
    status: 'CANCELLED',
    startAt: at(9, 8, 0),
    endAt: at(9, 17, 0),
    location: 'Hội trường A',
    onlineUrl: null,
    departmentName: 'Ban Sự kiện',
    contactPoint: 'Ban Sự kiện APC',
    registrationOpensAt: at(-7, 0, 0),
    registrationClosesAt: at(8, 23, 59),
    capacity: 60,
    cancelReason: 'Trùng lịch kiểm tra giữa kỳ của trường, Ban tổ chức xin phép dời sang học kỳ sau.',
  },
  {
    id: 'evt_ct_algochallenge',
    slug: 'apc-algorithmic-challenge-4',
    title: 'APC Algorithmic Challenge #4',
    description:
      'Cuộc thi lập trình thi đấu dành cho sinh viên UMT: 8 bài toán từ dễ đến khó trong 4 giờ, chấm tự động trên hệ thống online judge.\n\nThi cá nhân, mang theo laptop và tài khoản Codeforces.',
    coverImageUrl: null,
    eventType: 'Cuộc thi',
    status: 'PUBLISHED',
    startAt: at(13, 8, 0),
    endAt: at(13, 12, 0),
    location: 'Lab Công Nghệ UMT',
    onlineUrl: null,
    departmentName: 'Ban Chuyên môn',
    contactPoint: 'Ban Chuyên môn APC',
    registrationOpensAt: at(-7, 0, 0),
    registrationClosesAt: at(12, 23, 59),
    capacity: 50,
    cancelReason: null,
  },
  {
    id: 'evt_tt_ai',
    slug: 'tuong-lai-cua-ai-trong-lap-trinh',
    title: 'Tương lai của AI trong lập trình phần mềm',
    description:
      'Tech Talk cùng các cựu thành viên APC đang làm việc trong ngành: AI pair programming, công cụ sinh code và kỹ năng lập trình viên cần chuẩn bị.\n\nCó phần hỏi đáp trực tiếp với diễn giả.',
    coverImageUrl: null,
    eventType: 'Tech Talk',
    status: 'PUBLISHED',
    startAt: at(20, 15, 0),
    endAt: at(20, 17, 0),
    location: 'Hội trường A',
    onlineUrl: null,
    departmentName: 'Ban Chuyên môn',
    contactPoint: 'Ban Chuyên môn APC',
    registrationOpensAt: at(5, 0, 0),
    registrationClosesAt: at(19, 23, 59),
    capacity: 120,
    cancelReason: null,
  },
  {
    id: 'evt_training_docker',
    slug: 'docker-cho-nguoi-moi-bat-dau',
    title: 'Training: Docker cho người mới bắt đầu',
    description:
      'Hình ảnh, container, volume và docker compose qua ví dụ đóng gói một ứng dụng web nhỏ. Buổi trực tuyến, không cần kinh nghiệm trước đó.',
    coverImageUrl: null,
    eventType: 'Training',
    status: 'PUBLISHED',
    startAt: at(27, 18, 30),
    endAt: at(27, 20, 30),
    location: null,
    onlineUrl: 'https://meet.google.com/apc-training',
    departmentName: 'Ban Chuyên môn',
    contactPoint: 'Ban Chuyên môn APC',
    registrationOpensAt: at(-1, 0, 0),
    registrationClosesAt: at(25, 23, 59),
    capacity: 40,
    cancelReason: null,
  },
  {
    id: 'evt_hackathon',
    slug: 'apc-mini-hackathon-build-in-24h',
    title: 'APC Mini Hackathon — Build in 24h',
    description:
      '24 giờ để lên ý tưởng, xây dựng và thuyết trình một sản phẩm phần mềm hoàn chỉnh theo chủ đề công bố tại chỗ. Đội 3–4 thành viên, có mentor kèm mỗi đội.\n\nDiễn ra liên tục từ sáng đến sáng hôm sau, CLB chuẩn bị bữa tối và đồ ăn nhẹ.',
    coverImageUrl: null,
    eventType: 'Hackathon',
    status: 'PUBLISHED',
    startAt: at(34, 8, 0),
    endAt: at(35, 8, 0),
    location: 'Hội trường B',
    onlineUrl: null,
    departmentName: 'Ban Sự kiện',
    contactPoint: 'Ban Sự kiện APC',
    registrationOpensAt: at(-7, 0, 0),
    registrationClosesAt: at(33, 23, 59),
    capacity: 80,
    cancelReason: null,
  },
  {
    id: 'evt_ws_react',
    slug: 'workshop-nhap-mon-react',
    title: 'Workshop: Nhập môn React',
    description: 'Component, state và props qua bài thực hành dựng một trang blog nhỏ. Dành cho thành viên mới vào ban Chuyên môn.',
    coverImageUrl: null,
    eventType: 'Workshop',
    status: 'ENDED',
    startAt: at(-5, 14, 0),
    endAt: at(-5, 17, 0),
    location: 'Lab Công Nghệ UMT',
    onlineUrl: null,
    departmentName: 'Ban Chuyên môn',
    contactPoint: 'Ban Chuyên môn APC',
    registrationOpensAt: at(-19, 0, 0),
    registrationClosesAt: at(-6, 23, 59),
    capacity: 35,
    cancelReason: null,
  },
  {
    id: 'evt_tt_microservices',
    slug: 'tech-talk-kien-truc-microservices',
    title: 'Tech Talk: Kiến trúc microservices',
    description: 'Chia sẻ thực tế về tách dịch vụ, giao tiếp giữa các service và những cái giá phải trả khi hệ thống lớn dần.',
    coverImageUrl: null,
    eventType: 'Tech Talk',
    status: 'ENDED',
    startAt: at(-20, 15, 0),
    endAt: at(-20, 17, 0),
    location: null,
    onlineUrl: 'https://meet.google.com/apc-techtalk',
    departmentName: 'Ban Chuyên môn',
    contactPoint: 'Ban Chuyên môn APC',
    registrationOpensAt: at(-34, 0, 0),
    registrationClosesAt: at(-21, 23, 59),
    capacity: null,
    cancelReason: null,
  },
]

function toListItem(event: MockEvent): EventListItem {
  return {
    slug: event.slug,
    title: event.title,
    coverImageUrl: event.coverImageUrl,
    eventType: event.eventType,
    status: event.status,
    startAt: event.startAt,
    endAt: event.endAt,
    location: event.location,
    onlineUrl: event.onlineUrl,
  }
}

// Chế độ mô phỏng lỗi để chụp ảnh trạng thái trang: mở ?mock=error trên bất kỳ trang sự kiện nào. Bỏ khi E2 nối API thật.
function assertNotSimulatingError(): void {
  if (new URLSearchParams(window.location.search).get('mock') === 'error') {
    throw new ApiError(500, 'internal', 'Lỗi mô phỏng (mock) để kiểm tra trạng thái lỗi của trang.')
  }
}

const MOCK_LATENCY_MS = 350

async function respond<T>(data: () => T): Promise<T> {
  await new Promise((resolve) => setTimeout(resolve, MOCK_LATENCY_MS))
  assertNotSimulatingError()
  return data()
}

export type ListEventsParams = { page?: number; pageSize?: number; type?: string | null; month?: string | null }

/** Bề mặt giả của GET /public/events?page=&pageSize=&type=&month= (E2). */
export async function listEvents({ page = 1, pageSize = 9, type, month }: ListEventsParams = {}): Promise<Page<EventListItem>> {
  return respond(() => {
    let events = [...MOCK_EVENTS]
    if (type) events = events.filter((event) => event.eventType === type)
    if (month) {
      events = events
        .filter((event) => monthKeyOf(event.startAt) === month)
        .sort((a, b) => a.startAt.localeCompare(b.startAt))
    } else {
      const now = Date.now()
      const rank = (event: MockEvent) => {
        if (event.status === 'PUBLISHED' && new Date(event.endAt).getTime() >= now) return 0
        return event.status === 'CANCELLED' ? 1 : 2
      }
      // Sắp diễn ra (gần nhất trước) → đã hủy → đã kết thúc (mới nhất trước).
      events.sort((a, b) => {
        const rankA = rank(a)
        const rankB = rank(b)
        if (rankA !== rankB) return rankA - rankB
        return rankA === 0 ? a.startAt.localeCompare(b.startAt) : b.startAt.localeCompare(a.startAt)
      })
    }
    const start = (page - 1) * pageSize
    return { items: events.slice(start, start + pageSize).map(toListItem), total: events.length, page, pageSize }
  })
}

/** Bề mặt giả của GET /public/events/:slug (E2). */
export async function getEventBySlug(slug: string): Promise<EventDetail> {
  return respond(() => {
    const event = MOCK_EVENTS.find((candidate) => candidate.slug === slug)
    if (!event) throw new ApiError(404, 'not_found', 'Không tìm thấy sự kiện hoặc sự kiện không còn công khai.')
    return event
  })
}

/** 4 sự kiện trên trang chủ — trùng dữ liệu mock để card dẫn tới trang chi tiết có thật. E2 thay bằng API. */
export function homeEvents(): EventListItem[] {
  const order = ['clean-code-design-pattern-co-ban', 'apc-algorithmic-challenge-4', 'tuong-lai-cua-ai-trong-lap-trinh', 'apc-mini-hackathon-build-in-24h']
  return order
    .map((slug) => MOCK_EVENTS.find((event) => event.slug === slug))
    .filter((event) => event !== undefined)
    .map(toListItem)
}

export const DEFAULT_MONTH_KEY = currentMonthKey()

import { StatusScreen } from '../../components/StatusScreen'

/** Trang tạm cho mục menu portal/quản trị chưa có trang thật (A3). Thay bằng `page` trong src/lib/menu.ts. */
export function AreaPlaceholder({ title }: { title: string }) {
  return <StatusScreen compact code="···" title={title} text="Trang này đang được xây dựng." />
}

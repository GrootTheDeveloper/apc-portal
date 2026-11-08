import { StatusScreen } from '../components/StatusScreen'

/** Trang tạm cho route đã khai báo nhưng chưa dựng nội dung. Thay bằng trang thật ở các task sau. */
export function Placeholder({ title }: { title: string }) {
  return <StatusScreen code="wip" title={title} text="Trang này đang được xây dựng." />
}

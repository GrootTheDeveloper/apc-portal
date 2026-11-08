import { Link } from 'react-router-dom'

import { buttonClass } from '../components/buttonClass'
import { StatusScreen } from '../components/StatusScreen'

/** PAGE-SYS-02. Dữ liệu ngoài phạm vi ban cũng hiện trang này (API trả 404). `compact` khi nằm trong khung portal/quản trị. */
export function NotFound({ compact = false, home = '/' }: { compact?: boolean; home?: string }) {
  return (
    <StatusScreen
      compact={compact}
      code="404"
      title="Không tìm thấy trang"
      text="Đường dẫn không tồn tại hoặc đã được chuyển đi."
      action={
        <Link className={buttonClass()} to={home}>
          {home === '/' ? 'Về trang chủ' : 'Về trang đầu khu này'}
        </Link>
      }
    />
  )
}

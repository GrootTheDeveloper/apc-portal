import { Link } from 'react-router-dom'

import { buttonClass } from '../components/buttonClass'
import { StatusScreen } from '../components/StatusScreen'

/** PAGE-SYS-03: đã đăng nhập nhưng không có quyền mở trang này. `compact` khi nằm trong khung portal/quản trị. */
export function Forbidden({ compact = false }: { compact?: boolean }) {
  return (
    <StatusScreen
      compact={compact}
      code="403"
      title="Không có quyền truy cập"
      text="Tài khoản của bạn không có quyền mở trang này."
      action={
        <Link className={buttonClass()} to="/portal">
          Về trang thành viên
        </Link>
      }
    />
  )
}

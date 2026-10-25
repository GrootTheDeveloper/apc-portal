import { Link } from 'react-router-dom'

import { buttonClass } from '../components/buttonClass'
import { StatusScreen } from '../components/StatusScreen'

/** PAGE-SYS-03: đã đăng nhập nhưng không có quyền mở trang này. */
export function Forbidden() {
  return (
    <StatusScreen
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

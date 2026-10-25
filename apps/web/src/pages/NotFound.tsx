import { Link } from 'react-router-dom'

import { buttonClass } from '../components/buttonClass'
import { StatusScreen } from '../components/StatusScreen'

export function NotFound() {
  return (
    <StatusScreen
      code="404"
      title="Không tìm thấy trang"
      text="Đường dẫn không tồn tại hoặc đã được chuyển đi."
      action={
        <Link className={buttonClass()} to="/">
          Về trang chủ
        </Link>
      }
    />
  )
}

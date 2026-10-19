import { useNavigate } from 'react-router-dom'

import { Button } from '../components/Button'
import { Eyebrow } from '../components/Eyebrow'

/** PAGE-SYS-03: đã đăng nhập nhưng không có quyền mở trang này. */
export function Forbidden() {
  const navigate = useNavigate()
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-container-max flex-col items-center justify-center px-gutter py-24 text-center">
      <Eyebrow>403</Eyebrow>
      <h1 className="mt-4 text-3xl font-bold text-on-surface md:text-4xl">Không có quyền truy cập</h1>
      <p className="mt-3 text-on-surface-variant">Tài khoản của bạn không có quyền mở trang này.</p>
      <Button className="mt-6" onClick={() => navigate('/portal')}>
        Về trang thành viên
      </Button>
    </main>
  )
}

import { useNavigate } from 'react-router-dom'

import { Button } from './home/sections/Button'
import { Eyebrow } from './home/sections/Eyebrow'

export function NotFound() {
  const navigate = useNavigate()
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-container-max flex-col items-center justify-center px-gutter py-24 text-center">
      <Eyebrow>404</Eyebrow>
      <h1 className="mt-4 text-3xl font-bold text-on-surface md:text-4xl">Không tìm thấy trang</h1>
      <p className="mt-3 text-on-surface-variant">Đường dẫn không tồn tại hoặc đã được chuyển đi.</p>
      <Button className="mt-6" onClick={() => navigate('/')}>
        Về trang chủ
      </Button>
    </main>
  )
}

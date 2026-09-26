import { useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'

import { Navbar } from './Navbar'
import { SiteFooter } from './SiteFooter'

/** Layout dùng chung: Navbar + nội dung route (Outlet) + SiteFooter. Mỗi trang tự bọc <main> của mình. */
export function RootLayout() {
  const { pathname, hash } = useLocation()

  // Link như /#activities từ trang khác: trình duyệt tìm anchor trước khi React render, nên tự cuộn sau khi render.
  useEffect(() => {
    // instant: cuộn mượt bị ngắt khi ảnh còn đang tải làm đổi layout.
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: 'instant' })
  }, [pathname, hash])

  return (
    <>
      <Navbar />
      <Outlet />
      <SiteFooter />
    </>
  )
}

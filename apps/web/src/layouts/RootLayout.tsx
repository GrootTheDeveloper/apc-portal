import { useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'

import { useReveal } from '../hooks/useReveal'
import { Navbar } from './Navbar'
import { SiteFooter } from './SiteFooter'

/**
 * Layout dùng chung: Navbar + nội dung route (Outlet) + SiteFooter. Mỗi trang tự bọc <main> của mình.
 * Nội dung nằm trong `.site-body` (nền đặc, z-index cao hơn) để footer dính đáy lộ ra như kéo rèm khi cuộn hết trang.
 */
export function RootLayout() {
  const { pathname, hash } = useLocation()
  useReveal(pathname)

  // Link như /#activities từ trang khác: trình duyệt tìm anchor trước khi React render, nên tự cuộn sau khi render.
  useEffect(() => {
    // instant: cuộn mượt bị ngắt khi ảnh còn đang tải làm đổi layout.
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: 'instant' })
  }, [pathname, hash])

  return (
    <>
      <div id="top" className="site-body">
        <Navbar />
        <Outlet />
      </div>
      <SiteFooter />
      {/* mốc cuối trang cho cuộn hít (home.css) */}
      <div aria-hidden className="snap-end h-px" />
    </>
  )
}

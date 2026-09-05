import { Outlet } from 'react-router-dom'

import { Navbar } from '../pages/home/sections/Navbar'
import { SiteFooter } from '../pages/home/sections/SiteFooter'

/** Layout dùng chung: Navbar + nội dung route (Outlet) + SiteFooter. Mỗi trang tự bọc <main> của mình. */
export function RootLayout() {
  return (
    <>
      <Navbar />
      <Outlet />
      <SiteFooter />
    </>
  )
}

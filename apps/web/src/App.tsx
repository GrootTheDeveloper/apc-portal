import { createBrowserRouter, RouterProvider } from 'react-router-dom'

import { RootLayout } from './layouts/RootLayout'
import { HomePage } from './pages/home/HomePage'
import { NotFound } from './pages/NotFound'
import { Placeholder } from './pages/Placeholder'

const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'about', element: <Placeholder title="Về APC" /> },
      { path: 'news', element: <Placeholder title="Tin tức" /> },
      { path: 'events', element: <Placeholder title="Sự kiện" /> },
      { path: 'projects', element: <Placeholder title="Dự án" /> },
      { path: 'recruitment', element: <Placeholder title="Gia nhập APC" /> },
      { path: 'recruitment/application-lookup', element: <Placeholder title="Tra cứu hồ sơ ứng tuyển" /> },
      { path: 'events/registration-lookup', element: <Placeholder title="Tra cứu đăng ký sự kiện" /> },
      { path: 'privacy', element: <Placeholder title="Chính sách quyền riêng tư" /> },
      { path: 'login', element: <Placeholder title="Đăng nhập" /> },
      { path: 'admin', element: <Placeholder title="Quản trị" /> },
      { path: '*', element: <NotFound /> },
    ],
  },
])

export default function App() {
  return <RouterProvider router={router} />
}

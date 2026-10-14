import { createBrowserRouter, RouterProvider } from 'react-router-dom'

import { RootLayout } from './layouts/RootLayout'
import { NotFound } from './pages/NotFound'
import { Placeholder } from './pages/Placeholder'
import { HomePage } from './pages/home/HomePage'
import { EventDetailPage } from './pages/events/detail/EventDetailPage'
import { EventsListPage } from './pages/events/list/EventsListPage'

const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'about', element: <Placeholder title="Về APC" /> },
      { path: 'news', element: <Placeholder title="Tin tức" /> },
      // Route tĩnh khai báo trước route động /events/:slug (Sitemap §15.1).
      { path: 'events/registration-lookup', element: <Placeholder title="Tra cứu đăng ký sự kiện" /> },
      { path: 'events', element: <EventsListPage /> },
      { path: 'events/:slug', element: <EventDetailPage /> },
      { path: 'projects', element: <Placeholder title="Dự án" /> },
      { path: 'recruitment', element: <Placeholder title="Gia nhập APC" /> },
      { path: 'recruitment/application-lookup', element: <Placeholder title="Tra cứu hồ sơ ứng tuyển" /> },
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

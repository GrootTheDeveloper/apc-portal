import { createBrowserRouter, Outlet, RouterProvider } from 'react-router-dom'

import { AuthProvider } from './components/AuthProvider'
import { RequireAuth } from './components/RequireAuth'
import { RootLayout } from './layouts/RootLayout'
import { ADMIN_ROLES } from './lib/auth'
import { ADMIN_MENU, PORTAL_MENU } from './lib/menu'
import { LoginPage } from './pages/auth/login/LoginPage'
import { EventDetailPage } from './pages/events/detail/EventDetailPage'
import { EventsListPage } from './pages/events/list/EventsListPage'
import { HomePage } from './pages/home/HomePage'
import { MenuPlaceholder } from './pages/MenuPlaceholder'
import { NewsDetailPage } from './pages/news/detail/NewsDetailPage'
import { NewsListPage } from './pages/news/list/NewsListPage'
import { NotFound } from './pages/NotFound'
import { Placeholder } from './pages/Placeholder'
import { ProjectDetailPage } from './pages/projects/detail/ProjectDetailPage'
import { ProjectListPage } from './pages/projects/list/ProjectListPage'

const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'about', element: <Placeholder title="Về APC" /> },
      { path: 'news', element: <NewsListPage /> },
      { path: 'news/:slug', element: <NewsDetailPage /> },
      // Route tĩnh khai báo trước route động /events/:slug (Sitemap §15.1).
      { path: 'events/registration-lookup', element: <Placeholder title="Tra cứu đăng ký sự kiện" /> },
      { path: 'events', element: <EventsListPage /> },
      { path: 'events/:slug', element: <EventDetailPage /> },
      { path: 'projects', element: <ProjectListPage /> },
      { path: 'projects/:slug', element: <ProjectDetailPage /> },
      { path: 'recruitment', element: <Placeholder title="Gia nhập APC" /> },
      { path: 'recruitment/application-lookup', element: <Placeholder title="Tra cứu hồ sơ ứng tuyển" /> },
      { path: 'privacy', element: <Placeholder title="Chính sách quyền riêng tư" /> },
      { path: 'login', element: <LoginPage /> },
      {
        path: 'account/activate',
        element: (
          <RequireAuth>
            <Placeholder title="Kích hoạt tài khoản" />
          </RequireAuth>
        ),
      },
      {
        path: 'portal',
        element: (
          <RequireAuth>
            <Outlet />
          </RequireAuth>
        ),
        children: [{ index: true, element: <MenuPlaceholder title="Trang thành viên" menu={PORTAL_MENU} /> }],
      },
      {
        path: 'admin',
        element: (
          <RequireAuth roles={ADMIN_ROLES}>
            <Outlet />
          </RequireAuth>
        ),
        children: [{ index: true, element: <MenuPlaceholder title="Quản trị" menu={ADMIN_MENU} /> }],
      },
      { path: '*', element: <NotFound /> },
    ],
  },
])

export default function App() {
  return (
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  )
}

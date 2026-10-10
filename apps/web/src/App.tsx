import { createBrowserRouter, Outlet, RouterProvider } from 'react-router-dom'

import { AuthProvider } from './components/AuthProvider'
import { RequireAuth } from './components/RequireAuth'
import { RootLayout } from './layouts/RootLayout'
import { ADMIN_ROLES } from './lib/auth'
import { ADMIN_MENU, PORTAL_MENU } from './lib/menu'
import { LoginPage } from './pages/auth/login/LoginPage'
import { HomePage } from './pages/home/HomePage'
import { MenuPlaceholder } from './pages/MenuPlaceholder'
import { NotFound } from './pages/NotFound'
import { Placeholder } from './pages/Placeholder'

import { PrivacyPage } from './pages/public/PrivacyPage'

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
      { path: 'privacy', element: <PrivacyPage /> },
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

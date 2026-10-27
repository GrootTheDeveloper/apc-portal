import { matchRoutes, Outlet, type RouteObject } from 'react-router-dom'

import { RequireAuth } from './components/RequireAuth'
import { AdminLayout } from './layouts/AdminLayout'
import { PortalLayout } from './layouts/PortalLayout'
import { RootLayout } from './layouts/RootLayout'
import { ADMIN_ROLES } from './lib/auth'
import { ADMIN_MENU, type MenuGroup, menuPages, PORTAL_MENU } from './lib/menu'
import { AboutPage } from './pages/about/AboutPage'
import { ActivatePage } from './pages/account/activate/ActivatePage'
import { AreaPlaceholder } from './pages/area/AreaPlaceholder'
import { EventDetailPage } from './pages/events/detail/EventDetailPage'
import { EventsListPage } from './pages/events/list/EventsListPage'
import { HomePage } from './pages/home/HomePage'
import { NewsDetailPage } from './pages/news/detail/NewsDetailPage'
import { NewsListPage } from './pages/news/list/NewsListPage'
import { NotFound } from './pages/NotFound'
import { Placeholder } from './pages/Placeholder'
import { PrivacyPage } from './pages/privacy/PrivacyPage'
import { ProjectDetailPage } from './pages/projects/detail/ProjectDetailPage'
import { ProjectListPage } from './pages/projects/list/ProjectListPage'
import { RecruitmentDetailPage } from './pages/recruitment/detail/RecruitmentDetailPage'
import { RecruitmentListPage } from './pages/recruitment/list/RecruitmentListPage'

// MỌI route của web khai báo ở đây (A3). `isAppPath` bên dưới đọc thẳng cây này để kiểm `returnTo`,
// nên thêm route mới chỉ cần khai báo một lần. Trang portal/quản trị khai báo trong src/lib/menu.ts
// (menu và route sinh từ cùng một mảng).

/** Route con của /portal hoặc /admin sinh từ menu: mỗi trang tự chặn theo `roles` của nó. */
function areaRoutes(menu: readonly MenuGroup[], root: string): RouteObject[] {
  return menuPages(menu).map(({ page }) => {
    const path = page.to === root ? undefined : page.to.slice(root.length + 1)
    const content: RouteObject = page.page
      ? { index: true, lazy: page.page }
      : { index: true, element: <AreaPlaceholder title={page.label} /> }
    return {
      ...(path ? { path } : {}),
      element: (
        <RequireAuth roles={page.roles}>
          <Outlet />
        </RequireAuth>
      ),
      children: [content],
    }
  })
}

export const appRoutes: RouteObject[] = [
  {
    path: '/',
    element: <RootLayout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'about', element: <AboutPage /> },
      { path: 'news', element: <NewsListPage /> },
      { path: 'news/:slug', element: <NewsDetailPage /> },
      // Route tĩnh khai báo trước route động /events/:slug (Sitemap §15.1).
      { path: 'events/registration-lookup', element: <Placeholder title="Tra cứu đăng ký sự kiện" /> },
      { path: 'events', element: <EventsListPage /> },
      { path: 'events/:slug', element: <EventDetailPage /> },
      { path: 'projects', element: <ProjectListPage /> },
      { path: 'projects/:slug', element: <ProjectDetailPage /> },
      { path: 'recruitment', element: <RecruitmentListPage /> },
      { path: 'recruitment/application-lookup', element: <Placeholder title="Tra cứu hồ sơ ứng tuyển" /> },
      { path: 'recruitment/:slug', element: <RecruitmentDetailPage /> },
      { path: 'privacy', element: <PrivacyPage /> },
      // Trang đăng nhập tải lười để tránh vòng import (LoginPage dùng `isAppPath` của file này).
      { path: 'login', lazy: () => import('./pages/auth/login/LoginPage').then((m) => ({ Component: m.LoginPage })) },
      {
        path: 'account/activate',
        element: (
          <RequireAuth gate="activation">
            <ActivatePage />
          </RequireAuth>
        ),
      },
      // Hai trang 2 lớp thuộc B3; tạm là trang đang xây dựng để route guard có chỗ chuyển tới.
      {
        path: 'account/setup-two-factor',
        element: (
          <RequireAuth gate="two-factor">
            <Placeholder title="Thiết lập xác thực hai bước" />
          </RequireAuth>
        ),
      },
      {
        path: 'account/two-factor',
        element: (
          <RequireAuth gate="two-factor">
            <Placeholder title="Xác thực hai bước" />
          </RequireAuth>
        ),
      },
      {
        path: 'portal',
        element: (
          <RequireAuth>
            <PortalLayout />
          </RequireAuth>
        ),
        children: [...areaRoutes(PORTAL_MENU, '/portal'), { path: '*', element: <NotFound /> }],
      },
      {
        path: 'admin',
        element: (
          <RequireAuth roles={ADMIN_ROLES}>
            <AdminLayout />
          </RequireAuth>
        ),
        children: [...areaRoutes(ADMIN_MENU, '/admin'), { path: '*', element: <NotFound /> }],
      },
      { path: '*', element: <NotFound /> },
    ],
  },
]

/** Đường dẫn có route thật (không rơi vào trang 404 `*`). Dùng cho `safeReturnTo` sau đăng nhập. */
export function isAppPath(pathname: string): boolean {
  const matches = matchRoutes(appRoutes, pathname)
  const last = matches?.at(-1)?.route
  return !!last && last.path !== '*'
}

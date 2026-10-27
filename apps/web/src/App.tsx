import { createBrowserRouter, Outlet, RouterProvider } from 'react-router-dom'

import { AuthProvider } from './components/AuthProvider'
import { RequireAuth } from './components/RequireAuth'
import { RootLayout } from './layouts/RootLayout'
import { ADMIN_ROLES } from './lib/auth'
import { ADMIN_MENU, PORTAL_MENU } from './lib/menu'
import { AboutPage } from './pages/about/AboutPage'
import { LoginPage } from './pages/auth/login/LoginPage'
import { EventDetailPage } from './pages/events/detail/EventDetailPage'
import { EventsListPage } from './pages/events/list/EventsListPage'
import { HomePage } from './pages/home/HomePage'
import { MenuPlaceholder } from './pages/MenuPlaceholder'
import { NewsDetailPage } from './pages/news/detail/NewsDetailPage'
import { NewsListPage } from './pages/news/list/NewsListPage'
import { NotFound } from './pages/NotFound'
import { Placeholder } from './pages/Placeholder'
import { PrivacyPage } from './pages/privacy/PrivacyPage'
import { ProjectDetailPage } from './pages/projects/detail/ProjectDetailPage'
import { ProjectListPage } from './pages/projects/list/ProjectListPage'
import { RecruitmentDetailPage } from './pages/recruitment/detail/RecruitmentDetailPage'
import { RecruitmentListPage } from './pages/recruitment/list/RecruitmentListPage'
import { AdminRecruitmentDetailPage } from './pages/admin/recruitment/AdminRecruitmentDetailPage'
import { AdminRecruitmentEditPage } from './pages/admin/recruitment/AdminRecruitmentEditPage'
import { AdminRecruitmentListPage } from './pages/admin/recruitment/AdminRecruitmentListPage'
import { AdminRecruitmentNewPage } from './pages/admin/recruitment/AdminRecruitmentNewPage'
import { AdminRecruitmentPreviewPage } from './pages/admin/recruitment/AdminRecruitmentPreviewPage'

const router = createBrowserRouter([
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
        children: [
          { index: true, element: <MenuPlaceholder title="Quản trị" menu={ADMIN_MENU} /> },
          { path: 'recruitment', element: <AdminRecruitmentListPage /> },
          { path: 'recruitment/new', element: <AdminRecruitmentNewPage /> },
          { path: 'recruitment/:id', element: <AdminRecruitmentDetailPage /> },
          { path: 'recruitment/:id/edit', element: <AdminRecruitmentEditPage /> },
          { path: 'recruitment/:id/preview', element: <AdminRecruitmentPreviewPage /> },
        ],
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

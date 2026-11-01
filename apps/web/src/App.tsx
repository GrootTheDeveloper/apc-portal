import { createBrowserRouter, RouterProvider } from 'react-router-dom'

import { AuthProvider } from './components/AuthProvider'
import { appRoutes } from './routes'

// Route khai báo ở src/routes.tsx (trang công khai) và src/lib/menu.ts (trang portal, quản trị).
const router = createBrowserRouter(appRoutes)

export default function App() {
  return (
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  )
}

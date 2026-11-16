import { ADMIN_MENU } from '../lib/menu'
import { AreaLayout } from './AreaLayout'

/** Khung các trang /admin/* (Sitemap mục 8, 10). Menu sửa ở `ADMIN_MENU` trong src/lib/menu.ts. */
export function AdminLayout() {
  return <AreaLayout title="Quản trị" root="/admin" menu={ADMIN_MENU} />
}

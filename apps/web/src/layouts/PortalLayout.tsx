import { PORTAL_MENU } from '../lib/menu'
import { AreaLayout } from './AreaLayout'

/** Khung các trang /portal/* (Sitemap mục 7). Menu sửa ở `PORTAL_MENU` trong src/lib/menu.ts. */
export function PortalLayout() {
  return <AreaLayout title="Portal" root="/portal" menu={PORTAL_MENU} />
}

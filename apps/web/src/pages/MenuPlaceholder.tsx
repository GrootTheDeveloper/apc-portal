import { Link } from 'react-router-dom'

import { Eyebrow } from '../components/Eyebrow'
import { useAuth } from '../hooks/useAuth'
import { type MenuItem, visibleMenu } from '../lib/menu'

/** Trang tạm cho /portal và /admin: liệt kê menu người dùng được thấy. Layout thật làm ở A3. */
export function MenuPlaceholder({ title, menu }: { title: string; menu: readonly MenuItem[] }) {
  const { user } = useAuth()
  const items = visibleMenu(menu, user)

  return (
    <main className="mx-auto flex min-h-[60vh] max-w-container-max flex-col px-gutter py-16">
      <Eyebrow>APC Portal</Eyebrow>
      <h1 className="mt-4 text-3xl font-bold text-on-surface md:text-4xl">{title}</h1>
      <p className="mt-3 text-on-surface-variant">Xin chào {user?.fullName}. Các trang đang được xây dựng.</p>
      <nav aria-label={title} className="mt-8">
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <li key={item.to}>
              <Link
                to={item.to}
                className="block rounded-apc border border-outline-variant bg-surface-container-lowest px-5 py-4 text-on-surface transition-colors hover:border-apc-blue hover:text-apc-blue"
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </main>
  )
}

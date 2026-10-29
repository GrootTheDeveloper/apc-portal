import { Link } from 'react-router-dom'

import { PageHero } from '../components/PageHero'
import { useAuth } from '../hooks/useAuth'
import { type MenuItem, visibleMenu } from '../lib/menu'

/** Trang tạm cho /portal và /admin: liệt kê menu người dùng được thấy. Layout thật làm ở A3. */
export function MenuPlaceholder({ title, menu }: { title: string; menu: readonly MenuItem[] }) {
  const { user } = useAuth()
  const items = visibleMenu(menu, user)

  return (
    <main>
      <PageHero comment="apc portal" title={title} lede={`Xin chào ${user?.fullName ?? ''}. Các trang đang được xây dựng.`} />
      <section className="px-4 py-[clamp(40px,7vh,80px)] md:px-8">
        <nav aria-label={title} className="mx-auto w-full max-w-container-max">
          <ul className="grid border-t-2 border-ink sm:grid-cols-2 sm:gap-x-10 lg:grid-cols-3">
            {items.map((item) => (
              <li key={item.to} className="border-b-2 border-ink">
                <Link
                  to={item.to}
                  className="group flex min-h-16 items-center justify-between gap-4 py-4 font-display text-[22px] font-bold transition-colors hover:text-apc-red"
                >
                  {item.label}
                  <span aria-hidden className="transition-transform group-hover:translate-x-1">
                    →
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </section>
    </main>
  )
}

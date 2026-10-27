import { Link } from 'react-router-dom'

export type BreadcrumbItem = {
  label: string
  to?: string
}

/** Breadcrumb viết như đường dẫn thư mục (`trang chủ / sự kiện / …`). Màu chữ kế thừa từ nền đặt nó. */
export function Breadcrumb({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 font-code text-[14px] font-bold">
        {items.map((item, index) => {
          const isLast = index === items.length - 1
          return (
            <li key={`${item.label}-${index}`} className="flex min-w-0 items-center gap-2">
              {index > 0 && (
                <span aria-hidden className="opacity-50">
                  /
                </span>
              )}
              {isLast || !item.to ? (
                <span aria-current="page" className="max-w-[240px] truncate opacity-70 sm:max-w-[480px]">
                  {item.label}
                </span>
              ) : (
                <Link to={item.to} className="underline decoration-2 underline-offset-4 opacity-90 hover:opacity-100">
                  {item.label}
                </Link>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

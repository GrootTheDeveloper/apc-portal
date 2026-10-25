import { Link } from 'react-router-dom'

import type { ProjectItem, ProjectType } from '../pages/projects/list/mock'

// Class literal để Tailwind JIT nhận diện được.
const TYPE_COLORS: Record<ProjectType, string> = {
  'Nền tảng': 'text-apc-red',
  'Công cụ': 'text-apc-blue',
  'Sản phẩm': 'text-apc-gold-deep',
}

/** Card dự án: ảnh chụp sản phẩm (chưa có thì khung nhạt ghi tên thư mục như dòng lệnh), loại, tên, công nghệ. */
export function ProjectCard({ item }: { item: ProjectItem }) {
  return (
    <Link to={`/projects/${item.slug}`} className="group flex min-w-0 flex-col">
      {item.imageUrl ? (
        <div className="photo aspect-[16/10] bg-soft">
          <img alt="" className="h-full" loading="lazy" src={item.imageUrl} />
        </div>
      ) : (
        <div className="flex aspect-[16/10] flex-col justify-end rounded-[20px] bg-soft p-5 font-code text-[14px] font-bold text-ink/50">
          <span>
            <span className="text-apc-blue">apc@umt</span>:~$ cd
          </span>
          <span className="truncate text-[17px] text-ink transition-colors group-hover:text-apc-red">{item.slug}/</span>
        </div>
      )}

      <p className={`mt-4 font-code text-[13px] font-bold ${TYPE_COLORS[item.type] ?? 'text-apc-blue'}`}>{item.type}</p>
      <h3 className="mt-1 font-display text-[22px] font-bold leading-[1.15] transition-colors group-hover:text-apc-red">{item.name}</h3>
      <p className="mt-2 line-clamp-2 text-[15px] leading-relaxed text-muted">{item.description}</p>
      {item.technologies.length > 0 && (
        <ul className="mt-auto flex flex-wrap gap-1.5 pt-4" aria-label="Công nghệ">
          {item.technologies.map((tag) => (
            <li key={tag} className="rounded-md bg-soft px-2 py-0.5 font-code text-[12px] font-bold">
              {tag}
            </li>
          ))}
        </ul>
      )}
    </Link>
  )
}

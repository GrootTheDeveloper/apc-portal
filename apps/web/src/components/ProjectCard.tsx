import { Link } from 'react-router-dom'

import type { ProjectItem } from '../lib/content'

/** Card dự án: ảnh chụp sản phẩm (chưa có thì khung nhạt ghi tên thư mục như dòng lệnh), tên, mô tả, công nghệ. */
export function ProjectCard({ item }: { item: ProjectItem }) {
  const technologies = item.technologies ?? []

  return (
    <Link to={`/projects/${item.slug}`} className="group flex min-w-0 flex-col">
      {item.thumbnailUrl ? (
        <div className="photo aspect-[16/10] bg-soft">
          <img alt="" className="h-full" loading="lazy" src={item.thumbnailUrl} />
        </div>
      ) : (
        <div className="flex aspect-[16/10] flex-col justify-end rounded-[20px] bg-soft p-5 font-code text-[14px] font-bold text-ink/50">
          <span>
            <span className="text-apc-blue">apc@umt</span>:~$ cd
          </span>
          <span className="truncate text-[17px] text-ink transition-colors group-hover:text-apc-red">{item.slug}/</span>
        </div>
      )}

      <h3 className="mt-4 font-display text-[22px] font-bold leading-[1.15] transition-colors group-hover:text-apc-red">{item.title}</h3>
      <p className="mt-2 line-clamp-2 text-[15px] leading-relaxed text-muted">{item.description}</p>
      {technologies.length > 0 && (
        <ul className="mt-auto flex flex-wrap gap-1.5 pt-4" aria-label="Công nghệ">
          {technologies.map((tag) => (
            <li key={tag} className="rounded-md bg-soft px-2 py-0.5 font-code text-[12px] font-bold">
              {tag}
            </li>
          ))}
        </ul>
      )}
    </Link>
  )
}

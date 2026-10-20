import { Link } from 'react-router-dom'

import { getProjectTypeColorClass, type ProjectItem } from '../lib/content'

type ProjectCardProps = {
  item: ProjectItem
  layout?: 'standard' | 'featured'
  className?: string
}

/** Card hiển thị dự án, giữ nguyên visual style từ ProjectsSection */
export function ProjectCard({ item, layout = 'standard', className = '' }: ProjectCardProps) {
  const typeText = item.type || 'Dự án'
  const typeColorClass = getProjectTypeColorClass(typeText)
  const title = item.title || item.name || ''
  const imageUrl = item.thumbnailUrl || item.imageUrl
  const technologies = Array.isArray(item.technologies) ? item.technologies : []

  if (layout === 'featured') {
    return (
      <Link
        to={`/projects/${item.slug}`}
        className={`group bg-white rounded-2xl overflow-hidden shadow-lg hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 cursor-pointer flex flex-col md:flex-row ${className}`}
      >
        <div className="md:w-[45%] overflow-hidden">
          {imageUrl ? (
            <img alt={title} className="w-full h-56 md:h-full object-cover" src={imageUrl} />
          ) : (
            <div className="w-full h-56 md:h-full flex items-center justify-center bg-gradient-to-br from-apc-red/15 to-surface-container-high">
              <span className="material-symbols-outlined text-6xl text-apc-red/50">rocket_launch</span>
            </div>
          )}
        </div>
        <div className="md:w-[55%] p-7 flex flex-col gap-3 justify-center">
          <span className={`${typeColorClass} text-xs font-bold uppercase tracking-wider`}>{typeText}</span>
          <h3 className="font-display-lg text-2xl font-bold text-on-surface">{title}</h3>
          <p className="text-on-surface-variant leading-relaxed">{item.description}</p>
          {technologies.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {technologies.map((tag) => (
                <span
                  key={tag}
                  className="px-3 py-1 bg-surface-container-highest text-on-surface-variant rounded-full text-sm font-medium"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
          <span className="text-apc-red font-bold flex items-center gap-2 mt-1 group-hover:gap-3 transition-all">
            Trải nghiệm ngay <span className="material-symbols-outlined">arrow_forward</span>
          </span>
        </div>
      </Link>
    )
  }

  return (
    <Link
      to={`/projects/${item.slug}`}
      className={`group bg-white rounded-2xl overflow-hidden shadow-lg hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 cursor-pointer flex flex-col ${className}`}
    >
      <div className="overflow-hidden">
        {imageUrl ? (
          <img alt={title} className="w-full h-44 object-cover" src={imageUrl} />
        ) : (
          <div className="w-full h-44 flex items-center justify-center bg-gradient-to-br from-apc-blue/15 to-surface-container-high">
            <span className="material-symbols-outlined text-5xl text-apc-blue/50">code</span>
          </div>
        )}
      </div>
      <div className="p-6 flex flex-col gap-2 flex-1">
        <span className={`${typeColorClass} text-xs font-bold uppercase tracking-wider`}>{typeText}</span>
        <h3 className="font-bold text-xl text-on-surface">{title}</h3>
        <p className="text-on-surface-variant text-sm line-clamp-2 flex-1">{item.description}</p>
        {technologies.length > 0 && (
          <div className="flex flex-wrap gap-1.5 my-1">
            {technologies.map((tag) => (
              <span
                key={tag}
                className="px-2.5 py-0.5 bg-surface-container-highest text-on-surface-variant rounded-full text-xs font-medium"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
        <span className="text-apc-blue font-bold flex items-center gap-2 mt-2 group-hover:gap-3 transition-all">
          Xem chi tiết <span className="material-symbols-outlined">arrow_forward</span>
        </span>
      </div>
    </Link>
  )
}

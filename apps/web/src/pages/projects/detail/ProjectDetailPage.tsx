import { useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'

import { AsyncState } from '../../../components/AsyncState'
import { Breadcrumb } from '../../../components/Breadcrumb'
import { useApi } from '../../../hooks/useApi'
import { getProjectTypeColorClass, type ProjectItem } from '../../../lib/content'
import { NotFound } from '../../NotFound'

/** Trang chi tiết dự án */
export function ProjectDetailPage() {
  const { slug } = useParams<{ slug: string }>()

  const { data: item, loading, error, reload } = useApi<ProjectItem>(
    slug ? `/public/projects/${slug}` : null,
  )

  useEffect(() => {
    if (!item) return
    const title = item.title || item.name || 'Dự án'
    document.title = `${title} — CLB APC`

    const description = item.description || ''
    let metaDesc = document.querySelector('meta[name="description"]')
    if (!metaDesc) {
      metaDesc = document.createElement('meta')
      metaDesc.setAttribute('name', 'description')
      document.head.appendChild(metaDesc)
    }
    metaDesc.setAttribute('content', description)
  }, [item])

  if (!slug) {
    return <NotFound />
  }

  // Khi API trả về 404 (dự án không tồn tại hoặc là DRAFT, ARCHIVED)
  if (!loading && error?.status === 404) {
    return <NotFound />
  }

  // Không tải, không lỗi nhưng không có dữ liệu
  if (!loading && !error && !item) {
    return <NotFound />
  }

  const title = item?.title || item?.name || ''
  const typeText = item?.type || 'Dự án'
  const typeColorClass = getProjectTypeColorClass(typeText)
  const imageUrl = item?.thumbnailUrl || item?.imageUrl
  const productLink = item?.projectUrl || item?.productUrl
  const sourceLink = item?.sourceUrl
  const technologies = Array.isArray(item?.technologies) ? item.technologies : []

  return (
    <main className="w-full min-h-[60vh] py-12 px-gutter bg-white">
      <div className="max-w-5xl mx-auto fade-up w-full">
        <AsyncState
          loading={loading}
          error={error}
          empty={false}
          onRetry={reload}
        >
          {item && (
            <article className="flex flex-col gap-8">
              {/* Breadcrumb */}
              <Breadcrumb
                items={[
                  { label: 'Trang chủ', to: '/' },
                  { label: 'Dự án', to: '/projects' },
                  { label: title },
                ]}
              />

              {/* Header dự án */}
              <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 border-b border-outline-variant/20 pb-6">
                <div>
                  <span className={`${typeColorClass} text-xs font-bold uppercase tracking-wider block mb-2`}>
                    {typeText}
                  </span>
                  <h1 className="font-headline-md text-3xl sm:text-4xl lg:text-5xl font-bold text-on-surface leading-tight">
                    {title}
                  </h1>
                </div>

                {/* Các nút liên kết sản phẩm / mã nguồn */}
                <div className="flex flex-wrap items-center gap-3">
                  {productLink && (
                    <a
                      href={productLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-6 py-2.5 rounded-apc bg-apc-red text-white font-medium hover:bg-[#a0220b] transition-colors shadow-sm text-sm"
                    >
                      Trải nghiệm ngay <span className="material-symbols-outlined text-sm">open_in_new</span>
                    </a>
                  )}
                  {sourceLink && (
                    <a
                      href={sourceLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-6 py-2.5 rounded-apc bg-white text-on-surface border border-outline-variant/30 hover:bg-surface-container-low transition-colors shadow-sm font-medium text-sm"
                    >
                      Mã nguồn <span className="material-symbols-outlined text-sm">code</span>
                    </a>
                  )}
                </div>
              </div>

              {/* Ảnh dự án */}
              {imageUrl ? (
                <div className="w-full aspect-[16/9] max-h-[460px] rounded-2xl overflow-hidden shadow-sm border border-outline-variant/20">
                  <img alt={title} className="w-full h-full object-cover" src={imageUrl} />
                </div>
              ) : (
                <div className="w-full aspect-[16/9] max-h-[460px] rounded-2xl flex items-center justify-center bg-gradient-to-br from-apc-blue/15 to-surface-container-high border border-outline-variant/20 shadow-sm">
                  <span className="material-symbols-outlined text-7xl text-apc-blue/50">rocket_launch</span>
                </div>
              )}

              {/* Mô tả dự án */}
              <section className="bg-surface-container-low/40 rounded-2xl p-6 sm:p-8 border border-outline-variant/20">
                <h2 className="text-xl font-bold text-on-surface mb-3">Mô tả dự án</h2>
                <p className="text-on-surface-variant leading-relaxed text-base sm:text-lg">{item.description}</p>
              </section>

              {/* Công nghệ */}
              {technologies.length > 0 && (
                <section className="bg-white rounded-2xl p-6 sm:p-8 border border-outline-variant/20">
                  <h2 className="text-xl font-bold text-on-surface mb-4">Công nghệ sử dụng</h2>
                  <div className="flex flex-wrap gap-2">
                    {technologies.map((tech) => (
                      <span
                        key={tech}
                        className="px-3.5 py-1.5 bg-surface-container-highest text-on-surface-variant rounded-full text-sm font-medium"
                      >
                        {tech}
                      </span>
                    ))}
                  </div>
                </section>
              )}

              {/* Thành viên (nếu có) */}
              {item.members && item.members.length > 0 && (
                <section className="bg-white rounded-2xl p-6 sm:p-8 border border-outline-variant/20">
                  <h2 className="text-xl font-bold text-on-surface mb-4">Thành viên tham gia</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    {item.members.map((member) => (
                      <div
                        key={member.name}
                        className="flex items-center gap-3 p-3 rounded-xl bg-surface-container-low border border-outline-variant/10"
                      >
                        <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm bg-apc-blue text-white shrink-0">
                          {member.initials}
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-on-surface text-sm truncate">{member.name}</p>
                          <p className="text-on-surface-variant text-xs truncate">{member.role}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Quay lại */}
              <div className="pt-4 flex justify-between items-center">
                <Link
                  to="/projects"
                  className="text-apc-blue font-medium flex items-center gap-2 hover:underline text-sm sm:text-base"
                >
                  <span className="material-symbols-outlined text-sm">arrow_back</span> Về danh sách dự án
                </Link>
              </div>
            </article>
          )}
        </AsyncState>
      </div>
    </main>
  )
}

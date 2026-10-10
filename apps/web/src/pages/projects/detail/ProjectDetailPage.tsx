import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { AsyncState } from '../../../components/AsyncState'
import { Breadcrumb } from '../../../components/Breadcrumb'
import { ApiError } from '../../../lib/api'
import { NotFound } from '../../NotFound'
import { getProjectDetail, type ProjectItem, type ProjectType } from '../list/mock'

function getTypeColorClass(type: ProjectType): string {
  switch (type) {
    case 'Nền tảng':
      return 'text-apc-red'
    case 'Công cụ':
      return 'text-apc-blue'
    case 'Sản phẩm':
      return 'text-apc-gold'
    default:
      return 'text-apc-blue'
  }
}

type Result = {
  key: string | null
  item?: ProjectItem | null
  error?: ApiError
}

/** Trang chi tiết dự án */
export function ProjectDetailPage() {
  const { slug } = useParams<{ slug: string }>()

  const [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState<Result>({ key: null })

  const key = slug ? `${attempt}:${slug}` : null

  useEffect(() => {
    if (!slug || !key) return
    let cancelled = false

    getProjectDetail(slug)
      .then((res) => {
        if (!cancelled) {
          setResult({ key, item: res })
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setResult({
            key,
            error:
              err instanceof ApiError
                ? err
                : new ApiError(500, 'unknown', 'Đã có lỗi xảy ra. Vui lòng thử lại.'),
          })
        }
      })

    return () => {
      cancelled = true
    }
  }, [slug, key])

  if (!slug) {
    return <NotFound />
  }

  const loading = key !== null && result.key !== key
  const error = loading ? undefined : result.error
  const item = loading ? undefined : result.item

  const reload = () => setAttempt((count) => count + 1)

  if (!loading && !error && item === null) {
    return <NotFound />
  }

  const typeColorClass = item ? getTypeColorClass(item.type) : 'text-apc-blue'

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
                  { label: item.name },
                ]}
              />

              {/* Header dự án */}
              <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 border-b border-outline-variant/20 pb-6">
                <div>
                  <span className={`${typeColorClass} text-xs font-bold uppercase tracking-wider block mb-2`}>
                    {item.type}
                  </span>
                  <h1 className="font-headline-md text-3xl sm:text-4xl lg:text-5xl font-bold text-on-surface leading-tight">
                    {item.name}
                  </h1>
                </div>

                {/* Các nút liên kết sản phẩm / mã nguồn */}
                <div className="flex flex-wrap items-center gap-3">
                  {item.productUrl && (
                    <a
                      href={item.productUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-6 py-2.5 rounded-apc bg-apc-red text-white font-medium hover:bg-[#a0220b] transition-colors shadow-sm text-sm"
                    >
                      Trải nghiệm ngay <span className="material-symbols-outlined text-sm">open_in_new</span>
                    </a>
                  )}
                  {item.sourceUrl && (
                    <a
                      href={item.sourceUrl}
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
              {item.imageUrl ? (
                <div className="w-full aspect-[16/9] max-h-[460px] rounded-2xl overflow-hidden shadow-sm border border-outline-variant/20">
                  <img alt={item.name} className="w-full h-full object-cover" src={item.imageUrl} />
                </div>
              ) : (
                <div
                  className={`w-full aspect-[16/9] max-h-[460px] rounded-2xl flex items-center justify-center bg-gradient-to-br ${item.coverClass || 'from-apc-blue/15 to-surface-container-high'} border border-outline-variant/20 shadow-sm`}
                >
                  <span className="material-symbols-outlined text-7xl text-apc-blue/50">rocket_launch</span>
                </div>
              )}

              {/* Mô tả dự án */}
              <section className="bg-surface-container-low/40 rounded-2xl p-6 sm:p-8 border border-outline-variant/20">
                <h2 className="text-xl font-bold text-on-surface mb-3">Mô tả dự án</h2>
                <p className="text-on-surface-variant leading-relaxed text-base sm:text-lg">{item.description}</p>
              </section>

              {/* Công nghệ */}
              {item.technologies && item.technologies.length > 0 && (
                <section className="bg-white rounded-2xl p-6 sm:p-8 border border-outline-variant/20">
                  <h2 className="text-xl font-bold text-on-surface mb-4">Công nghệ sử dụng</h2>
                  <div className="flex flex-wrap gap-2">
                    {item.technologies.map((tech) => (
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

              {/* Thành viên */}
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

import { Link, useParams } from 'react-router-dom'

import { AsyncState } from '../../../components/AsyncState'
import { Breadcrumb } from '../../../components/Breadcrumb'
import { buttonClass } from '../../../components/buttonClass'
import { PageHero } from '../../../components/PageHero'
import { useMockApi } from '../../../hooks/useMockApi'
import { NotFound } from '../../NotFound'
import { getProjectDetail, type ProjectItem } from '../list/mock'

/** Trang chi tiết dự án */
export function ProjectDetailPage() {
  const { slug } = useParams<{ slug: string }>()

  const { data, loading, error, reload } = useMockApi<ProjectItem | null>(
    () => (slug ? getProjectDetail(slug) : Promise.resolve(null)),
    [slug],
  )

  if (!slug) {
    return <NotFound />
  }

  // data là null nghĩa là slug hợp lệ nhưng không tìm thấy dự án.
  if (!loading && !error && data === null) {
    return <NotFound />
  }

  // Alias để dùng tên quen thuộc trong JSX bên dưới.
  const item = data

  return (
    <main>
      <AsyncState loading={loading} error={error} empty={false} onRetry={reload}>
        {item && (
          <article>
            <PageHero
              top={
                <Breadcrumb
                  items={[
                    { label: 'trang chủ', to: '/' },
                    { label: 'dự án', to: '/projects' },
                    { label: item.name },
                  ]}
                />
              }
              compact
              comment={item.type.toLowerCase()}
              title={item.name}
              lede={item.description}
            >
              {(item.productUrl || item.sourceUrl) && (
                <div className="mt-8 flex flex-wrap gap-4">
                  {item.productUrl && (
                    <a href={item.productUrl} target="_blank" rel="noopener noreferrer" className={buttonClass('primary')}>
                      Dùng thử ↗<span className="sr-only"> (mở tab mới)</span>
                    </a>
                  )}
                  {item.sourceUrl && (
                    <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer" className={buttonClass('light')}>
                      Mã nguồn ↗<span className="sr-only"> (mở tab mới)</span>
                    </a>
                  )}
                </div>
              )}
            </PageHero>

            <section className="px-4 py-[clamp(40px,7vh,80px)] md:px-8">
              <div className="mx-auto w-full max-w-container-max">
                {item.imageUrl ? (
                  <div data-rv className="photo aspect-[16/9] bg-soft">
                    <img alt={`Ảnh chụp ${item.name}`} className="h-full" src={item.imageUrl} />
                  </div>
                ) : (
                  <div data-rv className="rounded-[20px] bg-ink p-6 font-code text-[16px] font-bold text-paper/70 md:p-10">
                    <span className="text-apc-gold-soft">apc@umt</span>:~$ cd {item.slug}/ &amp;&amp; ls
                    <br />
                    <span className="text-paper">ảnh chụp sản phẩm sẽ có khi dự án lên bản demo</span>
                  </div>
                )}

                <div className="mt-[clamp(40px,7vh,72px)] grid gap-12 lg:grid-cols-2 lg:gap-16">
                  {item.technologies.length > 0 && (
                    <div>
                      <h2 className="border-b-2 border-ink pb-3 font-display text-[28px] font-extrabold leading-none">Công nghệ</h2>
                      <ul className="mt-5 flex flex-wrap gap-2">
                        {item.technologies.map((tech) => (
                          <li key={tech} className="rounded-lg bg-soft px-3 py-1.5 font-code text-[15px] font-bold">
                            {tech}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {item.members.length > 0 && (
                    <div>
                      <h2 className="border-b-2 border-ink pb-3 font-display text-[28px] font-extrabold leading-none">Thành viên</h2>
                      <ul className="mt-2">
                        {item.members.map((member) => (
                          <li key={member.name} className="flex items-center gap-4 border-b-2 border-ink/10 py-3">
                            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-apc-blue text-[13px] font-extrabold text-paper">
                              {member.initials}
                            </span>
                            <b className="min-w-0 flex-1 truncate">{member.name}</b>
                            <span className="font-code text-[13px] font-bold text-muted">{member.role}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                <Link
                  to="/projects"
                  className="mt-12 inline-flex min-h-12 items-center text-[17px] font-extrabold text-apc-red underline decoration-2 underline-offset-4"
                >
                  ← Về danh sách dự án
                </Link>
              </div>
            </section>
          </article>
        )}
      </AsyncState>
    </main>
  )
}

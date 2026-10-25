import { Link, useParams } from 'react-router-dom'

import { AsyncState } from '../../../components/AsyncState'
import { Breadcrumb } from '../../../components/Breadcrumb'
import { buttonClass } from '../../../components/buttonClass'
import { PageHero } from '../../../components/PageHero'
import { Seo } from '../../../components/Seo'
import { useApi } from '../../../hooks/useApi'
import { safeHttpUrl, type ProjectItem } from '../../../lib/content'
import { NotFound } from '../../NotFound'

/** Trang chi tiết dự án. Loại dự án và thành viên tham gia thêm ở C4. */
export function ProjectDetailPage() {
  const { slug } = useParams<{ slug: string }>()
  const { data: item, loading, error, reload } = useApi<ProjectItem>(slug ? `/public/projects/${slug}` : null)

  // Dự án không tồn tại hoặc chưa công bố trả 404
  if (!slug || error?.status === 404) {
    return <NotFound />
  }

  const productUrl = safeHttpUrl(item?.projectUrl)
  const sourceUrl = safeHttpUrl(item?.sourceUrl)
  const technologies = item?.technologies ?? []

  return (
    <main>
      <AsyncState loading={loading} error={error} empty={false} onRetry={reload}>
        {item && (
          <article>
            <Seo title={item.title} description={item.description} path={`/projects/${slug}`} imageUrl={item.thumbnailUrl} />
            <PageHero
              top={
                <Breadcrumb
                  items={[
                    { label: 'trang chủ', to: '/' },
                    { label: 'dự án', to: '/projects' },
                    { label: item.title },
                  ]}
                />
              }
              compact
              comment="dự án"
              title={item.title}
              lede={item.description}
            >
              {(productUrl || sourceUrl) && (
                <div className="mt-8 flex flex-wrap gap-4">
                  {productUrl && (
                    <a href={productUrl} target="_blank" rel="noopener noreferrer" className={buttonClass('primary')}>
                      Dùng thử ↗<span className="sr-only"> (mở tab mới)</span>
                    </a>
                  )}
                  {sourceUrl && (
                    <a href={sourceUrl} target="_blank" rel="noopener noreferrer" className={buttonClass('light')}>
                      Mã nguồn ↗<span className="sr-only"> (mở tab mới)</span>
                    </a>
                  )}
                </div>
              )}
            </PageHero>

            <section className="px-4 py-[clamp(40px,7vh,80px)] md:px-8">
              <div className="mx-auto w-full max-w-container-max">
                {item.thumbnailUrl ? (
                  <div data-rv className="photo aspect-[16/9] bg-soft">
                    <img alt={`Ảnh chụp ${item.title}`} className="h-full" src={item.thumbnailUrl} />
                  </div>
                ) : (
                  <div data-rv className="rounded-[20px] bg-ink p-6 font-code text-[16px] font-bold text-paper/70 md:p-10">
                    <span className="text-apc-gold-soft">apc@umt</span>:~$ cd {item.slug}/ &amp;&amp; ls
                    <br />
                    <span className="text-paper">ảnh chụp sản phẩm sẽ có khi dự án lên bản demo</span>
                  </div>
                )}

                {technologies.length > 0 && (
                  <div className="mt-[clamp(40px,7vh,72px)] max-w-[760px]">
                    <h2 className="border-b-2 border-ink pb-3 font-display text-[28px] font-extrabold leading-none">Công nghệ</h2>
                    <ul className="mt-5 flex flex-wrap gap-2">
                      {technologies.map((tech) => (
                        <li key={tech} className="rounded-lg bg-soft px-3 py-1.5 font-code text-[15px] font-bold">
                          {tech}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

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

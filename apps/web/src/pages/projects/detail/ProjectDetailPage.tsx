import { useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'

import { AsyncState } from '../../../components/AsyncState.js'
import { Breadcrumb } from '../../../components/Breadcrumb.js'
import { buttonClass } from '../../../components/buttonClass.js'
import { PageHero } from '../../../components/PageHero.js'
import { Seo } from '../../../components/Seo.js'
import { useApi } from '../../../hooks/useApi.js'
import { safeHttpUrl } from '../../../lib/content.js'
import { NotFound } from '../../NotFound.js'
import { PROJECT_TYPE_LABEL, type ProjectDetail, type ProjectMember } from '../types.js'

/** Một thành viên trong mục Thành viên tham gia: ảnh đại diện nếu được đồng ý công bố ảnh, nếu không là chữ cái đầu. */
function ProjectMemberRow({ slug, member }: { slug: string; member: ProjectMember }) {
  // Ảnh 404 (ví dụ thành viên vừa thu hồi đồng ý công bố ảnh) thì chuyển sang chữ cái đầu thay vì ảnh vỡ.
  const [avatarFailed, setAvatarFailed] = useState(false)
  const initial = member.name.trim().charAt(0).toUpperCase() || '?'

  return (
    <li className="flex items-center gap-4 rounded-2xl bg-soft px-4 py-3">
      {member.hasPhoto && !avatarFailed ? (
        <img
          src={`/api/public/projects/${slug}/members/${member.userId}/avatar`}
          alt=""
          loading="lazy"
          className="h-14 w-14 shrink-0 rounded-full bg-soft object-cover"
          onError={() => setAvatarFailed(true)}
        />
      ) : (
        <span
          aria-hidden
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-ink font-display text-[20px] font-extrabold text-paper"
        >
          {initial}
        </span>
      )}
      <span className="font-display text-[17px] font-extrabold">{member.name}</span>
    </li>
  )
}

/** Trang chi tiết dự án. Loại dự án và thành viên tham gia thêm ở C4. */
export function ProjectDetailPage() {
  const { slug } = useParams<{ slug: string }>()
  const location = useLocation()
  const backTo = (location.state as { from?: string } | null)?.from ?? '/projects'
  const { data: item, loading, error, reload } = useApi<ProjectDetail>(slug ? `/public/projects/${slug}` : null)

  // Dự án không tồn tại hoặc chưa công bố trả 404
  if (!slug || error?.status === 404) {
    return <NotFound />
  }

  const productUrl = safeHttpUrl(item?.projectUrl)
  const sourceUrl = safeHttpUrl(item?.sourceUrl)
  const technologies = item?.technologies ?? []
  // API đã lọc sẵn: chỉ thành viên có đồng ý công bố tên mới nằm trong mảng này — không tự lọc lại ở web.
  const members = item?.members ?? []

  return (
    <main>
      <AsyncState loading={loading} error={error} empty={false} onRetry={reload}>
        {item && (
          <article>
            {/* Map fileId từ D2 thành URL public để hiển thị ảnh đúng */}
            <Seo
              title={item.title}
              description={item.description}
              path={`/projects/${slug}`}
              imageUrl={item.thumbnailUrl ? `/api/public/files/${item.thumbnailUrl}` : null}
            />
            <PageHero
              top={
                <Breadcrumb
                  items={[
                    { label: 'trang chủ', to: '/' },
                    { label: 'dự án', to: backTo },
                    { label: item.title },
                  ]}
                />
              }
              compact
              comment={(PROJECT_TYPE_LABEL[item.type] ?? 'dự án').toLowerCase()}
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
                    {/* Map fileId từ D2 thành URL public để hiển thị ảnh đúng */}
                    <img alt={`Ảnh chụp ${item.title}`} className="h-full" src={`/api/public/files/${item.thumbnailUrl}`} />
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

                <div className="mt-[clamp(40px,7vh,72px)] max-w-[760px]">
                  <h2 className="border-b-2 border-ink pb-3 font-display text-[28px] font-extrabold leading-none">
                    Thành viên tham gia
                  </h2>
                  {members.length > 0 ? (
                    <ul className="mt-5 flex flex-col gap-3">
                      {members.map((member) => (
                        <ProjectMemberRow key={member.userId} slug={slug} member={member} />
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-5 text-[16px] text-muted">Chưa có thông tin thành viên.</p>
                  )}
                </div>

                <Link
                  to={backTo}
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

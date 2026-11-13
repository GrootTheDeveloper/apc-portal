import { Link, useParams } from 'react-router-dom'

import { AsyncState } from '../../../components/AsyncState.js'
import { buttonClass } from '../../../components/buttonClass.js'
import { PageHero } from '../../../components/PageHero.js'
import { Seo } from '../../../components/Seo.js'
import { useApi } from '../../../hooks/useApi.js'
import { safeHttpUrl } from '../../../lib/content.js'
import { fileSrc } from './postTypes.js'
import {
  type AdminProjectDetail,
  PROJECT_STATUS_LABEL,
  PROJECT_TYPE_LABEL,
  projectStatusBadgeClass,
} from './projectTypes.js'

/**
 * PAGE-MGT-PRJ-04 — xem trước dự án (C4): dựng lại bố cục trang công khai (`pages/projects/detail/ProjectDetailPage.tsx`)
 * nhưng cần đăng nhập và gắn `noindex, nofollow` (Sitemap §16). Không tải ảnh đại diện thành viên qua route /public/...
 * vì dự án có thể đang Ẩn (route đó chỉ mở khi dự án đã công bố) — chỉ hiện tên và badge đồng ý.
 */
export function AdminProjectPreviewPage() {
  const { id } = useParams<{ id: string }>()
  const project = useApi<AdminProjectDetail>(id ? `/admin/content/projects/${id}` : null)
  const detail = project.data
  const thumbnail = detail ? fileSrc(detail.thumbnailUrl) : null
  const productUrl = safeHttpUrl(detail?.projectUrl)
  const sourceUrl = safeHttpUrl(detail?.sourceUrl)
  // Giống API công khai (P5): chỉ thành viên đồng ý công bố tên xuất hiện.
  const visibleMembers = (detail?.members ?? []).filter((member) => member.publicNameConsent)

  const note = !detail
    ? 'Đang tải bản xem trước…'
    : detail.status === 'ARCHIVED'
      ? 'Dự án đã lưu trữ: không còn hiển thị ở bất kỳ đâu. Đây là bản xem trước dành cho người quản trị.'
      : detail.status === 'DRAFT'
        ? 'Bạn đang xem trước dự án ở trạng thái Ẩn — chưa công bố nên khách không thấy được.'
        : 'Bạn đang xem trước dự án công khai. Đây là trang quản trị, không phải /projects.'

  return (
    <main>
      <div className="sticky top-0 z-30 flex flex-wrap items-center justify-between gap-3 border-b-2 border-ink bg-apc-gold-pale px-5 py-3">
        <p className="flex min-w-0 flex-col gap-1 text-[15px] font-bold text-ink">
          <span className="font-code text-[13px] font-bold uppercase text-apc-red">
            <span aria-hidden>{'// '}</span>chế độ xem trước
          </span>
          {note}
          <span className="font-body text-[14px] font-semibold text-muted">
            Trang này gắn thẻ noindex nên công cụ tìm kiếm không lập chỉ mục.
          </span>
        </p>
        <span className="flex shrink-0 flex-wrap items-center gap-3">
          {detail && (
            <span className={projectStatusBadgeClass(detail.status)}>{PROJECT_STATUS_LABEL[detail.status]}</span>
          )}
          <Link to={`/admin/content/projects/${id}`} className={buttonClass('outline')}>
            Sửa dự án
          </Link>
          <Link to="/admin/content/projects" className={buttonClass('light')}>
            Về danh sách
          </Link>
        </span>
      </div>

      <AsyncState
        loading={project.loading}
        error={project.error}
        empty={!detail}
        emptyText="Không tìm thấy dự án để xem trước."
        onRetry={project.reload}
      >
        {detail && (
          <article>
            <Seo
              title={detail.title}
              description={detail.description}
              path={`/admin/content/projects/${detail.id}/preview`}
              imageUrl={thumbnail}
              robots="noindex, nofollow"
            />
            <PageHero
              compact
              comment={PROJECT_TYPE_LABEL[detail.type].toLowerCase()}
              title={detail.title}
              lede={detail.description}
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
                {thumbnail ? (
                  <div data-rv className="photo aspect-[16/9] bg-soft">
                    <img alt={`Ảnh chụp ${detail.title}`} className="h-full" src={thumbnail} />
                  </div>
                ) : (
                  <div data-rv className="rounded-[20px] bg-ink p-6 font-code text-[16px] font-bold text-paper/70 md:p-10">
                    <span className="text-apc-gold-soft">apc@umt</span>:~$ cd {detail.slug}/ &amp;&amp; ls
                    <br />
                    <span className="text-paper">ảnh chụp sản phẩm sẽ có khi dự án lên bản demo</span>
                  </div>
                )}

                {detail.technologies.length > 0 && (
                  <div className="mt-[clamp(40px,7vh,72px)] max-w-[760px]">
                    <h2 className="border-b-2 border-ink pb-3 font-display text-[28px] font-extrabold leading-none">
                      Công nghệ
                    </h2>
                    <ul className="mt-5 flex flex-wrap gap-2">
                      {detail.technologies.map((tech) => (
                        <li key={tech} className="rounded-lg bg-soft px-3 py-1.5 font-code text-[15px] font-bold">
                          {tech}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="mt-[clamp(40px,7vh,72px)] max-w-[760px]">
                  <h2 className="border-b-2 border-ink pb-3 font-display text-[28px] font-extrabold leading-none">
                    Thành viên
                  </h2>
                  {visibleMembers.length > 0 ? (
                    <ul className="mt-5 flex flex-wrap gap-3">
                      {visibleMembers.map((member) => (
                        <li
                          key={member.userId}
                          className="flex items-center gap-3 rounded-full bg-soft px-4 py-2 text-[15px] font-bold"
                        >
                          <span>{member.name}</span>
                          <span className="font-code text-[13px]">
                            Tên: ✅ · Ảnh: {member.publicPhotoConsent ? '✅' : '❌'}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-5 text-[16px] text-muted">
                      Chưa có thành viên nào đồng ý công bố tên trên trang công khai.
                    </p>
                  )}
                  <p className="mt-4 text-[15px] text-muted">
                    Bản xem trước không tải ảnh đại diện (route công khai chỉ mở khi dự án đã công bố); trang công
                    khai hiện ảnh của thành viên đồng ý công bố ảnh.
                  </p>
                </div>
              </div>
            </section>
          </article>
        )}
      </AsyncState>
    </main>
  )
}

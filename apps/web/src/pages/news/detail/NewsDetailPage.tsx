import { Link, useParams } from 'react-router-dom'

import { AsyncState } from '../../../components/AsyncState'
import { Breadcrumb } from '../../../components/Breadcrumb'
import { Eyebrow } from '../../../components/Eyebrow'
import { Seo } from '../../../components/Seo'
import { useApi } from '../../../hooks/useApi'
import {
  getNewsCategoryChipClass,
  getNewsCategoryVisual,
  type NewsDetailItem,
} from '../../../lib/content'
import { formatDate } from '../../../lib/format'
import { NotFound } from '../../NotFound'

/** Trang chi tiết tin tức */
export function NewsDetailPage() {
  const { slug } = useParams<{ slug: string }>()

  const { data: item, loading, error, reload } = useApi<NewsDetailItem>(
    slug ? `/public/news/${slug}` : null,
  )


  if (!slug) {
    return <NotFound />
  }

  // Khi API trả về 404 (bài viết không tồn tại, hoặc là DRAFT, ARCHIVED, INTERNAL)
  if (!loading && error?.status === 404) {
    return <NotFound />
  }

  // Không tải, không lỗi nhưng không có dữ liệu
  if (!loading && !error && !item) {
    return <NotFound />
  }

  const category = item?.category || ''
  const visual = getNewsCategoryVisual(category)
  const imageUrl = item?.thumbnailUrl || item?.coverUrl
  const summaryText = item?.summary || item?.excerpt

  return (
    <main className="w-full min-h-[60vh] py-12 px-gutter bg-white">
      <div className="max-w-4xl mx-auto fade-up w-full">
        <AsyncState
          loading={loading}
          error={error}
          empty={false}
          onRetry={reload}
        >
          {item && (
            <article className="flex flex-col gap-8">
              {/* metaTitle/metaDescription để trống thì dùng tiêu đề/tóm tắt */}
              <Seo
                title={item.metaTitle || item.title}
                description={item.metaDescription || item.summary}
                path={`/news/${slug}`}
                imageUrl={item.thumbnailUrl}
              />
              {/* Breadcrumb */}
              <Breadcrumb
                items={[
                  { label: 'Trang chủ', to: '/' },
                  { label: 'Tin tức', to: '/news' },
                  { label: item.title },
                ]}
              />

              {/* Tiêu đề & chuyên mục */}
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <Eyebrow className="text-apc-blue">{item.category}</Eyebrow>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${getNewsCategoryChipClass(item.category)}`}
                  >
                    {item.category}
                  </span>
                </div>
                <h1 className="font-headline-md text-3xl sm:text-4xl lg:text-5xl font-bold text-on-surface leading-tight">
                  {item.title}
                </h1>

                {item.publishedAt && (
                  <p className="pt-2 text-sm text-on-surface-variant">{formatDate(item.publishedAt)}</p>
                )}
              </div>

              {/* Ảnh cover hoặc block gradient */}
              {imageUrl ? (
                <div className="w-full aspect-[16/9] rounded-2xl overflow-hidden shadow-sm border border-outline-variant/20">
                  <img src={imageUrl} alt={item.title} className="w-full h-full object-cover" />
                </div>
              ) : (
                <div
                  className={`w-full aspect-[16/9] rounded-2xl flex items-center justify-center bg-gradient-to-br ${visual.coverClass} border border-outline-variant/20 shadow-sm`}
                >
                  <span className={`material-symbols-outlined text-7xl ${visual.iconClass}`}>{visual.icon}</span>
                </div>
              )}

              {/* Đoạn tóm tắt nổi bật */}
              {summaryText && (
                <p className="text-lg sm:text-xl font-medium text-on-surface leading-relaxed border-l-4 border-apc-blue pl-4 py-1 italic bg-surface-container-low/50 rounded-r-xl">
                  {summaryText}
                </p>
              )}

              {/* Nội dung bài viết (tách đoạn theo dòng trống, giữ xuống dòng trong đoạn) */}
              <div className="flex flex-col gap-5 pt-2">
                {item.content.split('\n\n').map((paragraph, index) => (
                  <p key={index} className="text-base sm:text-lg text-on-surface leading-relaxed whitespace-pre-line">
                    {paragraph}
                  </p>
                ))}
              </div>

              {/* Liên kết quay lại */}
              <div className="pt-8 border-t border-outline-variant/20 flex items-center justify-between">
                <Link
                  to="/news"
                  className="text-apc-blue font-medium flex items-center gap-2 hover:underline text-sm sm:text-base"
                >
                  <span className="material-symbols-outlined text-sm">arrow_back</span> Về danh sách tin tức
                </Link>
              </div>
            </article>
          )}
        </AsyncState>
      </div>
    </main>
  )
}

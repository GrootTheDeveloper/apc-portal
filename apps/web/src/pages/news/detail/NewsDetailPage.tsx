import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { AsyncState } from '../../../components/AsyncState'
import { Breadcrumb } from '../../../components/Breadcrumb'
import { Eyebrow } from '../../../components/Eyebrow'
import { ApiError } from '../../../lib/api'
import { formatDate } from '../../../lib/format'
import { NotFound } from '../../NotFound'
import { getNewsDetail, type NewsItem } from '../list/mock'

type Result = {
  key: string | null
  item?: NewsItem | null
  error?: ApiError
}

/** Trang chi tiết tin tức */
export function NewsDetailPage() {
  const { slug } = useParams<{ slug: string }>()

  const [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState<Result>({ key: null })

  const key = slug ? `${attempt}:${slug}` : null

  useEffect(() => {
    if (!slug || !key) return
    let cancelled = false

    getNewsDetail(slug)
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

  // Nếu không tải và không có lỗi nhưng không tìm thấy bài viết
  if (!loading && !error && item === null) {
    return <NotFound />
  }

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
                <Eyebrow className="text-apc-blue">{item.category}</Eyebrow>
                <h1 className="font-headline-md text-3xl sm:text-4xl lg:text-5xl font-bold text-on-surface leading-tight">
                  {item.title}
                </h1>

                {/* Tác giả & Ngày đăng */}
                <div className="pt-2 flex items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs ${item.author.avatarClass}`}
                  >
                    {item.author.initials}
                  </div>
                  <div className="text-xs sm:text-sm">
                    <p className="font-bold text-on-surface">{item.author.name}</p>
                    <div className="flex items-center gap-2 text-on-surface-variant">
                      <span>{item.author.role}</span>
                      <span>•</span>
                      <span>{formatDate(item.publishedAt)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Ảnh cover hoặc block gradient */}
              {item.coverUrl ? (
                <div className="w-full aspect-[16/9] rounded-2xl overflow-hidden shadow-sm border border-outline-variant/20">
                  <img src={item.coverUrl} alt={item.title} className="w-full h-full object-cover" />
                </div>
              ) : (
                <div
                  className={`w-full aspect-[16/9] rounded-2xl flex items-center justify-center bg-gradient-to-br ${item.coverClass} border border-outline-variant/20 shadow-sm`}
                >
                  <span className={`material-symbols-outlined text-7xl ${item.iconClass}`}>{item.icon}</span>
                </div>
              )}

              {/* Đoạn tóm tắt nổi bật */}
              {item.excerpt && (
                <p className="text-lg sm:text-xl font-medium text-on-surface leading-relaxed border-l-4 border-apc-blue pl-4 py-1 italic bg-surface-container-low/50 rounded-r-xl">
                  {item.excerpt}
                </p>
              )}

              {/* Nội dung bài viết (tách paragraph theo \n\n) */}
              <div className="flex flex-col gap-5 pt-2">
                {item.content.split('\n\n').map((paragraph, index) => (
                  <p key={index} className="text-base sm:text-lg text-on-surface leading-relaxed">
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

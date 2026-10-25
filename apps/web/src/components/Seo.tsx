// Thẻ SEO cho trang chi tiết (SEO-01, CMS-04): title, description, canonical, Open Graph.
// Không dùng thư viện ngoài (react-helmet-async chưa có trong danh sách đã duyệt), chỉnh thẳng <head> trong useEffect.

import { useEffect } from 'react'

export interface SeoProps {
  /** Tiêu đề trang, tự thêm "— CLB APC" phía sau */
  title: string
  /** Mô tả ngắn cho description và og:description */
  description?: string | null
  /** Đường dẫn trang, vd. `/news/abc` (tự ghép origin cho canonical và og:url) */
  path: string
  /** Ảnh cho og:image, tương đối hoặc tuyệt đối */
  imageUrl?: string | null
}

const SITE_NAME = 'CLB APC'

function addTag(tag: 'meta' | 'link', attrs: Record<string, string>) {
  const el = document.createElement(tag)
  for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, value)
  document.head.appendChild(el)
  return el
}

/**
 * Đặt thẻ <head> cho trang đang xem; rời trang thì trả <head> về như cũ để trang sau không mang thẻ của bài trước.
 *   <Seo title={item.metaTitle || item.title} description={item.metaDescription || item.summary}
 *        path={`/news/${slug}`} imageUrl={item.thumbnailUrl} />
 */
export function Seo({ title, description, path, imageUrl }: SeoProps) {
  useEffect(() => {
    const fullTitle = `${title} — ${SITE_NAME}`
    const url = new URL(path, window.location.origin).href
    const desc = description ?? ''
    // index.html luôn có sẵn <title> và <meta name="description">: sửa rồi trả lại, không tạo thẻ trùng.
    const descTag = document.head.querySelector('meta[name="description"]')
    const prevTitle = document.title
    const prevDesc = descTag?.getAttribute('content')

    document.title = fullTitle
    descTag?.setAttribute('content', desc)
    const added = [
      addTag('link', { rel: 'canonical', href: url }),
      addTag('meta', { property: 'og:title', content: fullTitle }),
      addTag('meta', { property: 'og:description', content: desc }),
      addTag('meta', { property: 'og:type', content: 'article' }),
      addTag('meta', { property: 'og:url', content: url }),
      addTag('meta', { property: 'og:site_name', content: SITE_NAME }),
      ...(imageUrl ? [addTag('meta', { property: 'og:image', content: new URL(imageUrl, window.location.origin).href })] : []),
    ]

    return () => {
      document.title = prevTitle
      if (prevDesc != null) descTag?.setAttribute('content', prevDesc)
      for (const el of added) el.remove()
    }
  }, [title, description, path, imageUrl])

  return null
}

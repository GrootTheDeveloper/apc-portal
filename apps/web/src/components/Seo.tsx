// Component SEO dùng chung cho toàn bộ ứng dụng.
// Không dùng thư viện ngoài (react-helmet-async chưa có trong danh sách đã duyệt);
// thay vào đó dùng document API kết hợp useEffect để inject/cập nhật thẻ head.
// Mỗi lần render sẽ đồng bộ lại các thẻ: <title>, <meta name="description">,
// <link rel="canonical"> và toàn bộ Open Graph tags.

import { useEffect } from 'react'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface SeoProps {
  /** Tiêu đề trang — sẽ được append "— CLB APC" ở phía sau */
  title: string
  /** Mô tả ngắn gọn cho thẻ description và og:description */
  description?: string | null
  /** URL chính tắc tuyệt đối (canonical). Nên luôn truyền để tránh duplicate content */
  canonicalUrl?: string | null
  /** URL ảnh dùng cho og:image */
  imageUrl?: string | null
  /** Loại trang Open Graph, mặc định là 'article' */
  ogType?: 'website' | 'article'
}

// ---------------------------------------------------------------------------
// Hằng số
// ---------------------------------------------------------------------------

/** Hậu tố thống nhất cho title tất cả các trang */
const SITE_NAME = 'CLB APC'
const TITLE_SUFFIX = `— ${SITE_NAME}`

// ---------------------------------------------------------------------------
// Hàm tiện ích — thao tác thẻ <meta> và <link> trong <head>
// ---------------------------------------------------------------------------

/**
 * Lấy hoặc tạo thẻ <meta name="..."> trong <head>.
 * Không tạo trùng nếu đã tồn tại.
 */
function getOrCreateMeta(
  selector: string,
  attrKey: string,
  attrValue: string,
): HTMLMetaElement {
  let el = document.head.querySelector<HTMLMetaElement>(selector)
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(attrKey, attrValue)
    document.head.appendChild(el)
  }
  return el
}

/**
 * Lấy hoặc tạo thẻ <link rel="canonical"> trong <head>.
 */
function getOrCreateCanonical(): HTMLLinkElement {
  let el = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')
  if (!el) {
    el = document.createElement('link')
    el.setAttribute('rel', 'canonical')
    document.head.appendChild(el)
  }
  return el
}

/**
 * Xóa thẻ canonical nếu tồn tại (dùng khi không truyền canonicalUrl).
 */
function removeCanonical(): void {
  const el = document.head.querySelector('link[rel="canonical"]')
  el?.remove()
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Component SEO — inject/đồng bộ các thẻ head cho từng trang.
 *
 * Cách dùng:
 * ```tsx
 * <Seo
 *   title="Tên bài viết"
 *   description="Mô tả ngắn"
 *   canonicalUrl={`${window.location.origin}/news/${slug}`}
 *   imageUrl={item.thumbnailUrl}
 * />
 * ```
 */
export function Seo({
  title,
  description,
  canonicalUrl,
  imageUrl,
  ogType = 'article',
}: SeoProps) {
  useEffect(() => {
    // --- <title> ---
    const fullTitle = `${title} ${TITLE_SUFFIX}`
    document.title = fullTitle

    // --- <meta name="description"> ---
    const safeDescription = description ?? ''
    getOrCreateMeta('meta[name="description"]', 'name', 'description').setAttribute(
      'content',
      safeDescription,
    )

    // --- <link rel="canonical"> ---
    if (canonicalUrl) {
      getOrCreateCanonical().setAttribute('href', canonicalUrl)
    } else {
      removeCanonical()
    }

    // --- Open Graph tags ---
    // og:title
    getOrCreateMeta(
      'meta[property="og:title"]',
      'property',
      'og:title',
    ).setAttribute('content', fullTitle)

    // og:description
    getOrCreateMeta(
      'meta[property="og:description"]',
      'property',
      'og:description',
    ).setAttribute('content', safeDescription)

    // og:type
    getOrCreateMeta(
      'meta[property="og:type"]',
      'property',
      'og:type',
    ).setAttribute('content', ogType)

    // og:url — dùng canonicalUrl nếu có, ngược lại dùng href hiện tại
    getOrCreateMeta(
      'meta[property="og:url"]',
      'property',
      'og:url',
    ).setAttribute('content', canonicalUrl ?? window.location.href)

    // og:image — chỉ set khi có ảnh hợp lệ
    const ogImageEl = getOrCreateMeta(
      'meta[property="og:image"]',
      'property',
      'og:image',
    )
    if (imageUrl) {
      ogImageEl.setAttribute('content', imageUrl)
    } else {
      ogImageEl.removeAttribute('content')
    }

    // og:site_name
    getOrCreateMeta(
      'meta[property="og:site_name"]',
      'property',
      'og:site_name',
    ).setAttribute('content', SITE_NAME)
  }, [title, description, canonicalUrl, imageUrl, ogType])

  // Component này không render ra DOM — chỉ tác động vào <head>
  return null
}

import { useEffect } from 'react'

import { AsyncState } from '../../components/AsyncState'
import type { AboutData } from './mock'
import { MOCK_ABOUT } from './mock'
import { ContactSection } from './sections/ContactSection'
import { DepartmentsSection } from './sections/DepartmentsSection'
import { IntroSection } from './sections/IntroSection'

const PAGE_PATH = '/about'
const DEFAULT_TITLE = 'APC Portal - Từ ý tưởng đến sản phẩm thật'

/**
 * PAGE-PUB-02 — T1 dùng dữ liệu giả cùng hình dạng GET /public/about.
 * T2: thay `useMockAbout()` bằng `useApi<AboutData>('/public/about')` và xóa `mock.ts`.
 */
function useMockAbout() {
  return { data: MOCK_ABOUT, loading: false, error: undefined, reload: () => undefined }
}

export function AboutPage() {
  const about = useMockAbout()

  useEffect(() => {
    if (!about.data) return
    applyAboutSeo(about.data, canonicalUrl())
    return () => {
      document.title = DEFAULT_TITLE
    }
  }, [about.data])

  return (
    <main>
      <AsyncState
        loading={about.loading}
        error={about.error}
        empty={!about.data}
        emptyText="Chưa có thông tin giới thiệu."
        onRetry={about.reload}
      >
        {about.data && (
          <>
            <IntroSection data={about.data} />
            <DepartmentsSection departments={about.data.departments} />
            <ContactSection data={about.data} />
          </>
        )}
      </AsyncState>
    </main>
  )
}

function canonicalUrl() {
  return `${window.location.origin}${PAGE_PATH}`
}

/** SEO-01, Sitemap §16: title, description, canonical, Open Graph, index,follow. */
function applyAboutSeo(data: AboutData, canonical: string) {
  const title = `Về APC — ${data.name}`
  const description = data.description
  document.title = title
  setMeta('name', 'description', description)
  setMeta('name', 'robots', 'index, follow')
  setMeta('property', 'og:title', title)
  setMeta('property', 'og:description', description)
  setMeta('property', 'og:type', 'website')
  setMeta('property', 'og:url', canonical)
  setMeta('property', 'og:locale', 'vi_VN')
  setMeta('property', 'og:image', `${window.location.origin}/assets/home/00-apc-logo.png`)
  setCanonical(canonical)
}

function setMeta(attr: 'name' | 'property', key: string, content: string) {
  let el = document.head.querySelector(`meta[${attr}="${CSS.escape(key)}"]`)
  if (!(el instanceof HTMLMetaElement)) {
    el = document.createElement('meta')
    el.setAttribute(attr, key)
    document.head.appendChild(el)
  }
  el.setAttribute('content', content)
}

function setCanonical(href: string) {
  const existing = document.head.querySelector('link[rel="canonical"]')
  const el = existing instanceof HTMLLinkElement ? existing : document.head.appendChild(document.createElement('link'))
  el.rel = 'canonical'
  el.href = href
}

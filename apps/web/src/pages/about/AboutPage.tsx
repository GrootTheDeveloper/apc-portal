import { useEffect, useMemo } from 'react'
import { Link, useLocation } from 'react-router-dom'

import { AsyncState } from '../../components/AsyncState'
import { buttonClass } from '../../components/buttonClass'
import { useApi } from '../../hooks/useApi'
import { ContactSection } from './sections/ContactSection'
import { DepartmentsSection } from './sections/DepartmentsSection'
import { IntroSection } from './sections/IntroSection'
import type { AboutData } from './types'

const PAGE_PATH = '/about'
const DEFAULT_TITLE = 'APC Portal - Từ ý tưởng đến sản phẩm thật'

/** PAGE-PUB-02 — Trang Về APC, dữ liệu từ GET /public/about (T2) hoặc chế độ preview (T4). */
export function AboutPage() {
  const location = useLocation()
  const preview = location.state?.preview as Partial<AboutData> | undefined

  const about = useApi<AboutData>('/public/about')

  const effectiveData: AboutData | undefined = useMemo(() => {
    if (preview) {
      return {
        name: preview.name ?? about.data?.name ?? '',
        description: preview.description ?? about.data?.description ?? '',
        mission: preview.mission ?? about.data?.mission ?? '',
        contactEmail: preview.contactEmail ?? about.data?.contactEmail ?? '',
        fanpage: preview.fanpage ?? about.data?.fanpage ?? '',
        officialLinks: preview.officialLinks ?? about.data?.officialLinks ?? [],
        departments: about.data?.departments ?? [],
      }
    }
    return about.data ?? undefined
  }, [preview, about.data])

  useEffect(() => {
    if (!effectiveData) return
    applyAboutSeo(effectiveData, canonicalUrl())
    return () => {
      document.title = DEFAULT_TITLE
    }
  }, [effectiveData])

  return (
    <main>
      {preview && (
        <div className="sticky top-0 z-30 flex flex-wrap items-center justify-between gap-3 border-b-2 border-ink bg-apc-gold px-6 py-3 font-bold text-ink">
          <div className="flex items-center gap-3">
            <span className="font-code text-xs uppercase text-ink/75">{'// xem trước'}</span>
            <span>Chế độ xem trước thông tin APC (Dữ liệu chưa lưu)</span>
          </div>
          <Link to="/admin/organization/profile" className={buttonClass('outline')}>
            ← Quay lại chỉnh sửa
          </Link>
        </div>
      )}

      <AsyncState
        loading={!preview && about.loading}
        error={preview ? undefined : about.error}
        empty={!effectiveData}
        emptyText="Chưa có thông tin giới thiệu."
        onRetry={about.reload}
      >
        {effectiveData && (
          <>
            <IntroSection data={effectiveData} />
            <DepartmentsSection departments={effectiveData.departments} />
            <ContactSection data={effectiveData} />
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

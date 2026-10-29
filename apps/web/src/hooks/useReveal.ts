import { useLayoutEffect } from 'react'

/**
 * Hiện dần nội dung khi cuộn tới: mỗi `<section>` trong `<main>` được gắn class `in` lần đầu lọt vào màn hình,
 * các phần tử `[data-rv]` bên trong trồi lên lần lượt theo độ trễ `--d` (CSS ở index.css).
 *
 * Mặc định nội dung vẫn hiện: chỉ khi JS chạy và người dùng không bật "giảm chuyển động" mới gắn `rv-on`
 * lên <html> để bật trạng thái ẩn ban đầu. Chạy lại khi đổi trang (`key`); section render sau (dữ liệu tải xong)
 * được bắt qua MutationObserver.
 * IntersectionObserver không báo khi tab đang ẩn, nên khi quay lại tab thì hiện ngay các section đang trong màn hình.
 */
export function useReveal(key: string): void {
  useLayoutEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    document.documentElement.classList.add('rv-on')

    const pending = () => document.querySelectorAll<HTMLElement>('main section:not(.in)')
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          entry.target.classList.add('in')
          observer.unobserve(entry.target)
        }
      },
      { threshold: 0.12 },
    )
    const watch = () => pending().forEach((section) => observer.observe(section))
    watch()
    const mutations = new MutationObserver(watch)
    mutations.observe(document.body, { childList: true, subtree: true })

    const revealInView = () => {
      if (document.visibilityState !== 'visible') return
      for (const section of pending()) {
        const rect = section.getBoundingClientRect()
        if (rect.top < window.innerHeight && rect.bottom > 0) section.classList.add('in')
      }
    }
    document.addEventListener('visibilitychange', revealInView)

    return () => {
      observer.disconnect()
      mutations.disconnect()
      document.removeEventListener('visibilitychange', revealInView)
    }
  }, [key])
}

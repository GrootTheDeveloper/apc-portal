import { useLayoutEffect, type RefObject } from 'react'

/**
 * Hiệu ứng fade-up cho các phần tử `.fade-up` trong `root`.
 *
 * An toàn theo tiến trình: mặc định nội dung hiện bình thường. Chỉ khi JS chạy
 * và người dùng không bật "giảm chuyển động", hook mới gắn class `reveal-on`
 * (kích hoạt trạng thái ẩn ban đầu) rồi cho từng phần tử hiện dần khi cuộn tới.
 *
 * Lưới an toàn: IntersectionObserver không phát callback khi tab bị ẩn, nên khi
 * người dùng chuyển tab đi rồi quay lại, các phần tử đang trong tầm nhìn có thể
 * kẹt ẩn. `visibilitychange` sẽ hiện ngay chúng khi trang hiển thị lại.
 */
export function useScrollReveal(root: RefObject<HTMLElement | null>): void {
  useLayoutEffect(() => {
    const rootEl = root.current
    if (!rootEl) return

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const elements = [...rootEl.querySelectorAll<HTMLElement>('.fade-up')]
    if (!elements.length) return

    rootEl.classList.add('reveal-on')

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible')
            observer.unobserve(entry.target)
          }
        }
      },
      { threshold: 0.1 },
    )
    for (const element of elements) observer.observe(element)

    const revealInView = () => {
      if (document.visibilityState !== 'visible') return
      for (const element of elements) {
        if (element.classList.contains('visible')) continue
        const rect = element.getBoundingClientRect()
        if (rect.top < window.innerHeight && rect.bottom > 0) {
          element.classList.add('visible')
          observer.unobserve(element)
        }
      }
    }
    document.addEventListener('visibilitychange', revealInView)

    return () => {
      observer.disconnect()
      document.removeEventListener('visibilitychange', revealInView)
      rootEl.classList.remove('reveal-on')
    }
  }, [root])
}

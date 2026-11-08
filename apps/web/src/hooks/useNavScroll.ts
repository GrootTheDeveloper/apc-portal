import { useEffect, useState } from 'react'

type NavScroll = { scrolled: boolean; down: boolean }

/**
 * Trạng thái cuộn cho thanh điều hướng: `scrolled` khi đã rời đỉnh trang (hiện mép dưới nav),
 * `down` khi đang cuộn xuống quá `threshold` px (nav trượt lên ẩn, cuộn ngược lại thì hiện).
 */
export function useNavScroll(threshold = 120): NavScroll {
  const [state, setState] = useState<NavScroll>({ scrolled: false, down: false })

  useEffect(() => {
    let lastY = window.scrollY
    const onScroll = () => {
      const y = window.scrollY
      const next = { scrolled: y > 20, down: y > lastY && y > threshold }
      lastY = y
      setState((prev) => (prev.scrolled === next.scrolled && prev.down === next.down ? prev : next))
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [threshold])

  return state
}

/** Dải gradient brand làm "đường nối" giữa các section. `thin` = 1px (mặc định 4px). */
export function SectionSeam({ thin = false }: { thin?: boolean }) {
  return (
    <div
      aria-hidden
      className={`${thin ? 'h-px' : 'h-1'} w-full bg-gradient-to-r from-apc-red via-apc-gold to-apc-blue`}
    />
  )
}

type PaginationProps = {
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
}

const KEY = 'grid h-11 min-w-11 place-items-center rounded-xl px-3 font-code text-[15px] font-bold transition-[transform,box-shadow,color] duration-150'
const IDLE = `${KEY} bg-paper text-ink shadow-[inset_0_0_0_2px_#081F3D,0_4px_0_#081F3D] hover:-translate-y-0.5 hover:text-apc-red active:translate-y-1 active:shadow-[inset_0_0_0_2px_#081F3D,0_0_0_#081F3D] disabled:pointer-events-none disabled:opacity-30`

/** Phân trang kiểu phím bàn phím (cùng họ với buttonClass); trang hiện tại là phím đã nhấn, nền xanh than. */
export function Pagination({ currentPage, totalPages, onPageChange }: PaginationProps) {
  if (totalPages <= 1) return null
  const pages = Array.from({ length: totalPages }, (_, index) => index + 1)

  return (
    <nav aria-label="Phân trang" className="flex flex-wrap items-center justify-center gap-2">
      <button type="button" disabled={currentPage <= 1} onClick={() => onPageChange(currentPage - 1)} className={IDLE} aria-label="Trang trước">
        ←
      </button>
      {pages.map((page) =>
        page === currentPage ? (
          <span key={page} aria-current="page" className={`${KEY} translate-y-1 bg-ink text-paper`}>
            {page}
          </span>
        ) : (
          <button key={page} type="button" onClick={() => onPageChange(page)} className={IDLE}>
            {page}
          </button>
        ),
      )}
      <button
        type="button"
        disabled={currentPage >= totalPages}
        onClick={() => onPageChange(currentPage + 1)}
        className={IDLE}
        aria-label="Trang sau"
      >
        →
      </button>
    </nav>
  )
}

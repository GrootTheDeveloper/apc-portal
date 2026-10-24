type PaginationProps = {
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
}

/** Component phân trang danh sách */
export function Pagination({ currentPage, totalPages, onPageChange }: PaginationProps) {
  if (totalPages <= 1) return null

  // Tạo mảng số trang hiển thị
  const pages: number[] = []
  for (let i = 1; i <= totalPages; i++) {
    pages.push(i)
  }

  return (
    <nav aria-label="Phân trang" className="flex items-center gap-1 sm:gap-2">
      <button
        type="button"
        disabled={currentPage <= 1}
        onClick={() => onPageChange(currentPage - 1)}
        className="flex h-10 w-10 items-center justify-center rounded-lg border border-outline-variant/30 text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface disabled:opacity-40 disabled:pointer-events-none"
        aria-label="Trang trước"
      >
        <span className="material-symbols-outlined text-sm">chevron_left</span>
      </button>

      {pages.map((page) => {
        const isActive = page === currentPage

        return (
          <button
            key={page}
            type="button"
            onClick={() => onPageChange(page)}
            className={`flex h-10 w-10 items-center justify-center rounded-lg text-sm font-medium transition-colors ${
              isActive
                ? 'bg-apc-blue text-white shadow-sm'
                : 'border border-outline-variant/30 text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'
            }`}
            aria-current={isActive ? 'page' : undefined}
          >
            {page}
          </button>
        )
      })}

      <button
        type="button"
        disabled={currentPage >= totalPages}
        onClick={() => onPageChange(currentPage + 1)}
        className="flex h-10 w-10 items-center justify-center rounded-lg border border-outline-variant/30 text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface disabled:opacity-40 disabled:pointer-events-none"
        aria-label="Trang sau"
      >
        <span className="material-symbols-outlined text-sm">chevron_right</span>
      </button>
    </nav>
  )
}

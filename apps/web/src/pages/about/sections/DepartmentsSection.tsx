import type { CSSProperties } from 'react'

import type { Department } from '../mock'
import { Eyebrow } from '../../../components/Eyebrow'

export function DepartmentsSection({ departments }: { departments: Department[] }) {
  const items = [...departments].sort((a, b) => a.order - b.order)

  return (
    <section className="bg-soft px-4 py-[clamp(56px,10vh,120px)] md:px-8">
      <div className="mx-auto w-full max-w-container-max">
        <Eyebrow data-rv className="text-apc-blue">
          ban chuyên môn
        </Eyebrow>
        <h2 data-rv className="mt-3 font-display text-[clamp(36px,4.4vw,64px)] font-extrabold leading-[0.95] tracking-[-0.03em]">
          Các ban đang hoạt động
        </h2>
        <p data-rv className="mt-4 max-w-[60ch] text-[17px] leading-relaxed text-muted">
          Đầu mối liên hệ là kênh chung của ban (email ban, fanpage hoặc chức danh), không phải thông tin cá nhân thành viên.
        </p>
        {items.length === 0 ? (
          <p className="py-16 font-display text-[clamp(22px,2.4vw,30px)] font-bold text-muted">Chưa có ban chuyên môn nào được công bố.</p>
        ) : (
          <ol className="mt-[clamp(32px,6vh,64px)] grid gap-x-16 md:grid-cols-2">
            {items.map((department, index) => (
              <li
                key={department.id}
                data-rv
                className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-6 border-t-2 border-ink py-8"
                style={{ '--d': `${index * 90}ms` } as CSSProperties}
              >
                <span className="font-display text-[44px] font-extrabold leading-[0.9] text-apc-blue">{String(index + 1).padStart(2, '0')}</span>
                <div className="min-w-0">
                  <h3 className="font-display text-[28px] font-bold leading-[1.1]">{department.name}</h3>
                  <p className="mt-2 text-[17px] leading-relaxed">{department.description}</p>
                  <p className="mt-4 break-words font-code text-[13px] font-bold text-muted">liên hệ · {department.contact}</p>
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  )
}

import { Eyebrow } from '../../../components/Eyebrow'
import type { AboutDepartment } from '../types'

export function DepartmentsSection({ departments }: { departments: AboutDepartment[] }) {
  const items = [...departments].sort((a, b) => a.order - b.order)

  return (
    <section className="w-full bg-white px-gutter py-16 md:py-section-padding">
      <div className="mx-auto w-full max-w-container-max">
        <Eyebrow className="mb-4 text-apc-red">Ban chuyên môn</Eyebrow>
        <h2 className="font-display-lg text-3xl font-bold leading-tight text-on-surface md:text-4xl">
          Các ban đang hoạt động
        </h2>
        <p className="mt-3 max-w-2xl text-on-surface-variant">
          Đầu mối liên hệ là kênh chung của ban (email ban, fanpage hoặc chức danh), không phải thông tin cá nhân thành
          viên.
        </p>
        {items.length === 0 ? (
          <p className="py-16 text-center text-on-surface-variant">Chưa có ban chuyên môn nào được công bố.</p>
        ) : (
          <ul className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {items.map((department) => (
              <li
                key={department.id}
                className="flex min-w-0 flex-col gap-4 rounded-2xl border border-outline-variant bg-surface-container-lowest p-6"
              >
                <h3 className="font-headline-sm text-xl font-bold text-on-surface">{department.name}</h3>
                <p className="flex-1 leading-relaxed text-on-surface-variant">{department.description}</p>
                <p className="text-sm text-on-surface-variant">
                  <span className="font-medium text-on-surface">Đầu mối liên hệ: </span>
                  {department.contact}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}

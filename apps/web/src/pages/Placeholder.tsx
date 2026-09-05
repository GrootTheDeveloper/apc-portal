import { Eyebrow } from './home/sections/Eyebrow'

/** Trang tạm cho route đã khai báo nhưng chưa dựng nội dung. Thay bằng trang thật ở các task sau. */
export function Placeholder({ title }: { title: string }) {
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-container-max flex-col justify-center px-gutter py-24">
      <Eyebrow>APC Portal</Eyebrow>
      <h1 className="mt-4 text-3xl font-bold text-on-surface md:text-4xl">{title}</h1>
      <p className="mt-3 text-on-surface-variant">Trang đang được xây dựng.</p>
    </main>
  )
}

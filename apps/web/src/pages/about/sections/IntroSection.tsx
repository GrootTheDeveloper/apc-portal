import { useNavigate } from 'react-router-dom'

import { Button } from '../../../components/Button'
import { Eyebrow } from '../../../components/Eyebrow'
import type { AboutData } from '../types'

export function IntroSection({ data }: { data: AboutData }) {
  const navigate = useNavigate()

  return (
    <section className="w-full bg-surface-container-low px-gutter py-16 md:py-section-padding">
      <div className="mx-auto flex w-full max-w-container-max flex-col gap-10 lg:flex-row lg:items-start lg:gap-16">
        <div className="min-w-0 flex-1">
          <Eyebrow className="mb-4 text-apc-blue">Giới thiệu</Eyebrow>
          <h1 className="font-display-lg text-3xl font-bold leading-tight text-on-surface md:text-5xl">{data.name}</h1>
          <p className="mt-6 text-lg leading-relaxed text-on-surface-variant">{data.description}</p>
          <Button className="mt-8" onClick={() => navigate('/recruitment')}>
            Gia nhập APC
          </Button>
        </div>
        <aside className="min-w-0 w-full rounded-2xl border border-outline-variant bg-surface-container-lowest p-6 md:p-8 lg:max-w-md">
          <h2 className="font-headline-sm text-xl font-bold text-on-surface">Sứ mệnh</h2>
          <p className="mt-4 leading-relaxed text-on-surface-variant">{data.mission}</p>
        </aside>
      </div>
    </section>
  )
}

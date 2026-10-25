import { Link } from 'react-router-dom'

import { buttonClass } from '../../../components/buttonClass'
import { PageHero } from '../../../components/PageHero'
import type { AboutData } from '../mock'

const MARK_PIECES = ['/assets/home/mark/mark-red.png', '/assets/home/mark/mark-gold.png', '/assets/home/mark/mark-blue.png']

export function IntroSection({ data }: { data: AboutData }) {
  return (
    <>
      <PageHero
        comment="giới thiệu"
        title={data.name}
        lede={data.description}
        aside={
          // logo ghép ba mảnh, rê chuột thì tách ra (index.css .mark-stack)
          <div aria-hidden className="mark-stack spread hidden w-[min(40vh,320px)] lg:block">
            {MARK_PIECES.map((src) => (
              <img key={src} alt="" src={src} />
            ))}
          </div>
        }
      >
        <Link className={buttonClass('light', 'mt-8')} to="/recruitment">
          Gia nhập APC →
        </Link>
      </PageHero>

      <section className="px-4 py-[clamp(56px,10vh,120px)] md:px-8">
        <div className="mx-auto grid w-full max-w-container-max gap-4 lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-10">
          <p data-rv className="pt-2 font-code text-[16px] font-bold text-apc-red">
            <span aria-hidden className="opacity-60">
              {'// '}
            </span>
            sứ mệnh
          </p>
          <p data-rv className="max-w-[34ch] font-display text-[clamp(26px,3vw,44px)] font-bold leading-[1.18] tracking-[-0.02em]">
            {data.mission}
          </p>
        </div>
      </section>
    </>
  )
}

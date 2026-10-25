import { Eyebrow } from '../../../components/Eyebrow'
import type { AboutData } from '../types'

export function ContactSection({ data }: { data: AboutData }) {
  return (
    <section className="w-full bg-surface-container-low px-gutter py-16 md:py-section-padding">
      <div className="mx-auto grid w-full max-w-container-max grid-cols-1 gap-12 lg:grid-cols-2">
        <div className="min-w-0">
          <Eyebrow className="mb-4 text-apc-gold">Liên hệ</Eyebrow>
          <h2 className="font-display-lg text-3xl font-bold leading-tight text-on-surface md:text-4xl">
            Thông tin liên hệ
          </h2>
          <ul className="mt-8 flex flex-col gap-5">
            <li className="rounded-2xl border border-outline-variant bg-surface-container-lowest p-6">
              <p className="text-sm font-medium text-on-surface-variant">Email</p>
              <a className="mt-1 inline-block break-all text-lg font-bold text-apc-blue hover:underline" href={`mailto:${data.contactEmail}`}>
                {data.contactEmail}
              </a>
            </li>
            <li className="rounded-2xl border border-outline-variant bg-surface-container-lowest p-6">
              <p className="text-sm font-medium text-on-surface-variant">Fanpage</p>
              <ExternalLink href={data.fanpage} label={data.fanpage} className="mt-1 break-all text-lg font-bold" />
            </li>
          </ul>
        </div>
        <div className="min-w-0">
          <Eyebrow className="mb-4 text-apc-blue">Liên kết chính thức</Eyebrow>
          <h2 className="font-display-lg text-3xl font-bold leading-tight text-on-surface md:text-4xl">
            Kênh và hệ thống ngoài
          </h2>
          <ul className="mt-8 flex flex-col gap-3">
            {data.officialLinks.map((link) => (
              <li key={link.url}>
                <ExternalLink
                  href={link.url}
                  label={link.label}
                  className="w-full justify-between break-words rounded-2xl border border-outline-variant bg-surface-container-lowest px-6 py-4 font-medium hover:border-outline"
                />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}

function ExternalLink({ href, label, className }: { href: string; label: string; className?: string }) {
  return (
    <a
      className={`inline-flex items-center gap-1 text-apc-blue hover:underline ${className ?? ''}`}
      href={href}
      target="_blank"
      rel="noopener noreferrer"
    >
      {label}
      <span aria-hidden="true">↗</span>
      <span className="sr-only"> (mở tab mới)</span>
    </a>
  )
}

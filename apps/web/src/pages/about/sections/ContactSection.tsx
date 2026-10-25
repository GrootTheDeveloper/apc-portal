import type { AboutData } from '../mock'
import { Eyebrow } from '../../../components/Eyebrow'

export function ContactSection({ data }: { data: AboutData }) {
  return (
    <section className="px-4 py-[clamp(56px,10vh,120px)] md:px-8">
      <div className="mx-auto grid w-full max-w-container-max gap-14 lg:grid-cols-2 lg:gap-16">
        <div className="min-w-0">
          <Eyebrow data-rv className="text-apc-red">
            liên hệ
          </Eyebrow>
          <h2 data-rv className="mt-3 font-display text-[clamp(36px,4.4vw,64px)] font-extrabold leading-[0.95] tracking-[-0.03em]">
            Nhắn cho APC
          </h2>
          <dl className="mt-8 border-t-2 border-ink">
            <div className="border-b-2 border-ink py-5">
              <dt className="font-code text-[13px] font-bold text-muted">email</dt>
              <dd className="mt-1">
                <a
                  className="break-all font-display text-[clamp(24px,2.6vw,36px)] font-bold text-apc-red underline decoration-2 underline-offset-4 hover:text-apc-red-deep"
                  href={`mailto:${data.contactEmail}`}
                >
                  {data.contactEmail}
                </a>
              </dd>
            </div>
            <div className="border-b-2 border-ink py-5">
              <dt className="font-code text-[13px] font-bold text-muted">fanpage</dt>
              <dd className="mt-1">
                <ExternalLink href={data.fanpage} label={data.fanpage} className="break-all text-[18px] font-bold text-apc-blue underline decoration-2 underline-offset-4" />
              </dd>
            </div>
          </dl>
        </div>
        <div className="min-w-0">
          <Eyebrow data-rv className="text-apc-blue">
            liên kết chính thức
          </Eyebrow>
          <h2 data-rv className="mt-3 font-display text-[clamp(36px,4.4vw,64px)] font-extrabold leading-[0.95] tracking-[-0.03em]">
            Kênh và hệ thống
          </h2>
          <ul className="mt-8 border-t-2 border-ink">
            {data.officialLinks.map((link) => (
              <li key={link.url} className="border-b-2 border-ink">
                <ExternalLink
                  href={link.url}
                  label={link.label}
                  className="flex min-h-16 w-full justify-between py-4 font-display text-[22px] font-bold hover:text-apc-red"
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
      className={`inline-flex items-center gap-2 transition-colors ${className ?? ''}`}
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

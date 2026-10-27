import { useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'

import { buttonClass } from '../../../components/buttonClass'
import { Eyebrow } from '../../../components/Eyebrow'
import { useApi } from '../../../hooks/useApi'
import type { Page } from '../../../lib/api'
import type { ProjectItem } from '../../../lib/content'

const delay = (ms: number) => ({ '--d': `${ms}ms` }) as CSSProperties

export function ProjectsSection() {
  // 3 dự án mới nhất xem từng cái trong khung ảnh có nút chọn; các dự án kế tiếp liệt kê như `ls` trong terminal.
  // T4 đổi sang GET /public/home (ưu tiên dự án nổi bật).
  const { data } = useApi<Page<ProjectItem>>('/public/projects?page=1&pageSize=8')
  const projects = data?.items ?? []
  const featured = projects.slice(0, 3)
  const others = projects.slice(3)
  const [active, setActive] = useState(0)
  const current = featured[active]

  // Đang tải, lỗi hoặc chưa có dự án công bố: ẩn cả khối, không để khoảng trống (FLOW-01)
  if (!current) return null

  return (
    <section className="screen flex items-center overflow-hidden bg-ink px-4 py-[clamp(40px,8vh,96px)] text-paper md:px-8">
      <div className="mx-auto grid w-full max-w-container-max items-center gap-16 lg:grid-cols-[0.9fr_1.1fr]">
        <div>
          <Eyebrow data-rv className="text-apc-gold-soft">
            làm ra là để dùng
          </Eyebrow>
          <h2
            data-rv
            className="mt-3 font-display text-[clamp(40px,min(5.6vw,8.5vh),92px)] font-extrabold leading-[0.92] tracking-[-0.035em]"
            style={delay(60)}
          >
            Sản phẩm thật,
            <br />
            <span className="text-apc-gold">người dùng thật.</span>
          </h2>
          <p data-rv className="mt-6 max-w-[44ch] text-[19px] leading-relaxed text-paper/85" style={delay(120)}>
            UMTOJ chấm bài cho sinh viên UMT, APC Event Manager lo điểm danh và certificate. Dự án nào cũng bắt đầu từ ý
            tưởng của một thành viên.
          </p>
          {others.length > 0 && (
            <div data-rv className="mt-[clamp(16px,3.5vh,32px)] rounded-2xl bg-[#0D2A50] p-5 font-code text-[15px] leading-[1.8]" style={delay(180)}>
              <p className="text-paper/60">
                <span className="text-apc-gold">apc@umt</span>:~$ ls projects/
              </p>
              <ul className="flex flex-wrap gap-x-5 text-[#7FB5F5]">
                {others.map((project) => (
                  <li key={project.slug}>
                    <Link className="hover:text-apc-gold-soft hover:underline" to={`/projects/${project.slug}`}>
                      {project.slug}/
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div data-rv className="mt-[clamp(20px,4vh,36px)]" style={delay(240)}>
            <Link className={buttonClass('light')} to="/projects">
              Xem tất cả dự án →
            </Link>
          </div>
        </div>

        {/* Dự án mới nhất: một khung ảnh, nút tên dự án ở trên để đổi; chưa có ảnh thì khung dòng lệnh */}
        <div data-rv="right" className="min-w-0" style={delay(160)}>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Chọn dự án">
            {featured.map((project, index) => (
              <button
                key={project.slug}
                aria-pressed={index === active}
                className={`rounded-xl px-4 py-2 font-code text-[14px] font-bold transition-colors ${
                  index === active ? 'bg-apc-gold text-ink' : 'bg-paper/10 text-paper/80 hover:bg-paper/20 hover:text-paper'
                }`}
                onClick={() => setActive(index)}
                type="button"
              >
                {project.title}
              </button>
            ))}
          </div>
          <Link className="group mt-4 block" to={`/projects/${current.slug}`}>
            <div className="photo relative aspect-[16/10] bg-[#0D2A50]">
              {featured.map((project, index) =>
                project.thumbnailUrl ? (
                  <img
                    key={project.slug}
                    alt={index === active ? `Giao diện ${project.title}` : ''}
                    className={`stage-photo absolute inset-0 h-full w-full object-cover ${index === active ? 'is-on' : ''}`}
                    height={288}
                    loading="lazy"
                    src={project.thumbnailUrl}
                    width={512}
                  />
                ) : (
                  index === active && (
                    <p key={project.slug} className="absolute inset-0 flex flex-col justify-end p-6 font-code text-[16px] font-bold text-paper/60">
                      <span>
                        <span className="text-apc-gold">apc@umt</span>:~$ cd
                      </span>
                      <span className="truncate text-[22px] text-paper">{project.slug}/</span>
                    </p>
                  )
                ),
              )}
            </div>
            <div key={current.slug} className="fade-in mt-[clamp(14px,2.6vh,22px)]">
              {(current.technologies ?? []).length > 0 && (
                <p className="flex flex-wrap items-center gap-2 font-code text-[13px] font-bold">
                  {(current.technologies ?? []).map((tech) => (
                    <span key={tech} className="rounded-md bg-paper/10 px-2 py-0.5 text-paper/75">
                      {tech}
                    </span>
                  ))}
                </p>
              )}
              <p className="mt-2.5 line-clamp-2 max-w-[60ch] text-[clamp(15px,2.2vh,17px)] leading-relaxed text-paper/85">{current.description}</p>
              <p className="mt-2 inline-flex items-center gap-2 font-extrabold text-apc-gold-soft">
                Xem dự án <span className="transition-transform group-hover:translate-x-1.5">→</span>
              </p>
            </div>
          </Link>
        </div>
      </div>
    </section>
  )
}

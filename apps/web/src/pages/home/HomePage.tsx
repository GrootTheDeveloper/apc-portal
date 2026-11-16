import { useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'

import { buttonClass } from '../../components/buttonClass'
import { useApi } from '../../hooks/useApi'
import type { HomeData } from '../admin/organization/types'
import { ActivitiesSection } from './sections/ActivitiesSection'
import { EventsSection } from './sections/EventsSection'
import { HeroSection } from './sections/HeroSection'
import { JoinSection } from './sections/JoinSection'
import { JudgeSection } from './sections/JudgeSection'
import { NewsSection } from './sections/NewsSection'
import { ProjectsSection } from './sections/ProjectsSection'
import { ValuesSection } from './sections/ValuesSection'
import './home.css'

export function HomePage() {
  const location = useLocation()
  const isPreview = !!location.state?.previewFeatured
  const { data } = useApi<HomeData>('/public/home')

  // Trang chủ: mỗi phần vừa một màn hình và cuộn luôn hít trọn vào một phần (CSS trong home.css, chỉ áp dụng màn rộng).
  useEffect(() => {
    document.documentElement.classList.add('snap-home')
    return () => document.documentElement.classList.remove('snap-home')
  }, [])

  return (
    <main>
      {isPreview && (
        <div className="sticky top-0 z-30 flex flex-wrap items-center justify-between gap-3 border-b-2 border-ink bg-apc-gold px-6 py-3 font-bold text-ink">
          <div className="flex items-center gap-3">
            <span className="font-code text-xs uppercase text-ink/75">{'// xem trước'}</span>
            <span>Chế độ xem trước trang chủ (Nội dung nổi bật)</span>
          </div>
          <Link className={buttonClass('outline')} to="/admin/organization/featured-content">
            ← Quay lại quản lý
          </Link>
        </div>
      )}
      <HeroSection />
      <ValuesSection />
      <ActivitiesSection />
      <EventsSection items={data?.events} />
      <JudgeSection />
      <ProjectsSection items={data?.projects} />
      <NewsSection items={data?.news} />
      <JoinSection />
    </main>
  )
}

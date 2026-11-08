import { useEffect } from 'react'

import { HeroSection } from './sections/HeroSection'
import { ValuesSection } from './sections/ValuesSection'
import { ActivitiesSection } from './sections/ActivitiesSection'
import { EventsSection } from './sections/EventsSection'
import { JudgeSection } from './sections/JudgeSection'
import { ProjectsSection } from './sections/ProjectsSection'
import { NewsSection } from './sections/NewsSection'
import { JoinSection } from './sections/JoinSection'
import './home.css'

export function HomePage() {
  // Trang chủ: mỗi phần vừa một màn hình và cuộn luôn hít trọn vào một phần (CSS trong home.css, chỉ áp dụng màn rộng).
  useEffect(() => {
    document.documentElement.classList.add('snap-home')
    return () => document.documentElement.classList.remove('snap-home')
  }, [])

  return (
    <main>
      <HeroSection />
      <ValuesSection />
      <ActivitiesSection />
      <EventsSection />
      <JudgeSection />
      <ProjectsSection />
      <NewsSection />
      <JoinSection />
    </main>
  )
}

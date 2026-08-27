import { useRef } from 'react'

import { useScrollReveal } from './hooks/useScrollReveal'
import { Navbar } from './sections/Navbar'
import { HeroSection } from './sections/HeroSection'
import { ValuesSection } from './sections/ValuesSection'
import { ActivitiesSection } from './sections/ActivitiesSection'
import { ProjectsSection } from './sections/ProjectsSection'
import { EventsSection } from './sections/EventsSection'
import { NewsSection } from './sections/NewsSection'
import { PartnersSection } from './sections/PartnersSection'
import { HostSection } from './sections/HostSection'
import { JoinSection } from './sections/JoinSection'
import { SectionSeam } from './sections/SectionSeam'
import { SiteFooter } from './sections/SiteFooter'
import './home.css'

export function HomePage() {
  const rootRef = useRef<HTMLDivElement>(null)
  useScrollReveal(rootRef)

  return (
    <div ref={rootRef}>
      <Navbar />
      <main>
        <HeroSection />
        <SectionSeam thin />
        <ValuesSection />
        <SectionSeam thin />
        <ActivitiesSection />
        <SectionSeam thin />
        <ProjectsSection />
        <SectionSeam thin />
        <EventsSection />
        <SectionSeam thin />
        <NewsSection />
        <SectionSeam thin />
        <PartnersSection />
        <SectionSeam thin />
        <HostSection />
        <SectionSeam thin />
        <JoinSection />
      </main>
      <SiteFooter />
    </div>
  )
}

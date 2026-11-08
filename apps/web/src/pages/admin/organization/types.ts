import type { EventListItem } from '../../events/types'
import type { NewsItem, ProjectItem } from '../../../lib/content'

export type OfficialLink = {
  label: string
  url: string
}

export type OrganizationProfile = {
  name: string
  description: string
  mission: string
  contactEmail: string
  fanpage: string
  officialLinks: OfficialLink[]
  termEndsAt: string | null
}

export type ActiveMember = {
  id: string
  fullName: string
  studentId: string | null
  email: string
}

export type AdminDepartment = {
  id: string
  name: string
  code: string
  description: string
  contactPoint: string
  status: 'ACTIVE' | 'ARCHIVED'
  order: number
  activeMemberCount?: number
  activeMembers?: ActiveMember[]
  createdAt?: string
  updatedAt?: string
}

export type FeaturedCandidates = {
  posts: Array<{
    id: string
    title: string
    slug: string
    category: string
    publishedAt: string | null
  }>
  events: Array<{
    id: string
    title: string
    slug: string
    eventType: string
    status: string
    startAt: string
    endAt: string
  }>
  projects: Array<{
    id: string
    title: string
    slug: string
    publishedAt: string | null
  }>
}

export type FeaturedContentData = {
  selected: {
    postIds: string[]
    eventIds: string[]
    projectIds: string[]
  }
  candidates: FeaturedCandidates
}

export type HomeData = {
  news: NewsItem[]
  events: EventListItem[]
  projects: ProjectItem[]
}

export type RecruitmentDepartment = {
  id: string
  name: string
  code: string
  description?: string | null
}

export type RecruitmentRoundStatus = 'DRAFT' | 'OPEN' | 'CLOSED' | 'ARCHIVED'

export type QuestionType = 'short_text' | 'long_text' | 'single_choice' | 'multiple_choice'

export type QuestionOption = {
  id: string
  label: string
}

export type RecruitmentQuestion = {
  id: string
  type: QuestionType
  label: string
  required?: boolean
  options?: QuestionOption[]
  hidden?: boolean
}

export type RecruitmentRound = {
  id: string
  title: string
  slug: string
  description: string
  audience: string
  requirements: string
  status: RecruitmentRoundStatus
  opensAt: string
  closesAt: string
  questions: RecruitmentQuestion[]
  departments: RecruitmentDepartment[]
  _count?: { applications: number }
  createdAt: string
  updatedAt: string
}
export type ApplicationStatus =
  | 'NEW'
  | 'REVIEWING'
  | 'INTERVIEW'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'WITHDRAWN'

export type LookupApplicationResult = {
  profileCode: string
  applicantName: string
  roundTitle: string
  roundSlug: string
  desiredDepartmentName: string
  status: ApplicationStatus
  submittedAt: string
  updatedAt: string
  canWithdraw: boolean
}

export type ApplicationListItem = {
  id: string
  profileCode: string
  applicantName: string
  applicantEmail: string
  studentId: string
  faculty: string | null
  major: string | null
  cohort: string | null
  desiredDepartmentId: string | null
  desiredDepartment: { id: string; name: string; code: string } | null
  status: ApplicationStatus
  internalNote: string | null
  reviewedAt: string | null
  reviewedBy: { id: string; fullName: string; username: string } | null
  submittedAt: string
  updatedAt: string
}

export type ApplicationStatusHistoryItem = {
  id: string
  applicationId: string
  fromStatus: ApplicationStatus
  toStatus: ApplicationStatus
  reason: string | null
  changedById: string
  changedBy: { id: string; fullName: string; username: string; avatarUrl: string | null }
  changedAt: string
}

export type ApplicationDetail = {
  id: string
  profileCode: string
  recruitmentRoundId: string
  recruitmentRound: {
    id: string
    title: string
    slug: string
    questions: RecruitmentQuestion[]
  }
  applicantName: string
  applicantEmail: string
  studentId: string
  faculty: string | null
  major: string | null
  cohort: string | null
  desiredDepartmentId: string | null
  desiredDepartment: { id: string; name: string; code: string } | null
  skills: string | null
  experience: string | null
  answers: Record<string, unknown> | null
  status: ApplicationStatus
  internalNote: string | null
  reviewedById: string | null
  reviewedBy: { id: string; fullName: string; username: string; avatarUrl: string | null } | null
  reviewedAt: string | null
  convertedUserId: string | null
  convertedUser: { id: string; fullName: string; username: string } | null
  convertedAt: string | null
  statusHistories: ApplicationStatusHistoryItem[]
  submittedAt: string
  updatedAt: string
}

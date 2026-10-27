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
export type RoleName = 'MEMBER' | 'DEPARTMENT_MANAGER' | 'BOARD' | 'TECH_ADMIN'
export type MemberStatus = 'ACTIVE' | 'PAUSED' | 'LEFT'
export type AccountStatus = 'PENDING_ACTIVATION' | 'ACTIVE' | 'LOCKED' | 'INACTIVE'
export type AttendanceStatus = 'NOT_MARKED' | 'PRESENT' | 'EXCUSED' | 'ABSENT'

export const ROLE_LABEL: Record<RoleName, string> = {
  MEMBER: 'Thành viên',
  DEPARTMENT_MANAGER: 'Quản lý ban',
  BOARD: 'Ban Chủ nhiệm',
  TECH_ADMIN: 'Quản trị viên kỹ thuật',
}

export const MEMBER_STATUS_LABEL: Record<MemberStatus, string> = {
  ACTIVE: 'Đang hoạt động',
  PAUSED: 'Tạm ngưng',
  LEFT: 'Ngừng tham gia',
}

export const ACCOUNT_STATUS_LABEL: Record<AccountStatus, string> = {
  PENDING_ACTIVATION: 'Chờ kích hoạt',
  ACTIVE: 'Đang hoạt động',
  LOCKED: 'Bị khóa',
  INACTIVE: 'Ngừng hoạt động',
}

export const ATTENDANCE_STATUS_LABEL: Record<AttendanceStatus, string> = {
  NOT_MARKED: 'Chưa điểm danh',
  PRESENT: 'Có mặt',
  EXCUSED: 'Có phép',
  ABSENT: 'Vắng',
}

export type MemberListItem = {
  id: string
  fullName: string
  studentId: string | null
  email: string
  avatarUrl: string | null
  memberStatus: MemberStatus
  accountStatus: AccountStatus
  createdAt: string
  department: { id: string; name: string; code: string } | null
  roles: { role: RoleName; departmentId: string | null }[]
}

export type MemberDetail = {
  profile: {
    id: string
    fullName: string
    studentId: string | null
    email: string
    contactEmail: string | null
    faculty: string | null
    major: string | null
    cohort: string | null
    avatarUrl: string | null
    phoneNumber: string | null
    skills: unknown
    interestAreas: unknown
    accountStatus: AccountStatus
    createdAt: string
    updatedAt: string
    deactivatedAt: string | null
  }
  organization: {
    department: { id: string; name: string; code: string; status: string } | null
    memberStatus: MemberStatus
    roles: {
      id: string
      role: RoleName
      status: string
      departmentId: string | null
      department: { id: string; name: string } | null
      startsAt: string
      expiresAt: string | null
    }[]
  }
  activity: {
    eventRegistrations: {
      id: string
      status: string
      attendanceStatus: AttendanceStatus
      registeredAt: string
      event: {
        id: string
        title: string
        startAt: string
        endAt: string
        location: string | null
        status: string
      }
    }[]
  }
}

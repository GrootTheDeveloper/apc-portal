import { describe, expect, it } from 'vitest'

import {
  ATTENDANCE_LABELS,
  ATTENDANCE_OPTIONS,
  attendanceSummary,
  canEditAttendance,
} from './attendanceState'

describe('attendanceSummary', () => {
  it('đếm đúng từng kết quả điểm danh', () => {
    const summary = attendanceSummary([
      { attendanceStatus: 'PRESENT' },
      { attendanceStatus: 'PRESENT' },
      { attendanceStatus: 'EXCUSED' },
      { attendanceStatus: 'ABSENT' },
      { attendanceStatus: 'NOT_MARKED' },
    ])
    expect(summary).toEqual({ NOT_MARKED: 1, PRESENT: 2, EXCUSED: 1, ABSENT: 1 })
  })

  it('danh sách rỗng trả bộ đếm 0', () => {
    expect(attendanceSummary([])).toEqual({ NOT_MARKED: 0, PRESENT: 0, EXCUSED: 0, ABSENT: 0 })
  })
})

describe('canEditAttendance (docs/02 mục 8.3)', () => {
  it('trước khi chốt cả BOARD lẫn quản lý ban sửa được', () => {
    expect(canEditAttendance(true, false)).toBe(true)
    expect(canEditAttendance(false, false)).toBe(true)
  })

  it('sau khi chốt chỉ BOARD sửa được', () => {
    expect(canEditAttendance(true, true)).toBe(true)
    expect(canEditAttendance(false, true)).toBe(false)
  })
})

describe('nhãn và thứ tự nút', () => {
  it('bốn kết quả điểm danh đều có nhãn tiếng Việt và đủ trong danh sách nút (EVT-13)', () => {
    for (const status of ATTENDANCE_OPTIONS) {
      expect(ATTENDANCE_LABELS[status]).toBeTruthy()
    }
    expect(ATTENDANCE_OPTIONS).toEqual(['NOT_MARKED', 'PRESENT', 'EXCUSED', 'ABSENT'])
  })
})

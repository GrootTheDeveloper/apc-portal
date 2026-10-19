import { describe, expect, it } from 'vitest'

import { addMonths, calendarCells, monthKeyOf, parseMonthKey } from './vnTime'

describe('calendarCells', () => {
  it('đặt ngày 1 vào đúng cột thứ (cột đầu là thứ Hai)', () => {
    // 01/10/2026 là thứ Năm, 01/06/2026 là thứ Hai, 01/02/2026 là Chủ nhật.
    expect(calendarCells(2026, 10).findIndex((cell) => cell.inMonth)).toBe(3)
    expect(calendarCells(2026, 6).findIndex((cell) => cell.inMonth)).toBe(0)
    expect(calendarCells(2026, 2).findIndex((cell) => cell.inMonth)).toBe(6)
  })

  it('luôn có 42 ô, ô ngoài tháng lấy ngày của tháng trước và sau', () => {
    const cells = calendarCells(2026, 10)
    expect(cells).toHaveLength(42)
    expect(cells[0]).toEqual({ day: 28, inMonth: false })
    expect(cells.filter((cell) => cell.inMonth)).toHaveLength(31)
    expect(cells[34]).toEqual({ day: 1, inMonth: false })
  })
})

describe('month key', () => {
  it('xếp sự kiện theo tháng của giờ Việt Nam', () => {
    expect(monthKeyOf('2026-10-31T18:00:00Z')).toBe('2026-11')
  })

  it('chuyển tháng qua năm và từ chối ?month= sai', () => {
    expect(addMonths('2026-12', 1)).toBe('2027-01')
    expect(addMonths('2026-01', -1)).toBe('2025-12')
    expect(parseMonthKey('2026-13')).toBeNull()
    expect(parseMonthKey('abc')).toBeNull()
  })
})

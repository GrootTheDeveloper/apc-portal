import { describe, expect, it } from 'vitest'

import { roundPhase, sortRounds } from './roundPhase'

const now = new Date('2026-10-24T05:00:00Z')
const round = (slug: string, status: 'OPEN' | 'CLOSED', opensAt: string, closesAt: string) => ({ slug, status, opensAt, closesAt })

const open = round('open', 'OPEN', '2026-10-01T00:00:00Z', '2026-10-31T00:00:00Z')
const upcoming = round('upcoming', 'OPEN', '2026-11-15T00:00:00Z', '2026-11-30T00:00:00Z')
const closedOld = round('closed-old', 'CLOSED', '2025-10-01T00:00:00Z', '2025-10-25T00:00:00Z')
const expired = round('expired', 'OPEN', '2026-09-01T00:00:00Z', '2026-09-30T00:00:00Z')

describe('roundPhase', () => {
  it('phân biệt đang mở, sắp mở, đã đóng', () => {
    expect(roundPhase(open, now)).toBe('open')
    expect(roundPhase(upcoming, now)).toBe('upcoming')
    expect(roundPhase(closedOld, now)).toBe('closed')
  })

  it('đợt OPEN đã quá hạn nhận đơn tính là đã đóng', () => {
    expect(roundPhase(expired, now)).toBe('closed')
  })
})

describe('sortRounds', () => {
  it('đợt đang mở lên đầu, rồi sắp mở, rồi đã đóng mới nhất trước', () => {
    expect(sortRounds([closedOld, upcoming, expired, open], now).map((r) => r.slug)).toEqual([
      'open',
      'upcoming',
      'expired',
      'closed-old',
    ])
  })
})

import { expect, it } from 'vitest'

import { formatDate, formatDateTime, formatTime, vnParts } from './format'

it('shows Vietnam time for UTC timestamps', () => {
  expect(formatDate('2026-09-27T17:30:00Z')).toBe('28/09/2026')
  expect(formatDateTime('2026-09-27T17:30:00Z')).toBe('00:30 28/09/2026')
  expect(formatTime('2026-09-27T17:30:00Z')).toBe('00:30')
  expect(vnParts('2026-09-27T17:30:00Z')).toEqual({ year: 2026, month: 9, day: 28, hour: 0, minute: 30 })
})

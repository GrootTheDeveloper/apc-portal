import { expect, it } from 'vitest'

import { formatDate, formatDateTime } from './format'

it('shows Vietnam time for UTC timestamps', () => {
  expect(formatDate('2026-09-27T17:30:00Z')).toBe('28/09/2026')
  expect(formatDateTime('2026-09-27T17:30:00Z')).toBe('00:30 28/09/2026')
})

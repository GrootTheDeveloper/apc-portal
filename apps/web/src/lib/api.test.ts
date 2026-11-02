import { expect, it } from 'vitest'

import { ApiError, endsSession } from './api'

it('signs the user out only on 401, not on network errors or 502/503 while the server restarts', () => {
  expect(endsSession(new ApiError(401, 'unauthenticated', 'Hết phiên'))).toBe(true)
  for (const status of [0, 403, 404, 500, 502, 503]) expect(endsSession(new ApiError(status, 'x', 'y'))).toBe(false)
  expect(endsSession(new Error('khác'))).toBe(false)
})

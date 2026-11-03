import { describe, expect, it } from 'vitest'

import { cancellationOpen, guestRegistrationState } from './types'

const HOUR_MS = 3_600_000
const fromNow = (hours: number) => new Date(Date.now() + hours * HOUR_MS).toISOString()

const event = (overrides: {
  status?: 'PUBLISHED' | 'CANCELLED' | 'ENDED'
  allowGuestRegistration?: boolean
  registrationOpensAt?: string | null
  registrationClosesAt?: string | null
  endAt?: string
} = {}) => ({
  status: overrides.status ?? ('PUBLISHED' as const),
  allowGuestRegistration: overrides.allowGuestRegistration ?? true,
  registrationOpensAt: overrides.registrationOpensAt ?? null,
  registrationClosesAt: overrides.registrationClosesAt ?? null,
  endAt: overrides.endAt ?? fromNow(48),
})

const registration = (overrides: {
  status?: 'REGISTERED' | 'CANCELLED'
  eventStatus?: 'PUBLISHED' | 'CANCELLED' | 'ENDED'
  endAt?: string
  registrationClosesAt?: string | null
} = {}) => ({
  status: overrides.status ?? ('REGISTERED' as const),
  event: {
    status: overrides.eventStatus ?? ('PUBLISHED' as const),
    endAt: overrides.endAt ?? fromNow(48),
    registrationClosesAt: overrides.registrationClosesAt ?? null,
  },
})

describe('guestRegistrationState', () => {
  it('chỉ mở đăng ký khi PUBLISHED, chưa diễn ra, trong thời gian và cho phép khách', () => {
    expect(guestRegistrationState(event({}))).toBe('open')
    expect(guestRegistrationState(event({ status: 'CANCELLED' }))).toBeNull()
    expect(guestRegistrationState(event({ status: 'ENDED' }))).toBeNull()
    // PUBLISHED đã qua endAt (chờ tác vụ event-end): coi như đã kết thúc
    expect(guestRegistrationState(event({ endAt: fromNow(-1) }))).toBeNull()
    expect(guestRegistrationState(event({ allowGuestRegistration: false }))).toBe('guests_off')
    expect(guestRegistrationState(event({ registrationOpensAt: fromNow(2) }))).toBe('not_open')
    expect(guestRegistrationState(event({ registrationClosesAt: fromNow(-2) }))).toBe('closed')
  })
})

describe('cancellationOpen', () => {
  it('chỉ cho hủy khi REGISTERED, sự kiện PUBLISHED, chưa diễn ra và còn trong hạn hủy', () => {
    expect(cancellationOpen(registration({}))).toBe(true)
    expect(cancellationOpen(registration({ status: 'CANCELLED' }))).toBe(false)
    expect(cancellationOpen(registration({ eventStatus: 'ENDED' }))).toBe(false)
    expect(cancellationOpen(registration({ eventStatus: 'CANCELLED' }))).toBe(false)
    expect(cancellationOpen(registration({ endAt: fromNow(-1) }))).toBe(false)
    expect(cancellationOpen(registration({ registrationClosesAt: fromNow(-1) }))).toBe(false)
    expect(cancellationOpen(registration({ registrationClosesAt: fromNow(2) }))).toBe(true)
  })
})

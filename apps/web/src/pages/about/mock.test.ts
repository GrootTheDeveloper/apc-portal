import { describe, expect, it } from 'vitest'

import { MOCK_ABOUT } from './mock'

const PERSONAL_PHONE = /(?:\+84|0)\d[\d\s.-]{8,}/
const PERSONAL_EMAIL_HOST = /@(gmail|yahoo|outlook|hotmail)\./i

describe('MOCK_ABOUT (PAGE-PUB-02)', () => {
  it('does not include member personal fields or personal contact details', () => {
    const blob = JSON.stringify(MOCK_ABOUT)
    expect(blob).not.toMatch(/studentId|phoneNumber|fullName|contactEmail of member/i)
    expect(blob).not.toMatch(PERSONAL_PHONE)
    expect(blob).not.toMatch(PERSONAL_EMAIL_HOST)
    for (const department of MOCK_ABOUT.departments) {
      expect(department.contact).not.toMatch(PERSONAL_PHONE)
      expect(department.contact).not.toMatch(PERSONAL_EMAIL_HOST)
    }
  })

  it('keeps official links on http(s) for the T2 public about payload shape', () => {
    expect(MOCK_ABOUT).not.toHaveProperty('termEndsAt')
    expect(MOCK_ABOUT.departments.map((d) => d.order)).toEqual([...MOCK_ABOUT.departments.map((d) => d.order)].sort((a, b) => a - b))
    for (const link of MOCK_ABOUT.officialLinks) {
      expect(link.url).toMatch(/^https?:\/\//)
    }
    expect(MOCK_ABOUT.fanpage).toMatch(/^https?:\/\//)
  })
})

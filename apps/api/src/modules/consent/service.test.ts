import { describe, expect, it, beforeEach } from 'vitest'
import { recordConsent } from './service.js'
import { db } from '../../db/client.js'

describe('Consent Service', () => {
  beforeEach(async () => {
    // Delete test data
    await db.consentRecord.deleteMany()
  })

  describe('recordConsent', () => {
    it('should create a consent record with required fields', async () => {
      const result = await recordConsent({
        email: 'test@example.com',
        purpose: 'MEMBERSHIP_APPLICATION',
        privacyVersion: 'v1.0'
      })

      expect(result.id).toBeDefined()
      expect(result.email).toBe('test@example.com')
      expect(result.purpose).toBe('MEMBERSHIP_APPLICATION')
      expect(result.privacyVersion).toBe('v1.0')
      expect(result.userId).toBeNull()

      const count = await db.consentRecord.count()
      expect(count).toBe(1)
    })

    it('should create a consent record with optional fields', async () => {
      const result = await recordConsent({
        email: 'test2@example.com',
        purpose: 'EVENT_REGISTRATION',
        privacyVersion: 'v1.1',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla'
      })

      expect(result.email).toBe('test2@example.com')
      expect(result.userId).toBeNull()
      expect(result.ipAddress).toBe('192.168.1.1')
      expect(result.userAgent).toBe('Mozilla')
    })
  })
})

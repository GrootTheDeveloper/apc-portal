import { describe, expect, it, beforeEach } from 'vitest'
import { audit, maskSensitiveData } from './service.js'
import { db } from '../../db/client.js'

describe('Audit Service', () => {
  beforeEach(async () => {
    await db.auditLog.deleteMany()
  })

  describe('maskSensitiveData', () => {
    it('should mask sensitive fields in object', () => {
      const data = {
        name: 'John',
        password: 'secret_password',
        Token: 'abc123token',
        nested: {
          secretKey: 'do_not_leak',
          age: 30
        }
      }
      
      const masked = maskSensitiveData(data)
      
      expect(masked?.name).toBe('John')
      expect(masked?.password).toBe('***MASKED***')
      expect(masked?.Token).toBe('***MASKED***')
      expect(masked?.nested.secretKey).toBe('***MASKED***')
      expect(masked?.nested.age).toBe(30)
    })

    it('should handle undefined', () => {
      expect(maskSensitiveData(undefined)).toBeUndefined()
    })
  })

  describe('audit', () => {
    it('should create an audit log entry', async () => {
      const result = await audit({
        action: 'CREATE',
        resourceType: 'USER',
        isSuccess: true,
        reason: 'User created successfully'
      })

      expect(result.id).toBeDefined()
      expect(result.action).toBe('CREATE')
      expect(result.resourceType).toBe('USER')
      expect(result.isSuccess).toBe(true)

      const count = await db.auditLog.count()
      expect(count).toBe(1)
    })
    
    it('should save masked details', async () => {
      const result = await audit({
        action: 'UPDATE',
        resourceType: 'SYSTEM',
        isSuccess: true,
        details: { foo: 'bar', password: '123' }
      })
      
      // JSON in Prisma might return as Prisma.JsonValue, Vitest deep equal works on it
      expect(result.details).toEqual({ foo: 'bar', password: '***MASKED***' })
    })
  })
})

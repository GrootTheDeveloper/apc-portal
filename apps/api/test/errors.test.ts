import { z } from 'zod'
import { describe, expect, it } from 'vitest'

import { buildApp } from '../src/app.js'
import { loadConfig } from '../src/config.js'
import { conflict, forbidden } from '../src/lib/errors.js'
import { hashPassword, verifyPassword } from '../src/lib/password.js'

function appWithRoutes() {
  const app = buildApp(loadConfig({ NODE_ENV: 'test' }))
  app.get('/forbidden', async () => {
    throw forbidden()
  })
  app.get('/conflict', async () => {
    throw conflict('Bạn đã đăng ký sự kiện này.')
  })
  app.post('/validate', async (request) => z.object({ email: z.email() }).parse(request.body))
  app.get('/prisma-unique', async () => {
    throw Object.assign(new Error('Unique constraint failed'), { code: 'P2002' })
  })
  app.get('/crash', async () => {
    throw new Error('secret stack detail')
  })
  return app
}

describe('error handler', () => {
  it('maps every error to { error, message } with the right status', async () => {
    const app = appWithRoutes()
    const call = (method: 'GET' | 'POST', url: string, payload?: object) =>
      app.inject(payload ? { method, url, payload } : { method, url })

    const cases = [
      [await call('GET', '/missing'), 404, 'not_found'],
      [await call('GET', '/forbidden'), 403, 'forbidden'],
      [await call('GET', '/conflict'), 409, 'conflict'],
      [await call('POST', '/validate', { email: 'khong-phai-email' }), 422, 'validation'],
      [await call('GET', '/prisma-unique'), 409, 'conflict'],
      [await call('GET', '/crash'), 500, 'internal'],
    ] as const

    for (const [response, status, code] of cases) {
      expect(response.statusCode).toBe(status)
      expect(response.json().error).toBe(code)
      expect(typeof response.json().message).toBe('string')
    }
    expect((await call('POST', '/validate', { email: 'x' })).json().issues).toHaveLength(1)
    expect((await call('GET', '/crash')).body).not.toContain('secret stack detail')
    await app.close()
  })
})

describe('password', () => {
  it('hashes with Argon2id and verifies', async () => {
    const passwordHash = await hashPassword('mat-khau-du-15-ky-tu')
    expect(passwordHash.startsWith('$argon2id$')).toBe(true)
    expect(await verifyPassword(passwordHash, 'mat-khau-du-15-ky-tu')).toBe(true)
    expect(await verifyPassword(passwordHash, 'sai-mat-khau-roi')).toBe(false)
  })
})

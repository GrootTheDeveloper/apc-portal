import { describe, expect, it } from 'vitest'

import { buildApp } from '../src/app.js'
import { loadConfig } from '../src/config.js'

describe('GET /health', () => {
  it('reports that the API is healthy', async () => {
    const app = buildApp(loadConfig({ NODE_ENV: 'test' }))
    const response = await app.inject({ method: 'GET', url: '/health' })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({ status: 'ok', service: 'apc-api' })
    await app.close()
  })
})

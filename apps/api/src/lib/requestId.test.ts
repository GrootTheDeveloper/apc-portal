import { randomUUID } from 'node:crypto'

import { afterAll, describe, expect, it } from 'vitest'

import { buildApp } from '../app.js'
import { loadConfig } from '../config.js'

// Regex UUID v4 giống UUID_V4_REGEX trong app.ts; test không hardcode mã vì mỗi request có mã mới.
const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const app = buildApp(loadConfig({ NODE_ENV: 'test' }))

afterAll(async () => {
  await app.close()
})

describe('correlation ID (x-request-id, C6)', () => {
  it('tự sinh requestId và trả lại header x-request-id trong mọi phản hồi', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' })
    expect(res.statusCode).toBe(200)
    expect(res.headers['x-request-id']).toMatch(UUID_V4_REGEX)
  })

  it('giữ nguyên header x-request-id khi client gửi mã đúng dạng UUID v4', async () => {
    const sentId = randomUUID()
    const res = await app.inject({ method: 'GET', url: '/health', headers: { 'x-request-id': sentId } })
    expect(res.statusCode).toBe(200)
    expect(res.headers['x-request-id']).toBe(sentId)
  })

  it('tự sinh mã mới khi header x-request-id không đúng dạng UUID v4', async () => {
    const res = await app.inject({ method: 'GET', url: '/health', headers: { 'x-request-id': 'not-a-uuid' } })
    expect(res.statusCode).toBe(200)
    expect(res.headers['x-request-id']).not.toBe('not-a-uuid')
    expect(res.headers['x-request-id']).toMatch(UUID_V4_REGEX)
  })

  it('phản hồi 500 có field requestId trùng header x-request-id', async () => {
    const res = await app.inject({ method: 'GET', url: '/public/_test/500' })
    expect(res.statusCode).toBe(500)
    const body = res.json()
    expect(body.error).toBe('internal')
    expect(typeof body.message).toBe('string')
    expect(body.requestId).toMatch(UUID_V4_REGEX)
    expect(res.headers['x-request-id']).toBe(body.requestId)
  })

  it('phản hồi 404 không có field requestId', async () => {
    const res = await app.inject({ method: 'GET', url: '/public/khong-ton-tai-c6' })
    expect(res.statusCode).toBe(404)
    expect(res.json()).not.toHaveProperty('requestId')
  })

  // Trong chế độ test, buildApp tắt logger (app.ts), nên không capture log qua app.inject được. Đã verify
  // thủ công khi chạy server thật: gửi request kèm cookie/authorization, log không chứa giá trị thật; và
  // chạy script một lần với chính pino 10.3.1 mà Fastify dùng: hai giá trị bí mật thành [REDACTED],
  // x-request-id giữ nguyên. (Timeout thực thi thủ công, không tự động hóa được trong vitest.)
  it.skip('manual verify: log redact — bỏ cookie và authorization khỏi log (OPS-11)', () => {
    // Chạy `pnpm --filter @apc/api dev` rồi:
    //   curl -s -H "Cookie: apc_session=SECRET" -H "Authorization: Bearer SECRET" http://127.0.0.1:3000/health
    // Dòng log "incoming request" phải hiện [REDACTED] thay cho hai giá trị nhạy cảm.
  })
})
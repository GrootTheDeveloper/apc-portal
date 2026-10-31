import { randomUUID } from 'node:crypto'
import { createServer, type Server } from 'node:net'

import type { FastifyBaseLogger } from 'fastify'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { buildApp } from '../../app.js'
import { type AppConfig, loadConfig } from '../../config.js'
import { db } from '../../db/client.js'
import type { AuthUser } from '../auth/rbac.js'
import { clamdScan, createScanner } from './scan.js'
import { contentDisposition, rescanPendingFiles } from './service.js'
import { createMemoryStorage } from './storage.js'

// Test tích hợp với Postgres thật, kho tệp trong bộ nhớ (CI không có S3). clamd giả dựng bằng node:net.
const ORIGIN = 'http://localhost:5173'
const tag = randomUUID().slice(0, 8)
const silentLog = { warn: () => {}, error: () => {}, info: () => {} } as unknown as FastifyBaseLogger

type UserKey = 'board' | 'manager' | 'member'
const users = {} as Record<UserKey, AuthUser>
const userIds: string[] = []

// Nội dung tệp tối thiểu đủ để file-type nhận diện theo magic bytes.
const jpeg = (size = 2048) => {
  const buffer = Buffer.alloc(size, 0x41)
  Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00]).copy(buffer)
  return buffer
}
const exe = () => {
  const buffer = Buffer.alloc(2048, 0x41)
  Buffer.from('MZ').copy(buffer)
  return buffer
}

function multipart(fields: Record<string, string>, file?: { name: string; type: string; content: Buffer }) {
  const boundary = `----apc${randomUUID()}`
  const parts: Buffer[] = []
  for (const [name, value] of Object.entries(fields)) {
    parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`))
  }
  if (file) {
    parts.push(
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${file.name}"\r\nContent-Type: ${file.type}\r\n\r\n`,
      ),
      file.content,
      Buffer.from('\r\n'),
    )
  }
  parts.push(Buffer.from(`--${boundary}--\r\n`))
  return {
    payload: Buffer.concat(parts),
    headers: { origin: ORIGIN, 'content-type': `multipart/form-data; boundary=${boundary}` },
  }
}

/** App test: `x-test-user` chọn người đăng nhập (như email.test.ts). */
async function createTestApp(overrides: Partial<AppConfig> = {}) {
  const config = { ...loadConfig({ NODE_ENV: 'test' }), ...overrides }
  const { storage, objects } = createMemoryStorage()
  const app = buildApp(config, { storage })
  app.addHook('onRequest', async (request) => {
    const key = request.headers['x-test-user'] as UserKey | undefined
    request.user = key && users[key] ? users[key] : null
  })
  await app.ready()
  return { app, objects, storage, config }
}

type TestApp = Awaited<ReturnType<typeof createTestApp>>

function upload(
  testApp: TestApp,
  user: UserKey | null,
  purpose: string,
  file: { name: string; type: string; content: Buffer },
) {
  const body = multipart({ purpose }, file)
  return testApp.app.inject({
    method: 'POST',
    url: '/portal/files',
    payload: body.payload,
    headers: user ? { ...body.headers, 'x-test-user': user } : body.headers,
  })
}

/** clamd giả: đọc đúng giao thức INSTREAM rồi trả `reply`. */
function fakeClamd(reply: string): Promise<{ server: Server; port: number; received: Buffer[] }> {
  const received: Buffer[] = []
  const server = createServer((socket) => {
    let buffer = Buffer.alloc(0)
    let commandRead = false
    const chunks: Buffer[] = []
    socket.on('data', (data) => {
      buffer = Buffer.concat([buffer, data])
      if (!commandRead) {
        const end = buffer.indexOf(0)
        if (end === -1) return
        buffer = buffer.subarray(end + 1)
        commandRead = true
      }
      while (buffer.length >= 4) {
        const size = buffer.readUInt32BE(0)
        if (size === 0) {
          received.push(Buffer.concat(chunks))
          socket.end(`stream: ${reply}\0`)
          return
        }
        if (buffer.length < 4 + size) return
        chunks.push(buffer.subarray(4, 4 + size))
        buffer = buffer.subarray(4 + size)
      }
    })
  })
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      resolve({ server, port: typeof address === 'object' && address ? address.port : 0, received })
    })
  })
}

/** Cổng không có gì lắng nghe, để giả lập clamd không phản hồi. */
async function closedPort() {
  const { server, port } = await fakeClamd('OK')
  await new Promise((resolve) => server.close(resolve))
  return port
}

let main: TestApp

beforeAll(async () => {
  const department = await db.department.create({ data: { name: `Ban test ${tag}`, code: `files-${tag}` } })
  for (const key of ['board', 'manager', 'member'] as const) {
    const user = await db.user.create({
      data: {
        username: `files-${key}-${tag}`,
        email: `files-${key}-${tag}@test.local`,
        passwordHash: 'khong-dung',
        fullName: `Files ${key}`,
        departmentId: department.id,
        mustChangePassword: false,
      },
    })
    userIds.push(user.id)
    const base = { role: 'MEMBER' as const, departmentId: department.id }
    users[key] = {
      id: user.id,
      departmentId: department.id,
      roles:
        key === 'board'
          ? [base, { role: 'BOARD', departmentId: null }]
          : key === 'manager'
            ? [base, { role: 'DEPARTMENT_MANAGER', departmentId: department.id }]
            : [base],
    }
  }
  main = await createTestApp()
})

afterAll(async () => {
  await main.app.close()
  await db.auditLog.deleteMany({ where: { OR: [{ actorId: { in: userIds } }, { targetType: 'FILE', serviceName: 'file-scan' }] } })
  await db.storedFile.deleteMany({ where: { uploadedById: { in: userIds } } })
  await db.user.deleteMany({ where: { id: { in: userIds } } })
  await db.department.deleteMany({ where: { code: `files-${tag}` } })
})

describe('POST /portal/files', () => {
  it('manager tải ảnh JPG lên: 201, PUBLIC + CLEAN, xem được qua /public/files/:id', async () => {
    const response = await upload(main, 'manager', 'CONTENT_IMAGE', {
      name: 'anh-bia.jpg',
      type: 'image/jpeg',
      content: jpeg(),
    })
    expect(response.statusCode).toBe(201)
    const body = response.json()
    expect(body).toEqual({ id: expect.any(String), scanStatus: 'CLEAN' })

    const stored = await db.storedFile.findUniqueOrThrow({ where: { id: body.id } })
    expect(stored).toMatchObject({ visibility: 'PUBLIC', scanStatus: 'CLEAN', mimeType: 'image/jpeg', purpose: 'CONTENT_IMAGE' })
    // Khóa kho ngẫu nhiên, không chứa tên gốc.
    expect(stored.storageKey).not.toContain('anh-bia')
    expect(main.objects.has(stored.storageKey)).toBe(true)

    const download = await main.app.inject({ method: 'GET', url: `/public/files/${body.id}` })
    expect(download.statusCode).toBe(200)
    expect(download.headers['content-type']).toBe('image/jpeg')
    expect(download.headers['x-content-type-options']).toBe('nosniff')
    expect(download.rawPayload.equals(jpeg())).toBe(true)
  })

  it('phản hồi không chứa URL hay khóa của kho tệp', async () => {
    const response = await upload(main, 'board', 'CONTENT_IMAGE', { name: 'a.jpg', type: 'image/jpeg', content: jpeg() })
    expect(response.statusCode).toBe(201)
    const stored = await db.storedFile.findUniqueOrThrow({ where: { id: response.json().id } })
    expect(response.body).not.toContain(main.config.S3_ENDPOINT)
    expect(response.body).not.toContain(main.config.S3_BUCKET)
    expect(response.body).not.toContain(stored.storageKey)
  })

  it('chưa đăng nhập: 401', async () => {
    const response = await upload(main, null, 'CONTENT_IMAGE', { name: 'a.jpg', type: 'image/jpeg', content: jpeg() })
    expect(response.statusCode).toBe(401)
  })

  it('tệp .exe đổi đuôi thành .png: 422, không lưu vào kho', async () => {
    const before = main.objects.size
    const response = await upload(main, 'manager', 'CONTENT_IMAGE', { name: 'anh.png', type: 'image/png', content: exe() })
    expect(response.statusCode).toBe(422)
    expect(response.json().error).toBe('validation')
    expect(main.objects.size).toBe(before)
  })

  it('PDF được nhận cho DOCUMENT nhưng bị từ chối cho ảnh nội dung', async () => {
    const pdf = Buffer.concat([Buffer.from('%PDF-1.7\n'), Buffer.alloc(1024, 0x41)])
    const asImage = await upload(main, 'manager', 'CONTENT_IMAGE', { name: 'a.pdf', type: 'application/pdf', content: pdf })
    expect(asImage.statusCode).toBe(422)
    const asDocument = await upload(main, 'manager', 'DOCUMENT', { name: 'a.pdf', type: 'application/pdf', content: pdf })
    expect(asDocument.statusCode).toBe(201)
    const stored = await db.storedFile.findUniqueOrThrow({ where: { id: asDocument.json().id } })
    expect(stored).toMatchObject({ visibility: 'INTERNAL', mimeType: 'application/pdf' })
  })

  it('tệp 21 MB bị từ chối (422)', async () => {
    const response = await upload(main, 'manager', 'CONTENT_IMAGE', {
      name: 'to.jpg',
      type: 'image/jpeg',
      content: jpeg(21 * 1024 * 1024),
    })
    expect(response.statusCode).toBe(422)
    expect(response.json().message).toContain('20 MB')
  })

  it('purpose sai: 422', async () => {
    const response = await upload(main, 'manager', 'SOMETHING', { name: 'a.jpg', type: 'image/jpeg', content: jpeg() })
    expect(response.statusCode).toBe(422)
  })

  it('member.a tải CONTENT_IMAGE: tệp INTERNAL, /public/files/:id trả 404', async () => {
    const response = await upload(main, 'member', 'CONTENT_IMAGE', { name: 'a.jpg', type: 'image/jpeg', content: jpeg() })
    expect(response.statusCode).toBe(201)
    const { id } = response.json()
    expect((await db.storedFile.findUniqueOrThrow({ where: { id } })).visibility).toBe('INTERNAL')
    const download = await main.app.inject({ method: 'GET', url: `/public/files/${id}` })
    expect(download.statusCode).toBe(404)
  })
})

describe('GET /public/files/:id và /portal/files/:id', () => {
  it('ảnh đại diện (kể cả BOARD tải lên) luôn INTERNAL: public 404, portal 200 khi đã đăng nhập', async () => {
    const response = await upload(main, 'board', 'AVATAR', { name: 'me.jpg', type: 'image/jpeg', content: jpeg() })
    const { id } = response.json()
    expect((await db.storedFile.findUniqueOrThrow({ where: { id } })).visibility).toBe('INTERNAL')

    expect((await main.app.inject({ method: 'GET', url: `/public/files/${id}` })).statusCode).toBe(404)
    const portal = await main.app.inject({ method: 'GET', url: `/portal/files/${id}`, headers: { 'x-test-user': 'member' } })
    expect(portal.statusCode).toBe(200)
    expect(portal.headers['x-content-type-options']).toBe('nosniff')
  })

  it('/portal/files/:id chưa đăng nhập: 401', async () => {
    const response = await upload(main, 'member', 'AVATAR', { name: 'me.jpg', type: 'image/jpeg', content: jpeg() })
    const portal = await main.app.inject({ method: 'GET', url: `/portal/files/${response.json().id}` })
    expect(portal.statusCode).toBe(401)
  })

  it('tài liệu (DOCUMENT) không tải được qua /portal/files/:id (404), tải qua D4', async () => {
    const pdf = Buffer.concat([Buffer.from('%PDF-1.7\n'), Buffer.alloc(1024, 0x41)])
    const response = await upload(main, 'manager', 'DOCUMENT', { name: 'a.pdf', type: 'application/pdf', content: pdf })
    const portal = await main.app.inject({
      method: 'GET',
      url: `/portal/files/${response.json().id}`,
      headers: { 'x-test-user': 'member' },
    })
    expect(portal.statusCode).toBe(404)
  })

  it('tệp PENDING không mở được qua mọi đường tải (404)', async () => {
    const pendingPublic = await db.storedFile.create({
      data: {
        storageKey: `files/${randomUUID()}`,
        originalName: 'cho-quet.jpg',
        mimeType: 'image/jpeg',
        size: 10,
        purpose: 'CONTENT_IMAGE',
        visibility: 'PUBLIC',
        scanStatus: 'PENDING',
        uploadedById: users.board.id,
      },
    })
    const pendingAvatar = await db.storedFile.create({
      data: {
        storageKey: `files/${randomUUID()}`,
        originalName: 'cho-quet.jpg',
        mimeType: 'image/jpeg',
        size: 10,
        purpose: 'AVATAR',
        visibility: 'INTERNAL',
        scanStatus: 'PENDING',
        uploadedById: users.board.id,
      },
    })
    main.objects.set(pendingPublic.storageKey, jpeg())
    main.objects.set(pendingAvatar.storageKey, jpeg())

    expect((await main.app.inject({ method: 'GET', url: `/public/files/${pendingPublic.id}` })).statusCode).toBe(404)
    const portal = await main.app.inject({
      method: 'GET',
      url: `/portal/files/${pendingAvatar.id}`,
      headers: { 'x-test-user': 'board' },
    })
    expect(portal.statusCode).toBe(404)
  })

  it('tệp không phải ảnh tải về dạng attachment, tên tiếng Việt được mã hóa', () => {
    expect(contentDisposition('attachment', 'Biên bản họp.pdf')).toBe(
      `attachment; filename="Bien ban hop.pdf"; filename*=UTF-8''Bi%C3%AAn%20b%E1%BA%A3n%20h%E1%BB%8Dp.pdf`,
    )
  })
})

describe('Quét mã độc (ClamAV)', () => {
  it('clamd trả FOUND: 422, tệp không còn trong kho, REJECTED, có nhật ký SECURITY', async () => {
    const clamd = await fakeClamd('Eicar-Test-Signature FOUND')
    const testApp = await createTestApp({ FILE_SCAN_MODE: 'clamav', CLAMAV_PORT: clamd.port })
    try {
      const response = await upload(testApp, 'manager', 'CONTENT_IMAGE', {
        name: 'virus.jpg',
        type: 'image/jpeg',
        content: jpeg(),
      })
      expect(response.statusCode).toBe(422)
      expect(clamd.received[0]?.equals(jpeg())).toBe(true)

      const stored = await db.storedFile.findFirstOrThrow({
        where: { uploadedById: users.manager.id, originalName: 'virus.jpg' },
        orderBy: { createdAt: 'desc' },
      })
      expect(stored.scanStatus).toBe('REJECTED')
      expect(testApp.objects.has(stored.storageKey)).toBe(false)

      const log = await db.auditLog.findFirst({ where: { targetType: 'FILE', targetId: stored.id } })
      expect(log).toMatchObject({ action: 'file.malware_detected', category: 'SECURITY', result: 'FAILURE' })
      expect(log?.metadata).toMatchObject({ signature: 'Eicar-Test-Signature' })
    } finally {
      await testApp.app.close()
      await new Promise((resolve) => clamd.server.close(resolve))
    }
  })

  it('clamd không phản hồi: giữ PENDING (không tải được); tác vụ file-scan quét lại thành CLEAN', async () => {
    const testApp = await createTestApp({ FILE_SCAN_MODE: 'clamav', CLAMAV_PORT: await closedPort() })
    const clamd = await fakeClamd('OK')
    try {
      const response = await upload(testApp, 'manager', 'CONTENT_IMAGE', { name: 'cho.jpg', type: 'image/jpeg', content: jpeg() })
      expect(response.statusCode).toBe(201)
      const { id, scanStatus } = response.json()
      expect(scanStatus).toBe('PENDING')
      expect((await testApp.app.inject({ method: 'GET', url: `/public/files/${id}` })).statusCode).toBe(404)

      const scanner = createScanner({ ...testApp.config, CLAMAV_PORT: clamd.port })
      await rescanPendingFiles({ storage: testApp.storage, scanner }, silentLog, { olderThanMs: 0, batchSize: 1000 })
      expect((await db.storedFile.findUniqueOrThrow({ where: { id } })).scanStatus).toBe('CLEAN')
      expect((await testApp.app.inject({ method: 'GET', url: `/public/files/${id}` })).statusCode).toBe(200)
    } finally {
      await testApp.app.close()
      await new Promise((resolve) => clamd.server.close(resolve))
    }
  })

  it('production không có FILE_SCAN_MODE=clamav: API không khởi động', () => {
    expect(() => loadConfig({ NODE_ENV: 'production' })).toThrow()
    expect(() => loadConfig({ NODE_ENV: 'production', FILE_SCAN_MODE: 'skip' })).toThrow()
    expect(loadConfig({ NODE_ENV: 'production', FILE_SCAN_MODE: 'clamav' }).FILE_SCAN_MODE).toBe('clamav')
  })

  // Chạy với ClamAV thật: `node scripts/compose.mjs --profile scan up -d clamav` rồi `CLAMAV_E2E=1 pnpm --filter @apc/api test`.
  // Chuỗi EICAR ghép lúc chạy, không lưu nguyên văn trong repo để phần mềm diệt virus không cách ly file này.
  it.skipIf(!process.env.CLAMAV_E2E)('ClamAV thật phát hiện tệp thử EICAR', async () => {
    const eicar = ['X5O!P%@AP[4\\PZX54(P^)7CC)7}$', 'EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*'].join('')
    const config = loadConfig({ ...process.env, NODE_ENV: 'test' })
    const result = await clamdScan(config.CLAMAV_HOST, config.CLAMAV_PORT, Buffer.from(eicar))
    expect(result.status).toBe('infected')
  })
})

import { Readable } from 'node:stream'

import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'

import type { AppConfig } from '../../config.js'

/**
 * Kho tệp qua S3 API (docs/06 §5): local là SeaweedFS, production là Cloudflare R2.
 * Chỉ module `files` gọi kho; không trả khóa hay URL kho ra API (Kiến trúc mục 5 dòng 5).
 * Test truyền `createMemoryStorage()` vào `buildApp(config, { storage })` để không cần kho thật.
 */
export interface FileStorage {
  put(key: string, body: Buffer, contentType: string): Promise<void>
  get(key: string): Promise<Readable>
  delete(key: string): Promise<void>
}

export function createS3Storage(config: AppConfig): FileStorage {
  const client = new S3Client({
    endpoint: config.S3_ENDPOINT,
    region: config.S3_REGION,
    // SeaweedFS cần path-style (endpoint/bucket/key); R2 hỗ trợ cả hai kiểu.
    forcePathStyle: true,
    credentials: { accessKeyId: config.S3_ACCESS_KEY, secretAccessKey: config.S3_SECRET_KEY },
  })
  const Bucket = config.S3_BUCKET

  return {
    async put(key, body, contentType) {
      await client.send(new PutObjectCommand({ Bucket, Key: key, Body: body, ContentType: contentType }))
    },
    async get(key) {
      const result = await client.send(new GetObjectCommand({ Bucket, Key: key }))
      if (!(result.Body instanceof Readable)) throw new Error('Kho tệp trả nội dung không đọc được')
      return result.Body
    },
    async delete(key) {
      await client.send(new DeleteObjectCommand({ Bucket, Key: key }))
    },
  }
}

/** Kho trong bộ nhớ cho test. `objects` để test kiểm tra tệp còn hay đã bị xóa. */
export function createMemoryStorage() {
  const objects = new Map<string, Buffer>()
  const storage: FileStorage = {
    async put(key, body) {
      objects.set(key, Buffer.from(body))
    },
    async get(key) {
      const body = objects.get(key)
      if (!body) throw new Error('NoSuchKey')
      return Readable.from(body)
    },
    async delete(key) {
      objects.delete(key)
    },
  }
  return { storage, objects }
}

export async function readAll(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = []
  for await (const chunk of stream) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  return Buffer.concat(chunks)
}

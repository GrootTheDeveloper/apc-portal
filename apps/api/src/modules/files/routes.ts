import multipart from '@fastify/multipart'
import type { FastifyInstance } from 'fastify'

import { requireAuth } from '../auth/rbac.js'
import {
  type FilesContext,
  fileParamsSchema,
  invalidFile,
  MAX_FILE_SIZE,
  sendStoredFile,
  uploadFile,
  uploadPurposeSchema,
} from './service.js'

export function filesRoutes(context: FilesContext) {
  return async function registerFilesRoutes(app: FastifyInstance) {
    // Đăng ký trong plugin này để chỉ route tệp nhận multipart. Một request chỉ một tệp.
    await app.register(multipart, {
      limits: { fileSize: MAX_FILE_SIZE, files: 1, fields: 5, fieldSize: 1024, parts: 6 },
    })

    // Form gửi trường `purpose` TRƯỚC trường `file` (multipart đọc tuần tự).
    app.post(
      '/portal/files',
      { preHandler: requireAuth, config: { rateLimit: { max: 30, timeWindow: '1 minute' } } },
      async (request, reply) => {
        if (!request.isMultipart()) throw invalidFile('Cần gửi tệp dạng multipart/form-data.')
        const part = await request.file()
        if (!part) throw invalidFile('Chưa chọn tệp.')

        const field = part.fields.purpose
        const purposeValue = field && !Array.isArray(field) && field.type === 'field' ? field.value : undefined
        const purpose = uploadPurposeSchema.parse(purposeValue)

        let content: Buffer
        try {
          content = await part.toBuffer()
        } catch (error) {
          if ((error as { code?: string }).code === 'FST_REQ_FILE_TOO_LARGE') throw invalidFile('Tệp vượt quá 20 MB.')
          throw error
        }

        const result = await uploadFile(context, request, { purpose, originalName: part.filename, content })
        return reply.code(201).send(result)
      },
    )

    // Tệp công khai (ảnh bài viết, dự án, sự kiện): chỉ PUBLIC + CLEAN.
    app.get('/public/files/:id', async (request, reply) => {
      const { id } = fileParamsSchema.parse(request.params)
      return sendStoredFile(context, reply, { id, visibility: 'PUBLIC' }, 'public, max-age=86400')
    })

    // Ảnh đại diện chỉ hiện trong nội bộ (MEM-10). Tài liệu (DOCUMENT) không tải ở đây mà qua D4.
    app.get('/portal/files/:id', { preHandler: requireAuth }, async (request, reply) => {
      const { id } = fileParamsSchema.parse(request.params)
      return sendStoredFile(context, reply, { id, purpose: 'AVATAR', visibility: 'INTERNAL' }, 'private, max-age=300')
    })
  }
}

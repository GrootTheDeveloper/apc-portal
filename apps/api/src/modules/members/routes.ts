import type { FastifyInstance } from 'fastify'
import multipart from '@fastify/multipart'
import { z } from 'zod'

import type { AppConfig } from '../../config.js'
import type { FileStorage } from '../files/storage.js'
import { requireRole } from '../auth/rbac.js'
import { exportMembers, importMembers, inspectMemberImport, MEMBER_CSV_MAX_SIZE, memberCsvTemplate, memberImportBatchSchema } from './import.js'
import { getMemberDetail, listMembers, updateMember } from './service.js'

const BOARD = requireRole('BOARD')
const MANAGER_OR_BOARD = requireRole('DEPARTMENT_MANAGER', 'BOARD')

type IdParams = { Params: { id: string } }

export function memberRoutes(config: AppConfig, exportsContext: { storage: FileStorage }) {
  const options = () => ({ enforcePrivilegedMinimum: config.ENFORCE_PRIVILEGED_MINIMUM })

  return async function registerMemberRoutes(app: FastifyInstance) {
    await app.register(multipart, {
      limits: { fileSize: MEMBER_CSV_MAX_SIZE, files: 1, fields: 2, fieldSize: 128, parts: 3 },
    })

    async function readCsvForm(request: import('fastify').FastifyRequest) {
      if (!request.isMultipart()) throw csvInputError('Cần gửi CSV dạng multipart/form-data.')
      let content: Buffer | undefined
      let batchId: string | undefined
      try {
        for await (const part of request.parts()) {
          if (part.type === 'file') {
            if (part.fieldname !== 'file') continue
            content = await part.toBuffer()
          } else if (part.fieldname === 'batchId') {
            batchId = String(part.value)
          }
        }
      } catch (error) {
        if ((error as { code?: string }).code === 'FST_REQ_FILE_TOO_LARGE') {
          throw csvInputError('Tệp CSV tối đa 2 MB.')
        }
        throw error
      }
      if (!content) throw csvInputError('Chưa chọn tệp CSV.')
      return { content, batchId }
    }

    app.get('/admin/members/import/template', { preHandler: BOARD }, async (_request, reply) => {
      return reply
        .header('Content-Disposition', 'attachment; filename="mau-nhap-thanh-vien.csv"')
        .type('text/csv; charset=utf-8')
        .send(memberCsvTemplate())
    })

    app.post('/admin/members/import/validate', { preHandler: BOARD }, async (request) => {
      const { content } = await readCsvForm(request)
      return inspectMemberImport(request, content)
    })

    app.post('/admin/members/import/commit', { preHandler: BOARD }, async (request, reply) => {
      const { content, batchId } = await readCsvForm(request)
      return reply.code(201).send(await importMembers(request, content, memberImportBatchSchema.parse(batchId)))
    })

    app.post('/admin/members/export', { preHandler: BOARD }, async (request, reply) => {
      return reply.code(201).send(await exportMembers(request, exportsContext))
    })

    app.get('/admin/members', { preHandler: MANAGER_OR_BOARD }, async (request) => {
      return listMembers(request, request.query)
    })

    app.get<IdParams>('/admin/members/:id', { preHandler: MANAGER_OR_BOARD }, async (request) => {
      return getMemberDetail(request, request.params.id)
    })

    app.patch<IdParams>('/admin/members/:id', { preHandler: BOARD }, async (request) => {
      return updateMember(request, request.params.id, request.body, options())
    })
  }
}

function csvInputError(message: string) {
  return new z.ZodError([{ code: 'custom', path: ['file'], message, input: undefined }])
}

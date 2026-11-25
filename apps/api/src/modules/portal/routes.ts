import type { FastifyInstance } from 'fastify'

import { pageQuery } from '../../lib/pagination.js'
import { currentUser, requireAuth } from '../auth/rbac.js'
import { getDirectoryMember, listDirectoryMembers } from './directory.js'
import { getActivity, getProfile, getRoles, updateProfile, updateProfileSchema } from './service.js'

export async function portalRoutes(app: FastifyInstance) {
  app.get('/portal/me/profile', { preHandler: requireAuth }, async (request) => {
    const user = currentUser(request)
    return getProfile(user.id)
  })

  app.patch('/portal/me/profile', { preHandler: requireAuth }, async (request) => {
    const user = currentUser(request)
    const input = updateProfileSchema.parse(request.body)
    return updateProfile(user.id, input)
  })

  app.get('/portal/me/roles', { preHandler: requireAuth }, async (request) => {
    const user = currentUser(request)
    return getRoles(user)
  })

  app.get('/portal/me/activity', { preHandler: requireAuth }, async (request) => {
    const user = currentUser(request)
    const query = pageQuery.parse(request.query)
    return getActivity(user.id, query)
  })

  app.get('/portal/members', { preHandler: requireAuth }, async (request) => {
    return listDirectoryMembers(request.query)
  })

  app.get('/portal/members/:id', { preHandler: requireAuth }, async (request) => {
    return getDirectoryMember(request.params)
  })
}

import { randomUUID } from 'node:crypto'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { buildApp } from '../../app.js'
import { loadConfig } from '../../config.js'
import { db } from '../../db/client.js'

// Test tích hợp với Postgres thật: tự tạo dữ liệu trong beforeAll, xóa sạch trong afterAll.
const config = loadConfig({ NODE_ENV: 'test' })
const expectedBase = config.WEB_URL.replace(/\/$/, '')
const app = buildApp(config)

// Tag ngẫu nhiên để chạy song song / chạy lại không đụng slug nhau.
const tag = randomUUID().slice(0, 8)

let authorId: string
const createdPostIds: string[] = []
const createdProjectIds: string[] = []
const createdEventIds: string[] = []

/** Tạo User tối giản chỉ để đáp ứng quan hệ bắt buộc authorId/createdById. */
async function createAuthor() {
  const user = await db.user.create({
    data: {
      username: `author-seo-${tag}`,
      email: `author-seo-${tag}@test.local`,
      passwordHash: 'dummy-hash-not-used',
      fullName: 'Tác giả test SEO',
      mustChangePassword: false,
      status: 'ACTIVE',
    },
  })
  return user.id
}

async function createPost(slug: string, status: 'PUBLISHED' | 'DRAFT' | 'ARCHIVED', scope: 'PUBLIC' | 'INTERNAL') {
  const post = await db.post.create({
    data: {
      title: `Bài ${slug}`,
      slug,
      summary: 'Tóm tắt test sitemap.',
      content: 'Nội dung test sitemap.',
      category: 'Thông báo',
      status,
      scope,
      publishedAt: status === 'PUBLISHED' ? new Date() : null,
      authorId,
    },
  })
  createdPostIds.push(post.id)
  return post
}

async function createProject(slug: string, status: 'PUBLISHED' | 'DRAFT' | 'ARCHIVED') {
  const project = await db.project.create({
    data: {
      title: `Dự án ${slug}`,
      slug,
      description: 'Mô tả test sitemap.',
      status,
      publishedAt: status === 'PUBLISHED' ? new Date() : null,
      createdById: authorId,
    },
  })
  createdProjectIds.push(project.id)
  return project
}

async function createEvent(
  slug: string,
  status: 'PUBLISHED' | 'ENDED' | 'DRAFT' | 'CANCELLED' | 'ARCHIVED',
) {
  const startAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  const event = await db.event.create({
    data: {
      title: `Sự kiện ${slug}`,
      slug,
      description: 'Mô tả test sitemap.',
      eventType: 'Workshop',
      status,
      createdById: authorId,
      startAt,
      endAt: new Date(startAt.getTime() + 2 * 60 * 60 * 1000),
    },
  })
  createdEventIds.push(event.id)
  return event
}

beforeAll(async () => {
  authorId = await createAuthor()
  // Post: 1 đủ điều kiện, 3 không (DRAFT / ARCHIVED / INTERNAL).
  await createPost(`bai-pub-${tag}`, 'PUBLISHED', 'PUBLIC')
  await createPost(`bai-draft-${tag}`, 'DRAFT', 'PUBLIC')
  await createPost(`bai-archived-${tag}`, 'ARCHIVED', 'PUBLIC')
  await createPost(`bai-internal-${tag}`, 'PUBLISHED', 'INTERNAL')
  // Project: 1 đủ điều kiện, 2 không.
  await createProject(`duan-pub-${tag}`, 'PUBLISHED')
  await createProject(`duan-draft-${tag}`, 'DRAFT')
  await createProject(`duan-archived-${tag}`, 'ARCHIVED')
  // Event: 2 đủ điều kiện (PUBLISHED, ENDED), 3 không (DRAFT / CANCELLED / ARCHIVED).
  await createEvent(`sk-pub-${tag}`, 'PUBLISHED')
  await createEvent(`sk-ended-${tag}`, 'ENDED')
  await createEvent(`sk-draft-${tag}`, 'DRAFT')
  await createEvent(`sk-cancelled-${tag}`, 'CANCELLED')
  await createEvent(`sk-archived-${tag}`, 'ARCHIVED')
})

afterAll(async () => {
  await db.post.deleteMany({ where: { id: { in: createdPostIds } } })
  await db.project.deleteMany({ where: { id: { in: createdProjectIds } } })
  await db.event.deleteMany({ where: { id: { in: createdEventIds } } })
  await db.user.deleteMany({ where: { id: authorId } })
  await app.close()
})

describe('GET /public/sitemap.xml', () => {
  it('trả 200, content-type application/xml, có urlset và trang chủ với URL tuyệt đối', async () => {
    const res = await app.inject({ method: 'GET', url: '/public/sitemap.xml' })
    expect(res.statusCode).toBe(200)
    expect(res.headers['content-type']).toBe('application/xml; charset=utf-8')
    const body = res.body
    expect(body).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">')
    expect(body).toContain(`<loc>${expectedBase}/</loc>`)
    // Trang tĩnh còn lại có mặt, không có trang cần loại trừ.
    expect(body).toContain(`<loc>${expectedBase}/news</loc>`)
    expect(body).toContain(`<loc>${expectedBase}/events</loc>`)
    expect(body).toContain(`<loc>${expectedBase}/projects</loc>`)
    expect(body).not.toContain(`${expectedBase}/login</loc>`)
    expect(body).not.toContain(`${expectedBase}/search</loc>`)
  })

  it('chỉ chứa Post PUBLISHED + PUBLIC; không có DRAFT, ARCHIVED, INTERNAL', async () => {
    const res = await app.inject({ method: 'GET', url: '/public/sitemap.xml' })
    expect(res.statusCode).toBe(200)
    const body = res.body
    expect(body).toContain(`/news/bai-pub-${tag}`)
    expect(body).not.toContain(`bai-draft-${tag}`)
    expect(body).not.toContain(`bai-archived-${tag}`)
    expect(body).not.toContain(`bai-internal-${tag}`)
  })

  it('chỉ chứa Project PUBLISHED; không có DRAFT, ARCHIVED', async () => {
    const res = await app.inject({ method: 'GET', url: '/public/sitemap.xml' })
    expect(res.statusCode).toBe(200)
    const body = res.body
    expect(body).toContain(`/projects/duan-pub-${tag}`)
    expect(body).not.toContain(`duan-draft-${tag}`)
    expect(body).not.toContain(`duan-archived-${tag}`)
  })

  it('chỉ chứa Event PUBLISHED và ENDED; không có DRAFT, CANCELLED, ARCHIVED', async () => {
    const res = await app.inject({ method: 'GET', url: '/public/sitemap.xml' })
    expect(res.statusCode).toBe(200)
    const body = res.body
    expect(body).toContain(`/events/sk-pub-${tag}`)
    expect(body).toContain(`/events/sk-ended-${tag}`)
    expect(body).not.toContain(`sk-draft-${tag}`)
    expect(body).not.toContain(`sk-cancelled-${tag}`)
    expect(body).not.toContain(`sk-archived-${tag}`)
  })
})

describe('GET /public/robots.txt', () => {
  it('trả 200, content-type text/plain, đủ dòng Disallow và dòng Sitemap', async () => {
    const res = await app.inject({ method: 'GET', url: '/public/robots.txt' })
    expect(res.statusCode).toBe(200)
    expect(res.headers['content-type']).toBe('text/plain; charset=utf-8')
    const body = res.body
    for (const line of [
      'User-agent: *',
      'Disallow: /login',
      'Disallow: /account',
      'Disallow: /portal',
      'Disallow: /admin',
      'Disallow: /news/*/preview',
      'Disallow: /projects/*/preview',
      'Disallow: /events/*/preview',
      'Disallow: /recruitment/*/apply',
      'Disallow: /recruitment/lookup',
      'Disallow: /events/*/register',
      'Disallow: /events/lookup',
      `Sitemap: ${expectedBase}/sitemap.xml`,
    ]) {
      expect(body).toContain(line)
    }
    expect(body).not.toContain('Disallow: /search')
  })
})
import { randomUUID } from 'node:crypto'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { buildApp } from '../../app.js'
import { loadConfig } from '../../config.js'
import { db } from '../../db/client.js'

// Test tích hợp với Postgres thật: tự tạo dữ liệu trong beforeAll, xóa sạch trong afterAll.
const config = loadConfig({ NODE_ENV: 'test' })
const app = buildApp(config)

// Tag ngẫu nhiên để tránh va chạm giữa các lần chạy test song song
const tag = randomUUID().slice(0, 8)

// Theo dõi ID để cleanup
const createdPostIds: string[] = []
const createdProjectIds: string[] = []

// ─── HELPERS TẠO DỮ LIỆU TEST ─────────────────────────────────────────────

/** Tạo User tối giản chỉ để đáp ứng quan hệ bắt buộc của Post (authorId). */
async function createAuthor() {
  const user = await db.user.create({
    data: {
      username: `author-content-${tag}`,
      email: `author-content-${tag}@test.local`,
      passwordHash: 'dummy-hash-not-used',
      fullName: 'Tác giả test',
      mustChangePassword: false,
      status: 'ACTIVE',
    },
  })
  return user
}

/** Tạo bài viết (Post) với các tham số tùy chỉnh. */
async function createPost(
  opts: {
    suffix?: string
    status?: 'PUBLISHED' | 'DRAFT' | 'ARCHIVED'
    scope?: 'PUBLIC' | 'INTERNAL'
    category?: string
    authorId: string
  },
) {
  const suffix = opts.suffix ?? randomUUID().slice(0, 6)
  const post = await db.post.create({
    data: {
      title: `Bài viết ${suffix}`,
      slug: `bai-viet-${suffix}-${tag}`,
      summary: 'Tóm tắt bài viết test',
      content: 'Nội dung đầy đủ của bài viết test.',
      category: opts.category ?? 'Thông báo',
      status: opts.status ?? 'PUBLISHED',
      scope: opts.scope ?? 'PUBLIC',
      publishedAt: opts.status === 'PUBLISHED' ? new Date() : null,
      authorId: opts.authorId,
    },
  })
  createdPostIds.push(post.id)
  return post
}

/** Tạo dự án (Project) với các tham số tùy chỉnh. */
async function createProject(
  opts: {
    suffix?: string
    status?: 'PUBLISHED' | 'DRAFT' | 'ARCHIVED'
    createdById: string
  },
) {
  const suffix = opts.suffix ?? randomUUID().slice(0, 6)
  const project = await db.project.create({
    data: {
      title: `Dự án ${suffix}`,
      slug: `du-an-${suffix}-${tag}`,
      description: 'Mô tả dự án test.',
      status: opts.status ?? 'PUBLISHED',
      publishedAt: opts.status === 'PUBLISHED' ? new Date() : null,
      technologies: ['React', 'Node.js'],
      createdById: opts.createdById,
    },
  })
  createdProjectIds.push(project.id)
  return project
}

// ─── SETUP / TEARDOWN ──────────────────────────────────────────────────────

let authorId: string

beforeAll(async () => {
  const author = await createAuthor()
  authorId = author.id
  await app.ready()
})

afterAll(async () => {
  // Xóa theo thứ tự: dữ liệu phụ thuộc trước, sau đó user
  await db.post.deleteMany({ where: { id: { in: createdPostIds } } })
  await db.project.deleteMany({ where: { id: { in: createdProjectIds } } })
  await db.user.deleteMany({ where: { id: authorId } })
  await app.close()
  await db.$disconnect()
})

// ─── GET /public/news ─────────────────────────────────────────────────────

describe('GET /public/news', () => {
  it('trả về danh sách tin tức PUBLISHED + PUBLIC với đúng shape', async () => {
    // Tạo 2 bài PUBLIC, 1 bài INTERNAL (không được xuất hiện)
    await createPost({ suffix: 'news-pub-1', authorId, status: 'PUBLISHED', scope: 'PUBLIC' })
    await createPost({ suffix: 'news-pub-2', authorId, status: 'PUBLISHED', scope: 'PUBLIC' })
    await createPost({ suffix: 'news-internal', authorId, status: 'PUBLISHED', scope: 'INTERNAL' })

    const response = await app.inject({ method: 'GET', url: '/public/news' })

    expect(response.statusCode).toBe(200)
    const body = response.json()

    // Kiểm tra shape phân trang
    expect(body).toMatchObject({
      items: expect.any(Array),
      total: expect.any(Number),
      page: 1,
      pageSize: 12,
    })

    // Tất cả items phải là PUBLISHED + PUBLIC
    for (const item of body.items) {
      // Trường công khai phải có
      expect(item).toHaveProperty('id')
      expect(item).toHaveProperty('title')
      expect(item).toHaveProperty('slug')
      expect(item).toHaveProperty('summary')
      expect(item).toHaveProperty('category')
      expect(item).toHaveProperty('publishedAt')
      // Trường nội bộ KHÔNG được có mặt
      expect(item).not.toHaveProperty('authorId')
      expect(item).not.toHaveProperty('publishedById')
      expect(item).not.toHaveProperty('departmentId')
      // Trường `content` chỉ có ở detail, không có ở list
      expect(item).not.toHaveProperty('content')
      // status và scope không nên lộ ra ngoài
      expect(item).not.toHaveProperty('status')
      expect(item).not.toHaveProperty('scope')
    }

    // Bài INTERNAL không được lọt vào danh sách
    const slugs = body.items.map((i: { slug: string }) => i.slug)
    expect(slugs).not.toContain(`bai-viet-news-internal-${tag}`)
  })

  it('lọc đúng theo category', async () => {
    const category = `CatTest-${tag}`
    await createPost({ suffix: 'cat-match', authorId, status: 'PUBLISHED', scope: 'PUBLIC', category })
    await createPost({ suffix: 'cat-other', authorId, status: 'PUBLISHED', scope: 'PUBLIC', category: 'Khác' })

    const response = await app.inject({
      method: 'GET',
      url: `/public/news?category=${encodeURIComponent(category)}`,
    })

    expect(response.statusCode).toBe(200)
    const body = response.json()
    // Chỉ trả bài đúng category
    for (const item of body.items) {
      expect(item.category).toBe(category)
    }
  })

  it('hỗ trợ phân trang: page và pageSize', async () => {
    const response = await app.inject({ method: 'GET', url: '/public/news?page=1&pageSize=2' })

    expect(response.statusCode).toBe(200)
    const body = response.json()
    expect(body.page).toBe(1)
    expect(body.pageSize).toBe(2)
    expect(body.items.length).toBeLessThanOrEqual(2)
  })

  it('trả về danh sách rỗng khi không có bài phù hợp (pageSize nhỏ, page cao)', async () => {
    const response = await app.inject({ method: 'GET', url: '/public/news?page=9999&pageSize=12' })
    expect(response.statusCode).toBe(200)
    const body = response.json()
    expect(body.items).toEqual([])
    expect(body.total).toBeGreaterThanOrEqual(0)
  })
})

// ─── GET /public/news/:slug ───────────────────────────────────────────────

describe('GET /public/news/:slug', () => {
  it('trả về đúng chi tiết bài viết PUBLISHED + PUBLIC, có trường content', async () => {
    const post = await createPost({ suffix: 'detail-ok', authorId, status: 'PUBLISHED', scope: 'PUBLIC' })

    const response = await app.inject({ method: 'GET', url: `/public/news/${post.slug}` })

    expect(response.statusCode).toBe(200)
    const body = response.json()
    expect(body.slug).toBe(post.slug)
    expect(body.title).toBe(post.title)
    // Trang chi tiết phải có `content`
    expect(body).toHaveProperty('content')
    // Không lộ trường nội bộ
    expect(body).not.toHaveProperty('authorId')
    expect(body).not.toHaveProperty('publishedById')
    expect(body).not.toHaveProperty('departmentId')
    expect(body).not.toHaveProperty('status')
    expect(body).not.toHaveProperty('scope')
  })

  it('trả về 404 với bài DRAFT', async () => {
    const post = await createPost({ suffix: 'draft-404', authorId, status: 'DRAFT', scope: 'PUBLIC' })
    const response = await app.inject({ method: 'GET', url: `/public/news/${post.slug}` })
    expect(response.statusCode).toBe(404)
    expect(response.json().error).toBe('not_found')
  })

  it('trả về 404 với bài ARCHIVED', async () => {
    const post = await createPost({ suffix: 'arch-404', authorId, status: 'ARCHIVED', scope: 'PUBLIC' })
    const response = await app.inject({ method: 'GET', url: `/public/news/${post.slug}` })
    expect(response.statusCode).toBe(404)
    expect(response.json().error).toBe('not_found')
  })

  it('trả về 404 với bài INTERNAL (dù PUBLISHED)', async () => {
    const post = await createPost({ suffix: 'internal-404', authorId, status: 'PUBLISHED', scope: 'INTERNAL' })
    const response = await app.inject({ method: 'GET', url: `/public/news/${post.slug}` })
    expect(response.statusCode).toBe(404)
    expect(response.json().error).toBe('not_found')
  })

  it('trả về 404 với slug không tồn tại', async () => {
    const response = await app.inject({ method: 'GET', url: `/public/news/slug-khong-ton-tai-${tag}` })
    expect(response.statusCode).toBe(404)
    expect(response.json().error).toBe('not_found')
  })
})

// ─── GET /public/projects ─────────────────────────────────────────────────

describe('GET /public/projects', () => {
  it('trả về danh sách dự án PUBLISHED với đúng shape', async () => {
    await createProject({ suffix: 'proj-pub-1', createdById: authorId, status: 'PUBLISHED' })
    await createProject({ suffix: 'proj-pub-2', createdById: authorId, status: 'PUBLISHED' })
    await createProject({ suffix: 'proj-draft', createdById: authorId, status: 'DRAFT' })

    const response = await app.inject({ method: 'GET', url: '/public/projects' })

    expect(response.statusCode).toBe(200)
    const body = response.json()

    expect(body).toMatchObject({
      items: expect.any(Array),
      total: expect.any(Number),
      page: 1,
      pageSize: 12,
    })

    for (const item of body.items) {
      expect(item).toHaveProperty('id')
      expect(item).toHaveProperty('title')
      expect(item).toHaveProperty('slug')
      expect(item).toHaveProperty('description')
      expect(item).toHaveProperty('publishedAt')
      // Trường nội bộ KHÔNG được có mặt
      expect(item).not.toHaveProperty('createdById')
      expect(item).not.toHaveProperty('departmentId')
      expect(item).not.toHaveProperty('status')
    }

    // Dự án DRAFT không được xuất hiện
    const slugs = body.items.map((i: { slug: string }) => i.slug)
    expect(slugs).not.toContain(`du-an-proj-draft-${tag}`)
  })

  it('nhận query param type mà không gây lỗi (schema chưa có trường type)', async () => {
    // Đảm bảo API không crash khi nhận param `type` dù chưa filter
    const response = await app.inject({ method: 'GET', url: '/public/projects?type=web' })
    expect(response.statusCode).toBe(200)
  })

  it('hỗ trợ phân trang', async () => {
    const response = await app.inject({ method: 'GET', url: '/public/projects?page=1&pageSize=2' })
    expect(response.statusCode).toBe(200)
    const body = response.json()
    expect(body.page).toBe(1)
    expect(body.pageSize).toBe(2)
    expect(body.items.length).toBeLessThanOrEqual(2)
  })
})

// ─── GET /public/projects/:slug ───────────────────────────────────────────

describe('GET /public/projects/:slug', () => {
  it('trả về đúng chi tiết dự án PUBLISHED', async () => {
    const project = await createProject({ suffix: 'proj-detail-ok', createdById: authorId, status: 'PUBLISHED' })

    const response = await app.inject({ method: 'GET', url: `/public/projects/${project.slug}` })

    expect(response.statusCode).toBe(200)
    const body = response.json()
    expect(body.slug).toBe(project.slug)
    expect(body.title).toBe(project.title)
    expect(body).toHaveProperty('technologies')
    // Không lộ trường nội bộ
    expect(body).not.toHaveProperty('createdById')
    expect(body).not.toHaveProperty('departmentId')
    expect(body).not.toHaveProperty('status')
  })

  it('trả về 404 với dự án DRAFT', async () => {
    const project = await createProject({ suffix: 'proj-draft-404', createdById: authorId, status: 'DRAFT' })
    const response = await app.inject({ method: 'GET', url: `/public/projects/${project.slug}` })
    expect(response.statusCode).toBe(404)
    expect(response.json().error).toBe('not_found')
  })

  it('trả về 404 với dự án ARCHIVED', async () => {
    const project = await createProject({ suffix: 'proj-arch-404', createdById: authorId, status: 'ARCHIVED' })
    const response = await app.inject({ method: 'GET', url: `/public/projects/${project.slug}` })
    expect(response.statusCode).toBe(404)
    expect(response.json().error).toBe('not_found')
  })

  it('trả về 404 với slug không tồn tại', async () => {
    const response = await app.inject({ method: 'GET', url: `/public/projects/slug-khong-ton-tai-${tag}` })
    expect(response.statusCode).toBe(404)
    expect(response.json().error).toBe('not_found')
  })
})

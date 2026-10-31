import { expect, test } from '@playwright/test'

const emptySearch = { news: [], events: [], projects: [] }
const searchResults = {
  news: [{ id: 'news-id', title: 'Tin tìm kiếm', slug: 'd3-search-news', summary: 'Tóm tắt', thumbnailUrl: null, category: 'Chia sẻ', publishedAt: null }],
  events: [{ slug: 'd3-search-event', title: 'Sự kiện tìm kiếm', coverImageUrl: null, eventType: 'Workshop', status: 'PUBLISHED', startAt: '2099-01-01T10:00:00.000Z', endAt: '2099-01-01T12:00:00.000Z', location: 'UMT', onlineUrl: null }],
  projects: [{ id: 'project-id', title: 'Dự án tìm kiếm', slug: 'd3-search-project', description: 'Mô tả', thumbnailUrl: null, technologies: [], projectUrl: null, sourceUrl: null, publishedAt: null }],
}

const detailCases = [
  {
    title: 'tin tức',
    href: '/news/d3-search-news',
    apiPath: '**/api/public/news/d3-search-news',
    detail: { ...searchResults.news[0], content: 'Nội dung', metaTitle: null, metaDescription: null },
  },
  {
    title: 'sự kiện',
    href: '/events/d3-search-event',
    apiPath: '**/api/public/events/d3-search-event',
    detail: { id: 'event-id', ...searchResults.events[0], description: 'Mô tả', departmentName: null, contactPoint: null, registrationOpensAt: null, registrationClosesAt: null, capacity: null, cancelReason: null },
  },
  {
    title: 'dự án',
    href: '/projects/d3-search-project',
    apiPath: '**/api/public/projects/d3-search-project',
    detail: searchResults.projects[0],
  },
]

for (const { pagePath, resource } of [
  { pagePath: '/news', resource: 'news' },
  { pagePath: '/events', resource: 'events' },
  { pagePath: '/projects', resource: 'projects' },
]) {
  test(`ô tìm kiếm tại ${pagePath} chuyển từ khóa sang /search`, async ({ page }) => {
    await page.route(`**/api/public/${resource}*`, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: [], total: 0, page: 1, pageSize: 12 }),
      }),
    )
    await page.route('**/api/public/search*', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(emptySearch) }),
    )

    await page.goto(pagePath)
    await page.getByLabel('Tìm nội dung').fill('workshop')
    await page.getByRole('button', { name: 'Tìm kiếm' }).click()

    await expect(page).toHaveURL(/\/search\?q=workshop$/)
  })
}

test.describe('Tìm kiếm công khai (D3)', () => {
  for (const scenario of detailCases) {
    test(`từ trang chi tiết ${scenario.title} quay lại vẫn giữ từ khóa`, async ({ page }) => {
      await page.route('**/api/public/search*', (route) =>
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(searchResults) }),
      )
      await page.route(scenario.apiPath, (route) =>
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(scenario.detail) }),
      )

      await page.goto('/search?q=needle')
      await page.locator(`a[href="${scenario.href}"]`).click()
      await expect(page).toHaveURL(scenario.href)
      await page.locator('a[href="/search?q=needle"]').last().click()

      await expect(page).toHaveURL(/\/search\?q=needle$/)
    })
  }

  test('không có kết quả hiện nút xóa từ khóa và xóa q khỏi URL', async ({ page }) => {
    await page.route('**/api/public/search*', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(emptySearch) }),
    )

    await page.goto('/search?q=khong-co-ket-qua')

    await expect(page.getByText('Không tìm thấy nội dung phù hợp.')).toBeVisible()
    await page.getByRole('button', { name: 'Xóa từ khóa' }).click()

    await expect(page).toHaveURL(/\/search$/)
    await expect(page.getByLabel('Từ khóa')).toHaveValue('')
  })

  test('lỗi tải kết quả vẫn giữ từ khóa trên URL', async ({ page }) => {
    await page.route('**/api/public/search*', (route) =>
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'internal_error', message: 'Không thể tải kết quả tìm kiếm.' }),
      }),
    )

    await page.goto('/search?q=tu-khoa-can-giu')

    await expect(page.getByRole('alert')).toContainText('Không thể tải kết quả tìm kiếm.')
    await expect(page).toHaveURL(/\/search\?q=tu-khoa-can-giu$/)
    await expect(page.getByLabel('Từ khóa')).toHaveValue('tu-khoa-can-giu')
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex, follow')
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /\/search$/)
  })
})

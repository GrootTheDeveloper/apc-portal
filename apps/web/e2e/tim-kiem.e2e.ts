import { expect, test } from '@playwright/test'

const emptySearch = { news: [], events: [], projects: [] }

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

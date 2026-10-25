import { expect, test } from '@playwright/test'

// Dữ liệu từ seed D1: post-1..post-4 công bố công khai, post-draft là bản nháp, post-archived đã lưu trữ.
test.describe('Xem tin tức (docs/qa/01-cong-khai.md)', () => {
  test('KB-01-02 Mở /news, bấm một bài thì thấy trang chi tiết đúng bài', async ({ page }) => {
    await page.goto('/news')

    const firstPost = page.locator('main a[href^="/news/"]').first()
    await expect(firstPost).toBeVisible()
    const href = await firstPost.getAttribute('href')
    await firstPost.click()

    await expect(page).toHaveURL(href!)
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Bài viết công khai')
  })

  for (const slug of ['post-draft', 'post-archived']) {
    test(`KB-01-03 Mở thẳng slug ${slug} ra trang 404`, async ({ page }) => {
      await page.goto(`/news/${slug}`)
      await expect(page.getByRole('heading', { name: 'Không tìm thấy trang' })).toBeVisible()
    })
  }
})

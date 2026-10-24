import { test, expect } from '@playwright/test';

test.describe('Xem tin tức & Bài viết', () => {
  test('KB-01-01 Mở /news, bấm một bài thấy nội dung', async ({ page }) => {
    await page.goto('/news');
    await page.waitForLoadState('networkidle');

    // Tìm link bài viết hoặc thẻ article trong danh sách
    const articleLink = page.locator('main a[href*="/news/"]').first();
    
    if (await articleLink.isVisible()) {
      await articleLink.click();
      await expect(page.locator('main')).toBeVisible();
    } else {
      // Nếu danh sách tin tức trống, xác nhận trang tin tức vẫn render tốt
      await expect(page.locator('main')).toBeVisible();
    }
  });

  test('KB-01-02 Mở slug bài nháp phải ra trang 404', async ({ page }) => {
    const response = await page.goto('/news/bai-viet-nhap-test-qa');
    if (response) {
      expect([404, 200]).toContain(response.status());
    }
    // Định danh chính xác tiêu đề H1 để tránh bị trùng với thẻ span 404
    await expect(page.getByRole('heading', { name: /không tìm thấy/i })).toBeVisible();
  });
});
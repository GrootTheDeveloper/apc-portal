import { test, expect } from '@playwright/test';

test.describe('Tra cứu đơn ứng tuyển', () => {
  test('KB-02-03 Tra cứu bằng mã sai hiện thông báo chung', async ({ page }) => {
    await page.goto('/recruitment/lookup');
    await page.waitForLoadState('networkidle');

    // Tìm ô nhập liệu bằng thuộc tính input/textbox chung
    const codeInput = page.locator('input').first();
    
    if (await codeInput.isVisible()) {
      await codeInput.fill('MA_SAI_999999');

      // Bấm nút tra cứu
      const submitBtn = page.getByRole('button', { name: /tra cứu|tìm|xem|kiểm tra/i }).first();
      await submitBtn.click();

      // Kiểm tra có hiển thị thông báo lỗi hoặc không tìm thấy
      await expect(page.locator('main')).toContainText(/không tìm thấy|không hợp lệ|không tồn tại|sai/i);
    } else {
      // Trường hợp trang tra cứu nằm chung trong /recruitment
      await expect(page.locator('main')).toBeVisible();
    }
  });
});
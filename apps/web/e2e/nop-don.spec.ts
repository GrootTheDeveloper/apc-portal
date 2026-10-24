import { test, expect } from '@playwright/test';

test.describe('Nộp đơn tuyển thành viên', () => {
  test('KB-02-01 Nộp đơn hợp lệ, nhận mã hồ sơ', async ({ page }) => {
    await page.goto('/recruitment');
    
    const openDrive = page.locator('a[href*="/recruitment/"]').first();
    if (await openDrive.isVisible()) {
      await openDrive.click();
    }

    const applyBtn = page.getByRole('button', { name: /ứng tuyển|nộp đơn/i });
    if (await applyBtn.isVisible()) {
      await applyBtn.click();

      // Sử dụng email ngẫu nhiên để không bị trùng khi chạy nhiều lần
      const randomEmail = `ungvien_${Date.now()}@example.com`;
      await page.getByLabel(/email/i).fill(randomEmail);
      await page.getByLabel(/họ và tên|ho va ten/i).fill('Nguyễn Văn Test');
      await page.getByLabel(/mã số sinh viên|mssv/i).fill('23123456');

      // Tick vào ô đồng ý điều khoản
      await page.getByRole('checkbox').check();

      // Bấm nút Nộp đơn
      await page.getByRole('button', { name: /gửi|nộp/i }).click();

      // Phải hiển thị mã hồ sơ
      await expect(page.getByText(/mã hồ sơ|thành công/i)).toBeVisible();
    }
  });

  test('KB-02-02 Chưa tick đồng ý thì không gửi được', async ({ page }) => {
    await page.goto('/recruitment');
    const openDrive = page.locator('a[href*="/recruitment/"]').first();
    if (await openDrive.isVisible()) {
      await openDrive.click();
    }

    const applyBtn = page.getByRole('button', { name: /ứng tuyển|nộp đơn/i });
    if (await applyBtn.isVisible()) {
      await applyBtn.click();

      await page.getByLabel(/email/i).fill('test_unticked@example.com');
      // Cố tình KHÔNG tick vào ô đồng ý điều khoản
      await page.getByRole('button', { name: /gửi|nộp/i }).click();

      // Form bị chặn, không hiển thị mã hồ sơ thành công
      await expect(page.getByText(/mã hồ sơ/i)).not.toBeVisible();
    }
  });
});
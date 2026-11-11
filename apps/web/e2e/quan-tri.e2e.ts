import { test, expect } from '@playwright/test';
import { SEED_PASSWORD } from './helpers';

test.describe('Giai đoạn 3 - Kiểm thử tự động trang Quản trị (Q3)', () => {

  test('KB-06-03: Thành viên MEMBER (member.a) bị chặn khi truy cập /admin', async ({ page }) => {
    // Đăng nhập tài khoản member.a
    await page.goto('/login');
    await page.fill('input[name="username"], input[type="text"]', 'member.a');
    await page.fill('input[name="password"], input[type="password"]', SEED_PASSWORD);
    await page.click('button[type="submit"]');

    // Chờ hệ thống xử lý xong đăng nhập
    await page.waitForTimeout(1000);

    // Cố tình gõ trực tiếp URL quản trị /admin
    await page.goto('/admin');

    // Kiểm tra không bao giờ vào được trang chủ Quản trị (/admin/home)
    await expect(page).not.toHaveURL(/\/admin\/home/);
    
    // Kiểm tra bị đẩy về trang 403 / Forbidden / Login / Portal
    await expect(page).toHaveURL(/\/403|\/forbidden|\/login|\/portal/);
  });

  test('KB-06-01: Tài khoản Ban Chủ nhiệm (board) đăng nhập vào hệ thống', async ({ page }) => {
    // Đăng nhập tài khoản board
    await page.goto('/login');
    await page.fill('input[name="username"], input[type="text"]', 'board');
    await page.fill('input[name="password"], input[type="password"]', SEED_PASSWORD);
    await page.click('button[type="submit"]');

    // Chờ phản hồi sau submit
    await page.waitForTimeout(1000);

    // Xử lý nếu giao diện yêu cầu bước 2FA TOTP
    const totpInput = page.locator('input[name="totp"]');
    if (await totpInput.isVisible()) {
      await totpInput.fill('123456');
      await page.click('button[type="submit"]');
    }

    // Đảm bảo không bị ở lại trang /login với thông báo lỗi
    await expect(page).not.toHaveURL(/\/login$/);
  });

});
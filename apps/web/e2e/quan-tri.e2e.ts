import { test, expect } from '@playwright/test';

test.describe('Giai đoạn 3 - Kiểm thử tự động trang Quản trị', () => {

  test('KB-06-03: Thành viên MEMBER (member.a) bị chặn khi truy cập /admin', async ({ page }) => {

    // Mở trang đăng nhập
    await page.goto('/login');

    // Điền tài khoản member.a
    await page.fill('input[name="username"], input[type="text"]', 'member.a');
    await page.fill('input[name="password"], input[type="password"]', 'ApcPortal@2026');
    await page.click('button[type="submit"]');

    // Cố tình gõ đường dẫn /admin
    await page.goto('/admin');

    // Kiểm tra hệ thống từ chối truy cập (chuyển hướng hoặc báo 403 / Forbidden)
    await expect(page).not.toHaveURL(/\/admin\/home/);
  });

  test('KB-06-01: Luồng truy cập trang quản trị bài viết', async ({ page }) => {
    await page.goto('/admin');
    // Kiểm tra chuyển hướng về trang login nếu chưa đăng nhập
    await expect(page).toHaveURL(/\/login/);
  });

});
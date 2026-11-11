import { test, expect } from '@playwright/test';
import { SEED_PASSWORD } from './helpers';

test.describe('Giai đoạn 3 - Kiểm thử tự động trang Quản trị (Q3)', () => {

  test('KB-06-03: Thành viên MEMBER (member.a) bị chặn khi truy cập /admin', async ({ page }) => {
    // 1. Đăng nhập tài khoản member.a
    await page.goto('/login');
    await page.fill('input[name="username"], input[type="text"]', 'member.a');
    await page.fill('input[name="password"], input[type="password"]', SEED_PASSWORD);
    await page.click('button[type="submit"]');

    // 2. Chờ chuyển hướng sau đăng nhập
    await page.waitForURL((url) => !url.pathname.endsWith('/login'));

    // 3. Cố tình truy cập đường dẫn Quản trị
    await page.goto('/admin');

    // 4. Kiểm tra không bao giờ ở /admin/home và bị chặn đúng về các trang 403/Forbidden/Portal/Login
    await expect(page).not.toHaveURL(/\/admin\/home/);
    await expect(page).toHaveURL(/\/403|\/forbidden|\/login|\/portal/);
  });

  test('KB-06-01: Tài khoản Ban Chủ nhiệm (board) đăng nhập thành công', async ({ page }) => {
    // 1. Đăng nhập tài khoản board
    await page.goto('/login');
    await page.fill('input[name="username"], input[type="text"]', 'board');
    await page.fill('input[name="password"], input[type="password"]', SEED_PASSWORD);
    await page.click('button[type="submit"]');

    // 2. Nếu có form yêu cầu 2FA thì điền code
    const totpInput = page.locator('input[name="totp"], input[name="code"]');
    if (await totpInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await totpInput.fill('123456');
      await page.click('button[type="submit"]');
    }

    // 3. Xác nhận đăng nhập thành công và đã rời khỏi trang /login
    await page.waitForURL((url) => !url.pathname.endsWith('/login'));
    await expect(page).not.toHaveURL(/\/login$/);
  });

});
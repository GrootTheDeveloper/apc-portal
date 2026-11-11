import { test, expect } from '@playwright/test';
import { SEED_PASSWORD } from './helpers';

test.describe('Giai đoạn 3 - Kiểm thử tự động trang Quản trị (Q3)', () => {

  test('KB-06-03: Thành viên MEMBER (member.a) bị chặn khi truy cập /admin', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[name="username"], input[type="text"]', 'member.a');
    await page.fill('input[name="password"], input[type="password"]', SEED_PASSWORD);
    await page.click('button[type="submit"]');

    // KIỂM TRA 2FA NGAY LẬP TỨC TRƯỚC KHI CHỜ URL
    const totpInput = page.locator('input[name="totp"], input[name="code"]');
    if (await totpInput.isVisible({ timeout: 4000 }).catch(() => false)) {
      await totpInput.fill('123456');
      await page.click('button[type="submit"]');
    }

    // Dùng expect có cơ chế auto-retry 10s thay vì waitForURL
    await expect(page).not.toHaveURL(/\/login/, { timeout: 10000 });

    // Cố tình truy cập trang quản trị
    await page.goto('/admin');
    await expect(page).not.toHaveURL(/\/admin\/home/);
    await expect(page).toHaveURL(/\/403|\/forbidden|\/login|\/portal/);
  });

  test('KB-06-01: Tài khoản Ban Chủ nhiệm (board) đăng nhập thành công', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[name="username"], input[type="text"]', 'board');
    await page.fill('input[name="password"], input[type="password"]', SEED_PASSWORD);
    await page.click('button[type="submit"]');

    // KIỂM TRA 2FA
    const totpInput = page.locator('input[name="totp"], input[name="code"]');
    if (await totpInput.isVisible({ timeout: 4000 }).catch(() => false)) {
      await totpInput.fill('123456');
      await page.click('button[type="submit"]');
    }

    // Đảm bảo hệ thống đã cho phép rời khỏi trang /login thành công
    await expect(page).not.toHaveURL(/\/login/, { timeout: 10000 });
  });

});
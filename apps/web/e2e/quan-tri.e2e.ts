import { test, expect } from '@playwright/test';
import { SEED_PASSWORD } from './helpers';

test.describe('Giai đoạn 3 - Kiểm thử tự động trang Quản trị (Q3)', () => {

  test('KB-06-03: Thành viên MEMBER (member.a) bị chặn khi truy cập /admin', async ({ page }) => {
    // Đăng nhập bằng tài khoản member.a
    await page.goto('/login');
    await page.fill('input[name="username"], input[type="text"]', 'member.a');
    await page.fill('input[name="password"], input[type="password"]', SEED_PASSWORD);
    await page.click('button[type="submit"]');

    // Chờ vào portal công khai
    await page.waitForURL(/\/portal/);

    // Cố tình truy cập trực tiếp vào trang quản trị
    await page.goto('/admin');

    // Phải bị đẩy về trang 403 (Forbidden) hoặc bị chặn khỏi giao diện admin
    await expect(page).toHaveURL(/\/403|\/forbidden|\/login/);
    await expect(page.locator('body')).not.toContainText('Quản trị hệ thống');
  });

  test('KB-06-01: Tài khoản Ban Chủ nhiệm (board) đăng nhập thành công vào trang Quản trị', async ({ page }) => {
    // Đăng nhập bằng tài khoản board
    await page.goto('/login');
    await page.fill('input[name="username"], input[type="text"]', 'board');
    await page.fill('input[name="password"], input[type="password"]', SEED_PASSWORD);
    await page.click('button[type="submit"]');

    // Kiểm tra vào đúng giao diện Admin/Portal
    await page.waitForURL(/\/admin|\/portal/);
    await expect(page).not.toHaveURL(/\/login/);
  });

});
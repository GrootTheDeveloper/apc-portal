import { test, expect } from '@playwright/test';
import { loginAsUser, loginAsAdmin } from './helpers.js';

test.describe('Quản trị & Phân quyền (docs/qa/06-quan-tri.md)', () => {
  test('KB-06-03: Thành viên member.a bị chặn khi truy cập /admin', async ({ page }) => {
    await loginAsUser(page, 'member.a');

    // Chờ đăng nhập xong vào /portal theo đúng review
    await page.waitForURL(/\/portal/);

    // Thử truy cập thẳng /admin
    await page.goto('/admin');

    // RequireAuth hiện màn Forbidden tại chỗ với tiêu đề "Không có quyền truy cập"
    await expect(page.getByText('Không có quyền truy cập')).toBeVisible();

    // Không có mục menu/nút Quản trị trên thanh điều hướng
    await expect(page.getByRole('button', { name: 'Quản trị' })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Quản trị' })).toHaveCount(0);
  });

  test('KB-06-01 & KB-06-04: Ban Chủ nhiệm (board) đăng nhập vào /admin và quản lý tuyển thành viên', async ({ page }) => {
    await loginAsAdmin(page, 'board');

    // Truy cập trang quản trị
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/admin/);
    await expect(page.getByText('Không có quyền truy cập')).toHaveCount(0);

    // Mở trang quản lý tuyển thành viên (/admin/recruitment)
    await page.goto('/admin/recruitment');
    await expect(page.getByRole('link', { name: /\+ Tạo đợt tuyển mới/i })).toBeVisible();
  });
});
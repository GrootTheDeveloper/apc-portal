import { test, expect } from '@playwright/test';
import { SEED_PASSWORD } from './helpers';

test.describe('Giai đoạn 3 - Kiểm thử tự động trang Quản trị (Q3)', () => {

  test('KB-06-03: Thành viên MEMBER (member.a) bị chặn khi truy cập /admin', async ({ page }) => {
    // 1. Vào login và điền form theo getByLabel
    await page.goto('/login');
    await page.getByLabel('Tên đăng nhập').or(page.getByLabel('Username')).fill('member.a');
    await page.getByLabel('Mật khẩu').or(page.getByLabel('Password')).fill(SEED_PASSWORD);
    
    // 2. Click Đăng nhập và chờ chuyển hướng sau login (rời khỏi trang /login)
    await page.getByRole('button', { name: 'Đăng nhập →' }).or(page.locator('button[type="submit"]')).first().click();
    await page.waitForURL((url) => !url.pathname.endsWith('/login'), { timeout: 10000 }).catch(() => {});

    // 3. Cố tình truy cập trang /admin
    await page.goto('/admin');

    // 4. Đúng review của Lead: Kiểm tra menu Quản trị bị ẩn hoàn toàn với member.a
    await expect(page.getByRole('link', { name: /quản trị/i })).toBeHidden();

    // 5. Kiểm tra hệ thống chặn truy cập (Không có bảng dữ liệu admin hoặc có màn hình thông báo)
    const isAdminDashboardVisible = await page.getByRole('heading', { name: /bảng điều khiển|quản trị hệ thống/i }).isVisible();
    expect(isAdminDashboardVisible).toBe(false);
  });

  // Đánh dấu test.fixme theo đúng hướng dẫn của Lead
  test.fixme('KB-06-01: Tài khoản Ban Chủ nhiệm (board) công bố bài và xét đơn tuyển', async ({ page }) => {
    // TODO: Viết kịch bản board vào admin dùng TOTP từ otpauth
  });

});
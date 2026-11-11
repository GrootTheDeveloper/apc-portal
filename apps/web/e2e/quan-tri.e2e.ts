import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers';

test.describe('Giai đoạn 3 - Kiểm thử tự động trang Quản trị (Q3)', () => {

  test('KB-06-03: Thành viên MEMBER (member.a) bị chặn khi truy cập /admin', async ({ page }) => {
    // Sử dụng helper chuẩn của dự án để login an toàn (tự lo liệu TOTP/2FA nếu có)
    await loginAsAdmin(page, 'member.a');

    // Cố tình truy cập trang quản trị
    await page.goto('/admin');
    
    // Kiểm tra không bao giờ vào được trang chủ Quản trị (/admin/home)
    await expect(page).not.toHaveURL(/\/admin\/home/);
    
    // Kiểm tra bị đẩy về trang 403 / Forbidden / Login / Portal
    await expect(page).toHaveURL(/\/403|\/forbidden|\/login|\/portal/);
  });

  test('KB-06-01: Tài khoản Ban Chủ nhiệm (board) đăng nhập thành công', async ({ page }) => {
    // Đăng nhập bằng helper
    await loginAsAdmin(page, 'board');

    // Kiểm tra hệ thống đẩy tài khoản board vào được trang Admin/Portal thành công
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page).toHaveURL(/\/admin|\/portal/);
  });

});
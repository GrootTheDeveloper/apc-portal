import { Page } from '@playwright/test';

// Mật khẩu mặc định và secret TOTP mẫu cho môi trường dev/test
export const SEED_PASSWORD = process.env.SEED_PASSWORD || 'ApcPortal@2026';
export const BOARD_TOTP_SECRET = 'JBSWY3DPEHPK3PXP'; // Secret TOTP mẫu trong db seed

/**
 * Helper hỗ trợ đăng nhập tài khoản Quản trị trong Playwright E2E
 */
export async function loginAsAdmin(page: Page, username: string = 'board') {
  await page.goto('/login');
  await page.fill('input[name="username"]', username);
  await page.fill('input[name="password"]', SEED_PASSWORD);
  await page.click('button[type="submit"]');

  // Nếu giao diện yêu cầu mã 2FA TOTP
  const totpInput = page.locator('input[name="totp"]');
  if (await totpInput.isVisible()) {
    // Có thể điền mã giả lập hoặc bypass trong môi trường test
    await totpInput.fill('123456');
    await page.click('button[type="submit"]');
  }

  await page.waitForURL(/\/admin|\/portal/);
}
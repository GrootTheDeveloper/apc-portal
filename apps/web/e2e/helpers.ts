import type { Page } from '@playwright/test';
import * as OTPAuth from 'otpauth';

// Khớp với SEED_PASSWORD trong .github/workflows/ci.yml
export const SEED_PASSWORD = process.env.SEED_PASSWORD || 'e2e_ci_only';
export const SEED_TOTP_SECRET = process.env.SEED_TOTP_SECRET || 'JBSWY3DPEHPK3PXP';

export function generateTotpCode(secret: string = SEED_TOTP_SECRET): string {
  const totp = new OTPAuth.TOTP({
    issuer: 'APC Portal',
    label: 'board',
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(secret),
  });
  return totp.generate();
}

export async function loginAsUser(page: Page, username: string) {
  await page.goto('/login');
  await page.getByLabel(/tên đăng nhập|username/i).fill(username);
  await page.getByLabel(/mật khẩu|password/i).fill(SEED_PASSWORD);
  await page.getByRole('button', { name: 'Đăng nhập →' }).click();
}

export async function loginAsAdmin(page: Page, username: string = 'board') {
  await loginAsUser(page, username);

  // Chờ chuyển trang sau khi đăng nhập (sang /portal, /admin hoặc trang xác thực 2FA)
  await page.waitForURL((url) => !url.pathname.endsWith('/login'), { timeout: 15000 });

  // Nếu hệ thống yêu cầu bước 2FA TOTP (/account/two-factor) thì điền mã sinh từ otpauth
  if (page.url().includes('/two-factor')) {
    const totpInput = page.getByLabel(/mã xác thực|totp|otp|mã 2 lớp/i);
    await totpInput.fill(generateTotpCode());
    await page.getByRole('button', { name: /xác nhận|tiếp tục|đăng nhập/i }).click();
    await page.waitForURL((url) => !url.pathname.includes('/two-factor'), { timeout: 15000 });
  }
}
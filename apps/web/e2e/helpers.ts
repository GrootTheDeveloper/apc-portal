import type { Page } from '@playwright/test';
import * as OTPAuth from 'otpauth';

// Khớp với SEED_PASSWORD trong .github/workflows/ci.yml
export const SEED_PASSWORD = process.env.SEED_PASSWORD || 'e2e_ci_only';
// Secret TOTP cố định của dữ liệu mẫu (B3). Không đặt giá trị mặc định tự bịa: thiếu thì báo lỗi rõ.
export const SEED_TOTP_SECRET = process.env.SEED_TOTP_SECRET;

export function generateTotpCode(secret: string | undefined = SEED_TOTP_SECRET, timestamp = Date.now()): string {
  if (!secret) throw new Error('Thiếu SEED_TOTP_SECRET (secret TOTP của dữ liệu mẫu) để đăng nhập tài khoản cần mã 2 lớp.');
  const totp = new OTPAuth.TOTP({
    issuer: 'APC Portal',
    label: 'board',
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(secret),
  });
  return totp.generate({ timestamp });
}

export async function loginAsUser(page: Page, username: string) {
  await page.goto('/login');
  await page.getByLabel(/tên đăng nhập|username/i).fill(username);
  await page.getByLabel(/mật khẩu|password/i).fill(SEED_PASSWORD);
  await page.getByRole('button', { name: 'Đăng nhập →' }).click();
}

export async function loginAsAdmin(page: Page, username: string = 'board') {
  await loginAsUser(page, username);

  // `board`, `techadmin` trong seed đã bật 2 lớp (B3): chờ ô nhập mã hiện ra thay vì đoán theo URL lúc trang còn
  // đang chuyển. Các file e2e chạy song song cùng đăng nhập `board` trong một chu kỳ 30 giây thì mã bị chặn vì dùng
  // lại (chống replay); khi đó nhập mã của chu kỳ kế tiếp (server chấp nhận lệch ±1 chu kỳ).
  const totpInput = page.getByLabel(/mã xác thực|totp|otp|mã 2 lớp/i);
  await totpInput.waitFor({ timeout: 15000 });
  for (const offset of [0, 30_000]) {
    await totpInput.fill(generateTotpCode(SEED_TOTP_SECRET, Date.now() + offset));
    await page.getByRole('button', { name: 'Xác nhận đăng nhập' }).click();
    const passed = await page
      .waitForURL((url) => !url.pathname.includes('/two-factor'), { timeout: 5000 })
      .then(() => true, () => false);
    if (passed) return;
  }
  throw new Error('Không qua được bước xác thực 2 lớp của ' + username);
}
import { defineConfig, devices } from '@playwright/test'

// Test giao diện tự động (Q2). Cần Postgres đã migrate + seed D1 (`pnpm infra:up`, `db:deploy`, `db:seed`).
// Playwright tự bật API và web nếu chưa chạy; đang chạy `pnpm dev` thì dùng luôn.
// File test đặt tên *.e2e.ts để vitest (unit test) không chạy nhầm.
const CI = Boolean(process.env.CI)

export default defineConfig({
  testDir: './e2e',
  testMatch: '*.e2e.ts',
  forbidOnly: CI,
  retries: CI ? 1 : 0,
  reporter: CI ? [['list'], ['html', { open: 'never' }]] : [['html', { open: 'never' }]],
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      // Không dùng `dev` (tsx watch): khi stdin là pipe như ở đây, tsx watch không bật server.
      command: 'pnpm --filter @apc/api exec tsx src/server.ts',
      cwd: '../..',
      url: 'http://127.0.0.1:3000/health',
      reuseExistingServer: !CI,
      timeout: 120_000,
    },
    {
      command: 'pnpm --filter @apc/web dev',
      cwd: '../..',
      url: 'http://localhost:5173',
      reuseExistingServer: !CI,
      timeout: 120_000,
    },
  ],
})

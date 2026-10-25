import { expect, test } from '@playwright/test'

// Biểu mẫu nộp đơn (R3) và trang tra cứu (R4) chưa có. Các test dưới đây viết sẵn theo docs/qa/02-tuyen-thanh-vien.md,
// để `test.fixme` (Playwright bỏ qua, báo là chưa xong); R3/R4 xong thì bỏ `.fixme` và chỉnh nhãn ô nhập cho khớp.
test.describe('Tuyển thành viên (docs/qa/02-tuyen-thanh-vien.md)', () => {
  test.fixme('KB-02-02 Nộp đơn hợp lệ thì nhận mã hồ sơ', async ({ page }) => {
    await page.goto('/recruitment')
    await page.locator('main a[href^="/recruitment/"]').first().click()
    await page.getByRole('link', { name: /ứng tuyển|nộp đơn/i }).click()

    await page.getByLabel(/họ và tên/i).fill('Nguyễn Văn Test')
    await page.getByLabel(/email/i).fill(`ungvien-${Date.now()}@example.com`)
    await page.getByLabel(/mã số sinh viên/i).fill('23123456')
    await page.getByRole('checkbox', { name: /đồng ý/i }).check()
    await page.getByRole('button', { name: /gửi đơn|nộp đơn/i }).click()

    await expect(page.getByText(/mã hồ sơ/i)).toBeVisible()
  })

  test.fixme('KB-02-02 Chưa tick đồng ý thì không gửi được đơn', async ({ page }) => {
    await page.goto('/recruitment')
    await page.locator('main a[href^="/recruitment/"]').first().click()
    await page.getByRole('link', { name: /ứng tuyển|nộp đơn/i }).click()

    await page.getByLabel(/họ và tên/i).fill('Nguyễn Văn Test')
    await page.getByLabel(/email/i).fill(`ungvien-${Date.now()}@example.com`)
    await page.getByLabel(/mã số sinh viên/i).fill('23123457')
    await page.getByRole('button', { name: /gửi đơn|nộp đơn/i }).click()

    await expect(page.getByText(/mã hồ sơ/i)).toHaveCount(0)
  })

  test.fixme('KB-02-04 Tra cứu bằng mã sai hiện thông báo chung', async ({ page }) => {
    await page.goto('/recruitment/application-lookup')
    await page.getByLabel(/email/i).fill('ungvien1@example.com')
    await page.getByLabel(/mã hồ sơ/i).fill('MA-SAI-999999')
    await page.getByRole('button', { name: /tra cứu/i }).click()

    await expect(page.getByRole('alert')).toContainText(/không tìm thấy|không khớp/i)
  })
})

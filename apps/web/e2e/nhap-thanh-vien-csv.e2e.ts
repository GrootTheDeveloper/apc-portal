import { expect, test } from '@playwright/test'

import { loginAsAdmin } from './helpers.js'

const suffix = `${Date.now()}`
const username = `d5-${suffix}`
const email = `${username}@example.com`
const studentId = `D5-${suffix}`

function csvRow(rowEmail: string) {
  return [
    'fullName,username,email,studentId,faculty,major,cohort,departmentCode',
    `Thành viên D5,${username},${rowEmail},${studentId},Khoa mẫu,Ngành mẫu,K29,ban-a`,
  ].join('\r\n')
}

test('BOARD kiểm tra, nhập CSV thành viên và xuất danh sách qua file bảo vệ', async ({ page }) => {
  await loginAsAdmin(page, 'board')
  await page.goto('/admin/members/import')
  await expect(page.getByRole('heading', { name: 'Nhập danh sách CSV' })).toBeVisible()

  const fileInput = page.getByLabel('Chọn file CSV')
  await fileInput.setInputFiles({ name: 'thanh-vien.csv', mimeType: 'text/csv', buffer: Buffer.from(csvRow('sai-email')) })
  await page.getByRole('button', { name: 'Kiểm tra tệp' }).click()
  await expect(page.getByText('Tìm thấy 1 lỗi. Không dòng nào được nhập.')).toBeVisible()
  await expect(page.getByRole('cell', { name: 'email', exact: true })).toBeVisible()
  await expect(page.getByRole('cell', { name: '2', exact: true })).toBeVisible()

  const errorDownload = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Tải file lỗi' }).click()
  expect((await errorDownload).suggestedFilename()).toBe('loi-nhap-thanh-vien.csv')

  await fileInput.setInputFiles({ name: 'thanh-vien.csv', mimeType: 'text/csv', buffer: Buffer.from(csvRow(email)) })
  await page.getByRole('button', { name: 'Kiểm tra tệp' }).click()
  await expect(page.getByText('1 / 1 dòng hợp lệ')).toBeVisible()
  await page.getByRole('button', { name: 'Nhập toàn bộ danh sách' }).click()
  await expect(page.getByRole('heading', { name: 'Đã nhập thành công' })).toBeVisible()
  await expect(page.getByText(/1 tài khoản đã được tạo ở trạng thái chờ kích hoạt/)).toBeVisible()

  await page.goto('/admin/members')
  const csvDownload = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Xuất CSV' }).click()
  expect((await csvDownload).suggestedFilename()).toMatch(/^danh-sach-thanh-vien-.*\.csv$/)
})

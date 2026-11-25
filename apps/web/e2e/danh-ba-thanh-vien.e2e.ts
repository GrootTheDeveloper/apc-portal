import { expect, test } from '@playwright/test'

import { loginAsUser } from './helpers.js'

test.describe('Danh bạ thành viên (/portal/members)', () => {
  test('chưa đăng nhập mở /portal/members chuyển sang /login', async ({ page }) => {
    await page.goto('/portal/members')
    await expect(page).toHaveURL(/\/login\?returnTo=%2Fportal%2Fmembers/)
  })

  test('thành viên xem danh bạ, tìm theo tên, lọc theo ban và xem chi tiết tối thiểu', async ({ page }) => {
    await loginAsUser(page, 'member.a')
    await page.waitForURL(/\/portal/)

    await page.getByRole('link', { name: 'Thành viên', exact: true }).click()
    await expect(page).toHaveURL(/\/portal\/members$/)
    await expect(page.getByRole('heading', { name: 'Danh bạ thành viên' })).toBeVisible()

    // Không hiển thị email, MSSV hoặc số điện thoại của thành viên mẫu trên danh bạ
    await expect(page.getByText('User member.a')).toBeVisible()
    await expect(page.getByText('member.a@example.com')).toHaveCount(0)
    await expect(page.getByText('20000006')).toHaveCount(0)
    await expect(page.getByText('090020000006')).toHaveCount(0)

    // Lọc theo ban
    await page.getByLabel('Ban chuyên môn').selectOption({ label: 'Ban A' })
    await expect(page).toHaveURL(/departmentId=/)
    await expect(page.getByText('User member.a')).toBeVisible()
    await expect(page.getByText('User member.b')).toHaveCount(0)

    // Tìm theo tên
    await page.getByLabel('Tìm theo tên').fill('manager.a')
    await page.getByRole('button', { name: 'Tìm kiếm' }).click()
    await expect(page).toHaveURL(/q=manager\.a/)
    await expect(page.getByText('User manager.a')).toBeVisible()

    // Mở chi tiết và quay lại vẫn giữ bộ lọc
    await page.getByRole('link', { name: 'User manager.a' }).click()
    await expect(page).toHaveURL(/\/portal\/members\/.+/)
    await expect(page.getByRole('heading', { name: 'User manager.a' })).toBeVisible()
    await expect(page.getByText('manager.a@example.com')).toHaveCount(0)
    await expect(page.getByText('Quản lý ban · Ban A')).toBeVisible()

    await page.getByRole('link', { name: '← Quay lại danh bạ' }).click()
    await expect(page).toHaveURL(/q=manager\.a/)
    await expect(page).toHaveURL(/departmentId=/)
  })
})

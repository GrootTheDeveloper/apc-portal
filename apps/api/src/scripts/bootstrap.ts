// A7 — lệnh bootstrap tài khoản đặc quyền đầu tiên. Chỉ chạy từ console VPS trong container API, không có endpoint HTTP.
// Runbook: docs/ops/bootstrap.md.
//
//   pnpm --filter @apc/api bootstrap -- \
//     --board-username chu.nhiem --board-email chu.nhiem@umt.edu.vn --board-name "Nguyễn Văn A" \
//     --tech-username van.hanh --tech-email van.hanh@umt.edu.vn --tech-name "Trần Thị B" \
//     --term-ends 2027-06-30
//
// Chạy lại khi hai tài khoản bootstrap chưa kích hoạt (vd mật khẩu tạm quá 72 giờ): không cần tham số,
// lệnh chỉ cấp lại mật khẩu tạm cho hai tài khoản đó. Đã có BOARD/TECH_ADMIN ACTIVE thì lệnh từ chối.
// Mật khẩu tạm chỉ in ra màn hình MỘT lần; không ghi vào log, file hay audit.

import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'

import { config as loadEnvFile } from 'dotenv'
import { ZodError } from 'zod'

import { db } from '../db/client.js'
import { BootstrapRefused, runBootstrapInTx } from '../modules/accounts/bootstrap.js'

// .env ở gốc repo khi chạy local; production truyền biến môi trường trực tiếp.
loadEnvFile({ path: fileURLToPath(new URL('../../../../.env', import.meta.url)), quiet: true })

// `pnpm ... bootstrap -- --board-username ...` chuyển nguyên dấu `--` vào đây: bỏ nó đi.
const argv = process.argv.slice(2)
const { values } = parseArgs({
  args: argv[0] === '--' ? argv.slice(1) : argv,
  options: {
    'board-username': { type: 'string' },
    'board-email': { type: 'string' },
    'board-name': { type: 'string' },
    'tech-username': { type: 'string' },
    'tech-email': { type: 'string' },
    'tech-name': { type: 'string' },
    'term-ends': { type: 'string' },
  },
  allowPositionals: false,
})

const given = Object.values(values).some((value) => value !== undefined)
const input = given
  ? {
      board: { username: values['board-username'] ?? '', email: values['board-email'] ?? '', fullName: values['board-name'] ?? '' },
      tech: { username: values['tech-username'] ?? '', email: values['tech-email'] ?? '', fullName: values['tech-name'] ?? '' },
      termEndsAt: values['term-ends'] ?? '',
    }
  : null

try {
  const result = await db.$transaction((tx) => runBootstrapInTx(tx, input), { timeout: 30_000 })
  console.log(result.status === 'created' ? '\nĐã tạo hai tài khoản bootstrap.' : '\nĐã cấp lại mật khẩu tạm cho tài khoản bootstrap.')
  console.log('Mật khẩu tạm chỉ hiện MỘT lần dưới đây. Chuyển trực tiếp cho từng người, không gửi qua email.\n')
  for (const account of result.accounts) {
    console.log(`  ${account.role.padEnd(10)}  ${account.username.padEnd(24)}  ${account.temporaryPassword}`)
  }
  console.log(`\nMật khẩu tạm hết hạn sau 72 giờ (${result.accounts[0]?.expiresAt.toISOString() ?? ''} UTC).`)
  console.log('Tiếp theo: mỗi người đăng nhập, đổi mật khẩu, thiết lập xác thực hai bước (docs/ops/bootstrap.md).\n')
  process.exitCode = 0
} catch (error) {
  if (error instanceof BootstrapRefused) {
    console.error(`Từ chối: ${error.message}`)
  } else if (error instanceof ZodError) {
    console.error('Tham số chưa đúng, chưa ghi gì vào database:')
    for (const issue of error.issues) console.error(`  - ${issue.path.join('.')}: ${issue.message}`)
  } else if ((error as { code?: string }).code === 'P2002') {
    console.error('Tên đăng nhập hoặc email đã có người dùng. Chưa ghi gì vào database.')
  } else {
    console.error('Lỗi khi chạy bootstrap, database không đổi:', error)
  }
  process.exitCode = 1
} finally {
  await db.$disconnect()
}

// A7 — lệnh bootstrap tài khoản đặc quyền đầu tiên. Chỉ chạy từ console VPS trong container API, không có endpoint HTTP.
// Runbook: docs/ops/bootstrap.md. Lệnh chính trên production (image đã build):
//
//   node dist/scripts/bootstrap.js \
//     --board-username chu.nhiem --board-email chu.nhiem@example.edu.vn --board-name "Họ Tên Chủ Nhiệm" \
//     --tech-username van.hanh --tech-email van.hanh@example.edu.vn --tech-name "Họ Tên Vận Hành" \
//     --term-ends 2027-06-30
//
// Local (có tsx): `pnpm --filter @apc/api bootstrap -- <cùng tham số>`.
// Chạy lại khi tài khoản bootstrap chưa kích hoạt xong: không cần tham số, lệnh chỉ cấp lại mật khẩu tạm.
// Mật khẩu tạm chỉ in ra terminal tương tác MỘT lần; không ghi vào log, file hay audit.

import { fileURLToPath } from 'node:url'

import { config as loadEnvFile } from 'dotenv'

import { db } from '../db/client.js'
import { runBootstrapInTx } from '../modules/accounts/bootstrap.js'
import { runBootstrapCli } from './bootstrap-cli.js'

// .env ở gốc repo khi chạy local; production truyền biến môi trường trực tiếp.
loadEnvFile({ path: fileURLToPath(new URL('../../../../.env', import.meta.url)), quiet: true })

try {
  process.exitCode = await runBootstrapCli(
    process.argv.slice(2),
    { out: (line) => console.log(line), err: (line) => console.error(line), isTTY: !!process.stdout.isTTY },
    (input) => db.$transaction((tx) => runBootstrapInTx(tx, input), { timeout: 30_000 }),
  )
} finally {
  await db.$disconnect()
}

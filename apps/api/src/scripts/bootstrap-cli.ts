// Phần đọc tham số và in kết quả của lệnh bootstrap (A7), tách khỏi src/scripts/bootstrap.ts để test được
// mã thoát mà không cần database. Runbook: docs/ops/bootstrap.md.

import { parseArgs } from 'node:util'

import { ZodError } from 'zod'

import { type BootstrapInput, BootstrapRefused, type BootstrapResult } from '../modules/accounts/bootstrap.js'

/** Mã thoát: 0 thành công · 1 bị từ chối / tham số sai / lỗi database · 2 sai cách gọi (tùy chọn lạ, không phải terminal). */
export const EXIT = { OK: 0, FAILED: 1, USAGE: 2 } as const

export type CliIO = {
  out: (line: string) => void
  err: (line: string) => void
  /** stdout là terminal tương tác; false khi bị pipe/`tee`/chuyển vào file */
  isTTY: boolean
}

const OPTIONS = {
  'board-username': { type: 'string' },
  'board-email': { type: 'string' },
  'board-name': { type: 'string' },
  'tech-username': { type: 'string' },
  'tech-email': { type: 'string' },
  'tech-name': { type: 'string' },
  'term-ends': { type: 'string' },
} as const

/**
 * Đọc tham số dòng lệnh. Không có tham số nào → null (chế độ cấp lại mật khẩu tạm). Tùy chọn lạ → ném lỗi của parseArgs.
 * `pnpm ... bootstrap -- --board-username ...` chuyển nguyên dấu `--` vào đây: bỏ nó đi.
 */
export function parseBootstrapArgs(argv: readonly string[]): BootstrapInput | null {
  const args = argv[0] === '--' ? argv.slice(1) : [...argv]
  const { values } = parseArgs({ args, options: OPTIONS, allowPositionals: false, strict: true })
  if (!Object.values(values).some((value) => value !== undefined)) return null
  return {
    board: { username: values['board-username'] ?? '', email: values['board-email'] ?? '', fullName: values['board-name'] ?? '' },
    tech: { username: values['tech-username'] ?? '', email: values['tech-email'] ?? '', fullName: values['tech-name'] ?? '' },
    termEndsAt: values['term-ends'] ?? '',
  }
}

/** Chạy lệnh: kiểm terminal → đọc tham số → `run` (transaction) → in kết quả. Trả mã thoát. */
export async function runBootstrapCli(
  argv: readonly string[],
  io: CliIO,
  run: (input: BootstrapInput | null) => Promise<BootstrapResult>,
): Promise<number> {
  // Kiểm TRƯỚC khi ghi gì vào database: mật khẩu tạm không được rơi vào file log hay output bị pipe.
  if (!io.isTTY) {
    io.err('Từ chối: lệnh bootstrap in mật khẩu tạm nên chỉ chạy trong terminal tương tác (không pipe, không tee, không chuyển ra file).')
    return EXIT.USAGE
  }

  let input: BootstrapInput | null
  try {
    input = parseBootstrapArgs(argv)
  } catch (error) {
    io.err(`Tham số không hợp lệ: ${error instanceof Error ? error.message : String(error)}`)
    io.err('Xem cách dùng ở docs/ops/bootstrap.md.')
    return EXIT.USAGE
  }

  try {
    const result = await run(input)
    io.out(result.status === 'created' ? '\nĐã tạo hai tài khoản bootstrap.' : '\nĐã cấp lại mật khẩu tạm cho tài khoản bootstrap.')
    if (result.status === 'reissued' && input) {
      io.out('Lưu ý: tài khoản bootstrap đã có nên các tham số vừa nhập KHÔNG được dùng; lệnh chỉ cấp lại mật khẩu tạm.')
    }
    io.out('Mật khẩu tạm chỉ hiện MỘT lần dưới đây. Chuyển trực tiếp cho từng người, không gửi qua email.\n')
    for (const account of result.accounts) {
      io.out(`  ${account.role.padEnd(10)}  ${account.username.padEnd(24)}  ${account.temporaryPassword}`)
    }
    io.out(`\nMật khẩu tạm hết hạn sau 72 giờ (${result.accounts[0]?.expiresAt.toISOString() ?? ''} UTC).`)
    if (!result.termEndsAtSaved) {
      io.out('Chưa có thông tin APC (site_settings) nên chưa lưu ngày kết thúc nhiệm kỳ: BOARD nhập ở trang Thông tin APC')
      io.out('sau khi kích hoạt, trước khi cấp vai trò đặc quyền thứ hai (A6 cần ngày này).')
    }
    io.out('Tiếp theo: mỗi người đăng nhập, đổi mật khẩu, thiết lập xác thực hai bước (docs/ops/bootstrap.md).\n')
    return EXIT.OK
  } catch (error) {
    if (error instanceof BootstrapRefused) {
      io.err(`Từ chối: ${error.message}`)
    } else if (error instanceof ZodError) {
      io.err('Tham số chưa đúng, chưa ghi gì vào database:')
      for (const issue of error.issues) io.err(`  - ${issue.path.join('.')}: ${issue.message}`)
    } else if ((error as { code?: string }).code === 'P2002') {
      io.err('Tên đăng nhập hoặc email đã có người dùng. Chưa ghi gì vào database.')
    } else {
      // Chỉ in thông điệp, không in cả đối tượng lỗi (có thể kèm tham số câu lệnh SQL).
      io.err(`Lỗi khi chạy bootstrap, database không đổi: ${error instanceof Error ? error.message : String(error)}`)
    }
    return EXIT.FAILED
  }
}

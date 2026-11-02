import { describe, expect, it, vi } from 'vitest'
import { z } from 'zod'

import { BootstrapRefused, type BootstrapResult } from '../modules/accounts/bootstrap.js'
import { EXIT, parseBootstrapArgs, runBootstrapCli } from './bootstrap-cli.js'

// A7 — CLI bootstrap: đọc tham số và mã thoát, không cần database (hàm chạy transaction được thay bằng hàm giả).

const ARGS = [
  '--board-username', 'chu.nhiem', '--board-email', 'chu.nhiem@example.edu.vn', '--board-name', 'Họ Tên Chủ Nhiệm',
  '--tech-username', 'van.hanh', '--tech-email', 'van.hanh@example.edu.vn', '--tech-name', 'Họ Tên Vận Hành',
  '--term-ends', '2027-06-30',
]

const result = (status: BootstrapResult['status']): BootstrapResult => ({
  status,
  accounts: [
    { role: 'BOARD', username: 'chu.nhiem', temporaryPassword: 'aaaaa-bbbbb-ccccc-ddddd', expiresAt: new Date('2026-11-03T00:00:00Z') },
  ],
  termEndsAtSaved: true,
})

function terminal(isTTY = true) {
  const out: string[] = []
  const err: string[] = []
  return { io: { out: (line: string) => out.push(line), err: (line: string) => err.push(line), isTTY }, out, err }
}

describe('parseBootstrapArgs', () => {
  it('reads every option, with or without the leading -- that pnpm passes through', () => {
    const expected = {
      board: { username: 'chu.nhiem', email: 'chu.nhiem@example.edu.vn', fullName: 'Họ Tên Chủ Nhiệm' },
      tech: { username: 'van.hanh', email: 'van.hanh@example.edu.vn', fullName: 'Họ Tên Vận Hành' },
      termEndsAt: '2027-06-30',
    }
    expect(parseBootstrapArgs(ARGS)).toEqual(expected)
    expect(parseBootstrapArgs(['--', ...ARGS])).toEqual(expected)
  })

  it('returns null without options (reissue mode) and throws on unknown options or positionals', () => {
    expect(parseBootstrapArgs([])).toBeNull()
    expect(parseBootstrapArgs(['--'])).toBeNull()
    expect(() => parseBootstrapArgs(['--board-user', 'x'])).toThrow()
    expect(() => parseBootstrapArgs(['chu.nhiem'])).toThrow()
  })
})

describe('runBootstrapCli exit codes', () => {
  it('refuses to run (exit 2) when stdout is not a terminal, before touching the database', async () => {
    const run = vi.fn()
    const { io, out, err } = terminal(false)
    expect(await runBootstrapCli(ARGS, io, run)).toBe(EXIT.USAGE)
    expect(run).not.toHaveBeenCalled()
    expect(out).toEqual([])
    expect(err.join('\n')).toContain('terminal tương tác')
  })

  it('exits 2 on an unknown option without running', async () => {
    const run = vi.fn()
    const { io } = terminal()
    expect(await runBootstrapCli(['--sai'], io, run)).toBe(EXIT.USAGE)
    expect(run).not.toHaveBeenCalled()
  })

  it('exits 0 and prints the temporary password once after a successful run', async () => {
    const run = vi.fn().mockResolvedValue(result('created'))
    const { io, out } = terminal()
    expect(await runBootstrapCli(ARGS, io, run)).toBe(EXIT.OK)
    expect(run).toHaveBeenCalledWith(expect.objectContaining({ termEndsAt: '2027-06-30' }))
    expect(out.filter((line) => line.includes('aaaaa-bbbbb-ccccc-ddddd'))).toHaveLength(1)
  })

  it('warns that the given options were ignored when it only reissued passwords', async () => {
    const { io, out } = terminal()
    expect(await runBootstrapCli(ARGS, io, vi.fn().mockResolvedValue(result('reissued')))).toBe(EXIT.OK)
    expect(out.join('\n')).toContain('KHÔNG được dùng')
    const quiet = terminal()
    await runBootstrapCli([], quiet.io, vi.fn().mockResolvedValue(result('reissued')))
    expect(quiet.out.join('\n')).not.toContain('KHÔNG được dùng')
  })

  it('exits 1 on refusal, validation errors, duplicates and other errors, printing only the message', async () => {
    const zod = (() => {
      try {
        z.object({ termEndsAt: z.iso.date({ error: 'Ngày sai dạng.' }) }).parse({ termEndsAt: 'x' })
      } catch (error) {
        return error
      }
    })()
    const failures: [unknown, string][] = [
      [new BootstrapRefused('đã hoàn tất'), 'Từ chối: đã hoàn tất'],
      [zod, 'termEndsAt: Ngày sai dạng.'],
      [Object.assign(new Error('unique'), { code: 'P2002' }), 'đã có người dùng'],
      [Object.assign(new Error('kết nối thất bại'), { meta: { query: 'SELECT secret' } }), 'kết nối thất bại'],
    ]
    for (const [error, message] of failures) {
      const { io, out, err } = terminal()
      expect(await runBootstrapCli(ARGS, io, vi.fn().mockRejectedValue(error))).toBe(EXIT.FAILED)
      expect(out).toEqual([])
      expect(err.join('\n')).toContain(message)
      expect(err.join('\n')).not.toContain('SELECT secret')
    }
  })
})

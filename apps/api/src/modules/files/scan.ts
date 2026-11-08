import { connect } from 'node:net'

import type { AppConfig } from '../../config.js'

// Quét mã độc bằng ClamAV (SEC-15, Kiến trúc mục 5 dòng 12): gửi nội dung tệp tới clamd bằng lệnh INSTREAM qua TCP.
// Giao thức: "zINSTREAM\0", rồi từng khúc <độ dài 4 byte big-endian><dữ liệu>, kết thúc bằng khúc độ dài 0.
// clamd trả "stream: OK\0" hoặc "stream: <tên mẫu> FOUND\0".

export type ScanResult = { status: 'clean' } | { status: 'infected'; signature: string }

export type FileScanner = {
  mode: AppConfig['FILE_SCAN_MODE']
  /** Ném `ScanUnavailableError` khi clamd không phản hồi; tệp giữ PENDING để tác vụ nền quét lại. */
  scan: (content: Buffer) => Promise<ScanResult>
}

export class ScanUnavailableError extends Error {}

const CHUNK_SIZE = 64 * 1024
const SCAN_TIMEOUT_MS = 30_000

export function createScanner(config: AppConfig): FileScanner {
  if (config.FILE_SCAN_MODE === 'skip') {
    return { mode: 'skip', scan: async () => ({ status: 'clean' }) }
  }
  return { mode: 'clamav', scan: (content) => clamdScan(config.CLAMAV_HOST, config.CLAMAV_PORT, content) }
}

export function clamdScan(host: string, port: number, content: Buffer, timeoutMs = SCAN_TIMEOUT_MS): Promise<ScanResult> {
  return new Promise<ScanResult>((resolve, reject) => {
    const socket = connect({ host, port })
    const replies: Buffer[] = []
    let settled = false

    const finish = (error: Error | null, result?: ScanResult) => {
      if (settled) return
      settled = true
      socket.destroy()
      if (error) reject(error)
      else resolve(result as ScanResult)
    }
    const settle = (reply: string) => {
      const parsed = parseReply(reply)
      if (parsed instanceof Error) finish(parsed)
      else finish(null, parsed)
    }

    socket.setTimeout(timeoutMs, () => finish(new ScanUnavailableError('clamd không phản hồi')))
    socket.on('error', (error) => finish(new ScanUnavailableError(`Không kết nối được clamd: ${error.message}`)))

    socket.on('connect', () => {
      socket.write('zINSTREAM\0')
      for (let offset = 0; offset < content.length; offset += CHUNK_SIZE) {
        const chunk = content.subarray(offset, offset + CHUNK_SIZE)
        const size = Buffer.alloc(4)
        size.writeUInt32BE(chunk.length)
        socket.write(size)
        socket.write(chunk)
      }
      socket.write(Buffer.alloc(4))
    })

    socket.on('data', (data) => {
      replies.push(data)
      const reply = Buffer.concat(replies).toString('utf8')
      if (reply.includes('\0')) settle(reply.slice(0, reply.indexOf('\0')))
    })

    socket.on('end', () => {
      const reply = Buffer.concat(replies).toString('utf8').replace(/\0/g, '')
      if (reply) settle(reply)
      else finish(new ScanUnavailableError('clamd đóng kết nối không trả kết quả'))
    })
  })
}

function parseReply(reply: string): ScanResult | Error {
  const text = reply.trim()
  if (text.endsWith(' OK')) return { status: 'clean' }
  const found = /^stream: (.+) FOUND$/.exec(text)
  if (found?.[1]) return { status: 'infected', signature: found[1] }
  // Ví dụ "INSTREAM size limit exceeded. ERROR": không kết luận được, giữ PENDING.
  return new ScanUnavailableError(`clamd trả lỗi: ${text.slice(0, 200)}`)
}

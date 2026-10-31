// Chép các file không phải TypeScript mà code đọc lúc chạy (tsc không tự chép) từ src sang dist.
// Chạy sau `tsc` trong script build. Hiện có: src/modules/auth/common-passwords.txt.
import { cpSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const src = fileURLToPath(new URL('../src/', import.meta.url))
const dist = fileURLToPath(new URL('../dist/', import.meta.url))

for (const file of readdirSync(src, { recursive: true, encoding: 'utf8' })) {
  if (!file.endsWith('.txt')) continue
  cpSync(src + file, dist + file)
  console.log(`copied src/${file.replaceAll('\\', '/')}`)
}

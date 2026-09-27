// Sinh docs/erd-core-schema.md từ src/db/schema.prisma. Chạy: pnpm --filter @apc/api db:erd
// Thêm/sửa bảng xong thì chạy lại để sơ đồ luôn khớp database.
import { readFileSync, writeFileSync } from 'node:fs'

const schema = readFileSync(new URL('../src/db/schema.prisma', import.meta.url), 'utf8')
const OUT = new URL('../docs/erd-core-schema.md', import.meta.url)

const enums = new Map() // tên enum -> danh sách giá trị
for (const [, name, body] of schema.matchAll(/^enum (\w+) \{([\s\S]*?)^\}/gm)) {
  enums.set(name, body.split('\n').map((line) => line.trim()).filter((line) => /^\w+$/.test(line)))
}

const models = [...schema.matchAll(/^model (\w+) \{([\s\S]*?)^\}/gm)].map(([, name, body]) => ({
  name,
  table: body.match(/@@map\("(\w+)"\)/)?.[1] ?? name,
  lines: body.split('\n').map((line) => line.trim()),
}))
const tableOf = new Map(models.map((model) => [model.name, model.table]))

const comment = (text) => {
  const clean = text.replaceAll('"', "'")
  return clean.length <= 110 ? clean : `${clean.slice(0, clean.lastIndexOf(' ', 110))}…`
}
const entities = []
const relations = []

for (const model of models) {
  const attributes = []
  const foreignKeys = new Set()
  for (const line of model.lines) {
    const field = line.match(/^(\w+)\s+(\w+)(\[\])?(\?)?\s*(.*)$/)
    if (!field || line.startsWith('@@')) continue
    const [, name, type, isList, isOptional, rest] = field
    const [attrs, note] = rest.split(/\s*\/\/\s*/, 2)

    if (tableOf.has(type)) {
      // Chỉ vẽ phía giữ khóa ngoại; phía mảng/ngược lại bỏ qua để không vẽ trùng.
      const keys = attrs.match(/fields:\s*\[(\w+)\]/)
      if (!keys || isList) continue
      foreignKeys.add(keys[1])
      const fkLine = model.lines.find((l) => l.startsWith(`${keys[1]} `)) ?? ''
      const oneToOne = /@unique/.test(fkLine)
      const parent = isOptional ? '|o' : '||'
      relations.push(`  ${model.table} ${oneToOne ? '|o' : '}o'}--${parent} ${tableOf.get(type)} : "${name}"`)
      continue
    }

    const keys = [/@id\b/.test(attrs) && 'PK', /@unique\b/.test(attrs) && 'UK'].filter(Boolean)
    const detail = [isOptional && 'tùy chọn', enums.has(type) && enums.get(type).join(' / '), note]
      .filter(Boolean)
      .join('. ')
    attributes.push({ type, name, keys, detail })
  }
  for (const attribute of attributes) if (foreignKeys.has(attribute.name)) attribute.keys.push('FK')

  entities.push(
    `  ${model.table} {\n` +
      attributes
        .map(({ type, name, keys, detail }) =>
          `    ${type} ${name}${keys.length ? ` ${keys.join(', ')}` : ''}${detail ? ` "${comment(detail)}"` : ''}`,
        )
        .join('\n') +
      '\n  }',
  )
}

const enumRows = [...enums].map(([name, values]) => `| \`${name}\` | ${values.map((v) => `\`${v}\``).join(', ')} |`)

writeFileSync(
  OUT,
  `# Sơ đồ database (ERD)

> Sinh tự động từ \`src/db/schema.prisma\` bằng \`pnpm --filter @apc/api db:erd\`. Không sửa tay; sửa schema rồi chạy lại lệnh.

Ký hiệu: \`PK\` khóa chính, \`FK\` khóa ngoại, \`UK\` không được trùng. Đường nối: \`||\` bắt buộc đúng 1, \`|o\` 0 hoặc 1, \`}o\` 0 hoặc nhiều.

## Tổng quan

Chỉ có tên bảng và quan hệ, để nhìn nhanh bảng nào nối với bảng nào.

\`\`\`mermaid
erDiagram
${relations.join('\n')}
\`\`\`

## Chi tiết từng bảng

\`\`\`mermaid
erDiagram
${entities.join('\n')}

${relations.join('\n')}
\`\`\`

## Giá trị trạng thái (enum)

| Enum | Giá trị |
| --- | --- |
${enumRows.join('\n')}
`,
)
console.log(`ERD: ${models.length} bảng, ${relations.length} quan hệ, ${enums.size} enum -> docs/erd-core-schema.md`)

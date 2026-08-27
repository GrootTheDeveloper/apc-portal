import { cp, mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const designRoot = path.join(repositoryRoot, 'design-reference', 'homepage')
const sourcePath = path.join(designRoot, 'index.html')
const pageDirectory = path.join(repositoryRoot, 'apps', 'web', 'src', 'pages', 'home')
const publicAssetDirectory = path.join(repositoryRoot, 'apps', 'web', 'public', 'assets', 'home')

const source = await readFile(sourcePath, 'utf8')
const bodyMatch = source.match(/<body[^>]*>([\s\S]*?)<\/body>/i)
const styleMatches = [
  ...source.matchAll(/<style(?![^>]*data-[\w-]+-injected)[^>]*>([\s\S]*?)<\/style>/gi),
]

if (!bodyMatch || styleMatches.length === 0) {
  throw new Error(`Unable to extract the homepage design from ${sourcePath}`)
}

const body = bodyMatch[1]
  .replace(/<script[\s\S]*?<\/script>/gi, '')
  .replace(/<style[\s\S]*?<\/style>/gi, '')
  .replace(
    /<([a-z][\w:-]*)\b[^>]*\bdata-[\w-]+-injected\b[^>]*>[\s\S]*?<\/\1>/gi,
    '',
  )
  .replaceAll('src="assets/', 'src="/assets/home/')
  .trim()
const css = styleMatches.map((match) => match[1].trim()).join('\n\n')

await mkdir(pageDirectory, { recursive: true })
await mkdir(publicAssetDirectory, { recursive: true })
await cp(path.join(designRoot, 'assets'), publicAssetDirectory, { recursive: true })
await writeFile(path.join(pageDirectory, 'home.html'), `${body}\n`)
await writeFile(path.join(pageDirectory, 'home.css'), `${css}\n`)

console.log(`Imported homepage from ${path.relative(repositoryRoot, sourcePath)}`)

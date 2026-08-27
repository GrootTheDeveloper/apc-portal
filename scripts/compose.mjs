import { spawnSync } from 'node:child_process'

const argumentsToForward = process.argv.slice(2)
const candidates = [
  { command: 'docker', prefix: ['compose'] },
  { command: 'docker-compose', prefix: [] },
]

for (const candidate of candidates) {
  const probe = spawnSync(candidate.command, [...candidate.prefix, 'version'], {
    stdio: 'ignore',
    shell: false,
  })

  if (probe.error?.code === 'ENOENT' || probe.status !== 0) continue
  if (probe.error) throw probe.error

  const result = spawnSync(candidate.command, [...candidate.prefix, ...argumentsToForward], {
    stdio: 'inherit',
    shell: false,
  })

  if (result.error) throw result.error
  process.exit(result.status ?? 1)
}

console.error('Docker Compose was not found. Install Docker Desktop, then retry.')
process.exit(1)

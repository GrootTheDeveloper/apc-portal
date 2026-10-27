import { fileURLToPath } from 'node:url'

import { config as loadEnvFile } from 'dotenv'

import { buildApp } from './app.js'
import { loadConfig } from './config.js'
import { startJob, type Job } from './lib/jobs.js'
import { createMailer, processEmailQueue } from './modules/email/service.js'
import { closeExpiredRecruitmentRounds } from './modules/recruitment/service.js'

// .env nằm ở gốc repo (docs/07). Production truyền biến môi trường trực tiếp, không cần file.
loadEnvFile({ path: fileURLToPath(new URL('../../../.env', import.meta.url)), quiet: true })

const config = loadConfig()
const app = buildApp(config)
const jobs: Job[] = []

const shutdown = async (signal: string) => {
  app.log.info({ signal }, 'Shutting down API')
  await Promise.all(jobs.map((job) => job.stop()))
  await app.close()
  process.exit(0)
}

process.once('SIGINT', () => void shutdown('SIGINT'))
process.once('SIGTERM', () => void shutdown('SIGTERM'))

try {
  await app.listen({ host: config.API_HOST, port: config.API_PORT })
  // Tác vụ nền (docs/06 §5 mục 15). Test không chạy server.ts mà gọi thẳng hàm xử lý.
  if (config.NODE_ENV !== 'test') {
    const mailer = createMailer(config)
    jobs.push(startJob('email', 10_000, () => processEmailQueue(mailer, app.log), app.log))
    jobs.push(startJob('round-close', 60_000, () => closeExpiredRecruitmentRounds(), app.log))
  }
} catch (error) {
  app.log.error(error)
  process.exit(1)
}

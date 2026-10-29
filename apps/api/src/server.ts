import { fileURLToPath } from 'node:url'

import { config as loadEnvFile } from 'dotenv'

import { buildApp } from './app.js'
import { loadConfig } from './config.js'
import { startJob, type Job } from './lib/jobs.js'
import { createMailer, processEmailQueue } from './modules/email/service.js'
import { createScanner } from './modules/files/scan.js'
import { rescanPendingFiles } from './modules/files/service.js'
import { createS3Storage } from './modules/files/storage.js'
import { closeExpiredRecruitmentRounds } from './modules/recruitment/service.js'

// .env nằm ở gốc repo (docs/07). Production truyền biến môi trường trực tiếp, không cần file.
loadEnvFile({ path: fileURLToPath(new URL('../../../.env', import.meta.url)), quiet: true })

// Production thiếu FILE_SCAN_MODE=clamav thì loadConfig ném lỗi, API không khởi động (D2).
const config = loadConfig()
const storage = createS3Storage(config)
const app = buildApp(config, { storage })
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
    // Quét lại tệp PENDING do lúc upload clamd không phản hồi (D2).
    if (config.FILE_SCAN_MODE === 'clamav') {
      const files = { storage, scanner: createScanner(config) }
      jobs.push(startJob('file-scan', 60_000, () => rescanPendingFiles(files, app.log), app.log))
    }
  }
} catch (error) {
  app.log.error(error)
  process.exit(1)
}

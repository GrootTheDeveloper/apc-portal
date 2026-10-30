import { z } from 'zod'

const environmentSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_HOST: z.string().default('127.0.0.1'),
  API_PORT: z.coerce.number().int().positive().default(3000),
  WEB_URL: z.url().default('http://localhost:5173'),
  DATABASE_URL: z.string().default('postgresql://apc:apc_local_only@localhost:5432/apc_portal'),
  // Email (docs/06 §5 mục 4): local gửi vào Mailpit, production dùng Brevo. Thiếu SMTP_FROM thì email chuyển FAILED.
  SMTP_HOST: z.string().default('localhost'),
  SMTP_PORT: z.coerce.number().int().positive().default(1025),
  SMTP_SECURE: z.stringbool().default(false),
  SMTP_USER: z.string().default(''),
  SMTP_PASSWORD: z.string().default(''),
  SMTP_FROM: z.string().default(''),
  // Kho tệp qua S3 API (docs/06 §5): local là SeaweedFS, production là Cloudflare R2 (S3_REGION=auto).
  S3_ENDPOINT: z.url().default('http://localhost:9000'),
  S3_ACCESS_KEY: z.string().default('apc_local'),
  S3_SECRET_KEY: z.string().default('apc_local_only'),
  S3_BUCKET: z.string().default('apc-portal'),
  S3_REGION: z.string().default('auto'),
  // Quét mã độc tệp tải lên (SEC-15): `clamav` gửi tới clamd, `skip` coi mọi tệp là sạch (chỉ local/CI).
  FILE_SCAN_MODE: z.enum(['clamav', 'skip']).default('skip'),
  CLAMAV_HOST: z.string().default('127.0.0.1'),
  CLAMAV_PORT: z.coerce.number().int().positive().default(3310),
  // Khóa mã hóa secret TOTP (B3, SEC-16): chuỗi hex 64 ký tự (32 bytes).
  TOTP_ENCRYPTION_KEY: z.string().default('0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'),
}).refine((env) => env.NODE_ENV !== 'production' || env.FILE_SCAN_MODE === 'clamav', {
  // API không khởi động ở production khi chưa bật quét mã độc (D2).
  message: 'Production bắt buộc FILE_SCAN_MODE=clamav.',
  path: ['FILE_SCAN_MODE'],
})

export type AppConfig = z.infer<typeof environmentSchema>

export function loadConfig(environment: NodeJS.ProcessEnv = process.env): AppConfig {
  return environmentSchema.parse(environment)
}

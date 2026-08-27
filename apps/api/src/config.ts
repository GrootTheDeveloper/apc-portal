import { z } from 'zod'

const environmentSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_HOST: z.string().default('127.0.0.1'),
  API_PORT: z.coerce.number().int().positive().default(3000),
  WEB_URL: z.url().default('http://localhost:5173'),
  DATABASE_URL: z.string().default('postgresql://apc:apc_local_only@localhost:5432/apc_portal'),
})

export type AppConfig = z.infer<typeof environmentSchema>

export function loadConfig(environment: NodeJS.ProcessEnv = process.env): AppConfig {
  return environmentSchema.parse(environment)
}

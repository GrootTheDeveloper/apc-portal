import { PrismaClient } from './generated/client.js'

// Một PrismaClient cho cả API. Service import `db` từ đây, không tự tạo PrismaClient mới.
export const db = new PrismaClient()

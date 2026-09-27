import { hash, verify } from '@node-rs/argon2'

// Argon2id với tham số mặc định của thư viện = khuyến nghị OWASP (19 MiB, 2 vòng, 1 luồng) — SEC-02.
// Dùng chung cho đăng nhập (A2), tạo tài khoản (A5, R6) và dữ liệu mẫu (D1).
export const hashPassword = (password: string) => hash(password)

export const verifyPassword = (passwordHash: string, password: string) => verify(passwordHash, password)

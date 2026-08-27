# APC Web Portal

Monorepo local-first cho website và cổng thông tin của Applied Programming Club (APC), Khoa Công Nghệ, UMT.

## Trạng thái hiện tại

- Trang chủ theo bản thiết kế đã duyệt được khởi tạo tại route `/` của React/Vite.
- API Node.js/Fastify có health check tại `/health`.
- PostgreSQL, Mailpit và MinIO chạy local bằng Docker Compose.
- Chưa có VPS, staging hoặc production. Các quyết định triển khai thật vẫn để mở.

## Bắt đầu nhanh

Yêu cầu: Git, Node.js 22+, pnpm 10 và Docker Desktop.

```powershell
corepack enable
pnpm install
Copy-Item .env.example .env
pnpm infra:up
pnpm dev
```

| Thành phần | URL local |
| --- | --- |
| Website | http://localhost:5173 |
| API health | http://localhost:3000/health |
| Mailpit | http://localhost:8025 |
| MinIO Console | http://localhost:9001 |

## Lệnh chính

```powershell
pnpm dev          # chạy web và API
pnpm check        # lint, type-check, test và build
pnpm infra:up     # bật PostgreSQL, Mailpit, MinIO
pnpm infra:down   # tắt hạ tầng local
pnpm infra:logs   # xem log hạ tầng
pnpm homepage:import # nhập lại bản thiết kế đã chốt
```

Không commit `.env`, dữ liệu volume Docker, `node_modules` hoặc thư mục build.

## Tài liệu

Bắt đầu tại [docs/README.md](./docs/README.md). Quy trình cài đặt chi tiết nằm trong [docs/07-local-development.md](./docs/07-local-development.md).

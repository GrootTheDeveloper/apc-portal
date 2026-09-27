# APC Portal

Monorepo local-first cho website và cổng thông tin của Applied Programming Club (APC), Khoa Công Nghệ, UMT.

## Trạng thái hiện tại

- Trang chủ theo bản thiết kế đã duyệt được khởi tạo tại route `/` của React/Vite.
- API Node.js/Fastify có health check tại `/health`.
- PostgreSQL, Mailpit và SeaweedFS (lưu tệp qua S3 API) chạy local bằng Docker Compose.
- Chưa dựng VPS, staging hoặc production; phương án đã chốt tại [docs/06-architecture.md](./docs/06-architecture.md) mục 5.

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
| Kho tệp – giao diện quản trị | http://localhost:9001 |

## Lệnh chính

```powershell
pnpm dev          # chạy web và API
pnpm check        # lint, type-check, test và build
pnpm infra:up     # bật PostgreSQL, Mailpit, SeaweedFS
pnpm infra:down   # tắt hạ tầng local
pnpm infra:logs   # xem log hạ tầng
pnpm homepage:import # nhập lại bản thiết kế đã chốt
```

Không commit `.env`, dữ liệu volume Docker, `node_modules` hoặc thư mục build.

## Tài liệu

Thành viên mới: đọc [docs/plan/bat-dau.md](./docs/plan/bat-dau.md) (cài máy, làm việc, mở PR). Tài liệu nghiệp vụ bắt đầu tại [docs/README.md](./docs/README.md). Quy trình cài đặt chi tiết nằm trong [docs/07-local-development.md](./docs/07-local-development.md).

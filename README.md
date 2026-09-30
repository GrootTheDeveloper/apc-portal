# APC Portal

Monorepo local-first cho website và cổng thông tin của Applied Programming Club (APC), Khoa Công Nghệ, UMT.

## Trạng thái hiện tại

- Trang chủ theo bản thiết kế đã duyệt được khởi tạo tại route `/` của React/Vite.
- API Node.js/Fastify có health check tại `/health`.
- PostgreSQL, Mailpit và SeaweedFS (lưu tệp qua S3 API) chạy local bằng Docker Compose.
- Chưa dựng VPS, staging hoặc production; phương án đã chốt tại [docs/06-architecture.md](./docs/06-architecture.md) mục 5.

## Bắt đầu nhanh

Máy chưa có Git, Node.js 22, pnpm hoặc Docker Desktop: cài theo [docs/07-local-development.md](./docs/07-local-development.md) (hướng dẫn từng bước cho Windows và macOS, kèm bảng xử lý lỗi).

Máy đã có đủ công cụ và Docker Desktop đang chạy:

```powershell
git clone https://github.com/GrootTheDeveloper/apc-portal.git
Set-Location apc-portal
Copy-Item .env.example .env
pnpm install
pnpm infra:up
pnpm --filter @apc/api db:migrate
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

| Cần | Đọc |
| --- | --- |
| Thành viên mới vào nhóm | [docs/plan/bat-dau.md](./docs/plan/bat-dau.md) — khái niệm, cách làm một việc, mở PR, review |
| Cài đặt và xử lý lỗi cài đặt | [docs/07-local-development.md](./docs/07-local-development.md) |
| Phân công, lịch, phiếu việc | [docs/plan/README.md](./docs/plan/README.md) |
| Quy ước viết code | [AGENTS.md](./AGENTS.md) |
| Tài liệu nghiệp vụ | [docs/README.md](./docs/README.md) |

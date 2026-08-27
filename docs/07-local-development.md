# APC Portal - Phát triển local

| Thuộc tính | Giá trị |
| --- | --- |
| Phiên bản | 1.0 |
| Trạng thái | Đã áp dụng |
| Ngày cập nhật | 27/08/2026 |

## 1. Yêu cầu

- Git.
- Node.js 22 trở lên; repository ghim major trong `.node-version`.
- pnpm 10 qua Corepack.
- Docker Desktop có Docker Compose.

## 2. Cài lần đầu

```powershell
git clone <repository-url>
Set-Location apc-web-portal
corepack enable
pnpm install
Copy-Item .env.example .env
pnpm infra:up
pnpm dev
```

`pnpm infra:up` tự thử cả lệnh `docker compose` và `docker-compose` để tương thích máy thành viên.

## 3. URL local

| Dịch vụ | URL/cổng |
| --- | --- |
| Web | http://localhost:5173 |
| API | http://localhost:3000 |
| API health | http://localhost:3000/health |
| PostgreSQL | localhost:5432 |
| Mailpit UI | http://localhost:8025 |
| Mailpit SMTP | localhost:1025 |
| MinIO API | http://localhost:9000 |
| MinIO Console | http://localhost:9001 |

## 4. Quy trình hằng ngày

```powershell
pnpm infra:up
pnpm dev
```

Trước khi mở pull request:

```powershell
pnpm check
```

Khi kết thúc:

```powershell
pnpm infra:down
```

Lệnh `infra:down` không xóa volume. Không dùng `down -v` nếu chưa chủ động chấp nhận xóa dữ liệu local.

## 5. Cập nhật trang chủ

Trang chủ hiện là các component React tại `apps/web/src/pages/home` (xem [06-architecture](06-architecture.md) mục 3), **không còn dùng file HTML import**. Muốn sửa nội dung/giao diện, chỉnh trực tiếp component tương ứng trong `sections/`, rồi chạy `pnpm check` và kiểm tra trực quan trang `/`.

Script `pnpm homepage:import` chỉ dùng khi cần **làm mới asset tham chiếu** từ `design-reference/homepage`; nó không nối vào giao diện đang chạy.

## 6. Xử lý lỗi thường gặp

- Không tìm thấy Compose: mở Docker Desktop, kiểm tra `docker compose version` hoặc `docker-compose version`.
- Cổng 5432/9000 bị chiếm: dừng dịch vụ trùng cổng hoặc đổi mapping và cập nhật `.env`.
- Font/icon không hiện khi mất mạng: giao diện vẫn dùng font hệ thống; Material Symbols hiện cần kết nối Google Fonts.
- Trang chủ lệch: kiểm tra token Tailwind trong `apps/web/tailwind.config.cjs`.

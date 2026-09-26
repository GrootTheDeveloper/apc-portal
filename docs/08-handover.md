# APC Portal - Checklist bàn giao

| Thuộc tính | Giá trị |
| --- | --- |
| Phiên bản | 1.1 |
| Trạng thái | Đã duyệt (27/09/2026) |
| Ngày cập nhật | 27/09/2026 |

## 1. Repository

- [ ] Repository thuộc tài khoản/tổ chức do APC kiểm soát.
- [ ] Có ít nhất hai maintainer thuộc hai người khác nhau.
- [x] Nhánh chính được bảo vệ và thay đổi đi qua pull request.
- [ ] Không có secret, `.env`, dữ liệu cá nhân hoặc file build trong Git.
- [ ] `pnpm check` chạy thành công trên máy khác.

## 2. Sản phẩm và thiết kế

- [x] APC xác nhận nội dung, hình ảnh và logo được phép công bố (05/09/2026).
- [ ] Nội dung mẫu, chỉ số CLB và ô đối tác placeholder chưa bị hiểu là dữ liệu thật.
- [x] APC **duyệt lại giao diện trang chủ bản redesign hiện tại** — đã khác bản tham chiếu ban đầu (hero 50:50 + chỉ số CLB, bộ màu brand đỏ/vàng/xanh, dải seam gradient giữa các section) — ở kích thước laptop/desktop.
- [ ] Mỗi route triển khai có mapping tới Sitemap và User Flow.

## 3. Local development

- [ ] Thành viên mới chạy được dự án chỉ bằng README trong tối đa 15 phút.
- [ ] PostgreSQL, Mailpit và SeaweedFS khởi động bằng Compose.
- [ ] API health trả về HTTP 200.
- [ ] Có hướng dẫn xử lý cổng trùng và giữ/xóa volume.

## 4. Tài liệu cần người phụ trách ký nhận

- [x] Charter và phạm vi MVP (27/09/2026).
- [x] PRD và danh mục chức năng ưu tiên (27/09/2026).
- [x] Vai trò/quyền và chủ sở hữu dữ liệu (27/09/2026).
- [x] User Flow và Sitemap (27/09/2026).
- [x] Kiến trúc và các quyết định kỹ thuật đã chốt (27/09/2026).

## 5. Chưa thuộc lần bàn giao local

VPS, domain, TLS, credential production, backup/restore thật, monitoring và quy trình incident chỉ được bàn giao sau khi dựng hạ tầng theo [Kiến trúc mục 5](./06-architecture.md) và hoàn tất kiểm thử tương ứng.

## 6. Bằng chứng tại lần khởi tạo 27/08/2026

- `pnpm check`: đạt lint, type-check, 1 API test và production build cho web/API.
- `GET /health`: trả HTTP 200 khi API chạy local.
- Trang chủ: hiển thị đủ 9 section, 12 ảnh tải thành công, không tràn ngang tại viewport 1440x900 và không có console warning/error.
- `docker compose config`: hợp lệ.
- PostgreSQL, Mailpit và SeaweedFS: đã khởi động bằng Compose, đều báo healthy; PostgreSQL nhận kết nối, Mailpit trả 200, SeaweedFS upload/tải tệp qua S3 API thành công (27/09/2026).

# APC Portal - Checklist bàn giao

| Thuộc tính | Giá trị |
| --- | --- |
| Phiên bản | 1.0 |
| Trạng thái | Bản thảo |
| Ngày cập nhật | 27/08/2026 |

## 1. Repository

- [ ] Repository thuộc tài khoản/tổ chức do APC kiểm soát.
- [ ] Có ít nhất hai maintainer thuộc hai người khác nhau.
- [ ] Nhánh chính được bảo vệ và thay đổi đi qua pull request.
- [ ] Không có secret, `.env`, dữ liệu cá nhân hoặc file build trong Git.
- [ ] `pnpm check` chạy thành công trên máy khác.

## 2. Sản phẩm và thiết kế

- [ ] APC xác nhận nội dung, hình ảnh và logo được phép công bố.
- [ ] Nội dung mẫu, chỉ số CLB và ô đối tác placeholder chưa bị hiểu là dữ liệu thật.
- [ ] APC **duyệt lại giao diện trang chủ bản redesign hiện tại** — đã khác bản tham chiếu ban đầu (hero 50:50 + chỉ số CLB, bộ màu brand đỏ/vàng/xanh, dải seam gradient giữa các section) — ở kích thước laptop/desktop.
- [ ] Mỗi route triển khai có mapping tới Sitemap và User Flow.

## 3. Local development

- [ ] Thành viên mới chạy được dự án chỉ bằng README trong tối đa 15 phút.
- [ ] PostgreSQL, Mailpit và MinIO khởi động bằng Compose.
- [ ] API health trả về HTTP 200.
- [ ] Có hướng dẫn xử lý cổng trùng và giữ/xóa volume.

## 4. Tài liệu cần người phụ trách ký nhận

- [ ] Charter và phạm vi MVP.
- [ ] PRD và danh mục chức năng ưu tiên.
- [ ] Vai trò/quyền và chủ sở hữu dữ liệu.
- [ ] User Flow và Sitemap.
- [ ] Kiến trúc local và các quyết định production còn mở.

## 5. Chưa thuộc lần bàn giao local

VPS, domain, TLS, credential production, backup/restore thật, monitoring và quy trình incident chỉ được bàn giao sau khi APC chọn hạ tầng và hoàn tất kiểm thử tương ứng.

## 6. Bằng chứng tại lần khởi tạo 27/08/2026

- `pnpm check`: đạt lint, type-check, 1 API test và production build cho web/API.
- `GET /health`: trả HTTP 200 khi API chạy local.
- Trang chủ: hiển thị đủ 9 section, 12 ảnh tải thành công, không tràn ngang tại viewport 1440x900 và không có console warning/error.
- `docker compose config`: hợp lệ.
- PostgreSQL, Mailpit và MinIO: đã khởi động bằng Compose, đều báo healthy; PostgreSQL nhận kết nối và HTTP health của Mailpit/MinIO trả 200.

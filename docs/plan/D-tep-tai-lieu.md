# Dữ liệu mẫu, tệp, tài liệu, tìm kiếm — Phạm Đăng Hoàng Thiên

Làm cả API lẫn giao diện.

### Giai đoạn 1 (05/10 – 11/10)
**D1. Dữ liệu mẫu.** Viết lệnh `pnpm --filter @apc/api db:seed` tạo tài khoản mẫu cho 4 vai trò, vài ban, vài bài viết, sự kiện, dự án. Mật khẩu băm bằng `hashPassword` trong `src/lib/password.ts`.
Xong khi: chạy 2 lần liền không lỗi và không bị trùng dữ liệu. Làm xong nhắn cả nhóm.

**D2. Upload tệp.** Làm chức năng upload ảnh/tệp qua S3 API (local là SeaweedFS ở `localhost:9000`) cho cả nhóm dùng chung. Được cài `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`, `@fastify/multipart`, `file-type`.
Xong khi: file thực thi hoặc file lớn hơn 20 MB bị từ chối; kiểm tra cả nội dung file, không chỉ đuôi file.

### Giai đoạn 2 (12/10 – 01/11)
**D3. Tìm kiếm.** Làm trang `/search`: tìm theo tiêu đề trong tin tức, sự kiện, dự án đã công bố.

### Giai đoạn 3 (02/11 – 22/11)
**D4. Thư viện tài liệu.** Làm `/admin/documents` để đăng tài liệu nội bộ và `/portal/documents` để thành viên xem, tải.
Xong khi: người không có quyền không tải được dù có link; thay tệp mới vẫn giữ được bản cũ.

### Lưu ý
- Mật khẩu tài khoản mẫu đọc từ biến `SEED_PASSWORD` trong `.env` (đã có trong `.env.example`).
- Dữ liệu mẫu dùng thông tin giả, ví dụ `thanhvien1@example.com`.
- Tài liệu nội bộ kiểm tra quyền ngay lúc tải.

### Tài liệu
- [PRD](../01-prd.md): mục 7.8
- [User flow](../03-user-flows.md): FLOW-19
- [Sitemap](../04-sitemap.md): mục 7.2, 8.7

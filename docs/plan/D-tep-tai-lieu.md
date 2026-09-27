# Dữ liệu mẫu, tệp, tài liệu, tìm kiếm, nhập CSV — Phạm Đăng Hoàng Thiên

Làm cả API lẫn giao diện. Làm lần lượt từ trên xuống, hạn ghi ngay cạnh tên việc. Mỗi việc là 1 nhánh và 1 PR; mở PR xong là sang việc sau được, trừ khi việc sau cần code của việc trước thì chờ PR đó merge.

### Giai đoạn 1 (05/10 – 11/10)
#### D1. Dữ liệu mẫu — hạn T5 08/10
Viết lệnh `pnpm --filter @apc/api db:seed` tạo tài khoản mẫu cho 4 vai trò, vài ban, vài bài viết, sự kiện, dự án. Mật khẩu băm bằng `hashPassword` trong `src/lib/password.ts`.

**Xong khi:** chạy 2 lần liền không lỗi và không bị trùng dữ liệu. Làm xong nhắn cả nhóm.

#### D2. Upload tệp — hạn CN 11/10
Làm chức năng upload ảnh/tệp qua S3 API (local là SeaweedFS ở `localhost:9000`) cho cả nhóm dùng chung. Được cài `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`, `@fastify/multipart`, `file-type`.

**Xong khi:** file thực thi hoặc file lớn hơn 20 MB bị từ chối; kiểm tra cả nội dung file, không chỉ đuôi file.

### Giai đoạn 2 (12/10 – 01/11)
#### D3. Tìm kiếm — hạn CN 01/11
Làm trang `/search`: tìm theo tiêu đề trong tin tức, sự kiện, dự án đã công bố.

### Giai đoạn 3 (02/11 – 22/11)
#### D4. Thư viện tài liệu — hạn T5 12/11
Làm `/admin/documents` để đăng tài liệu nội bộ và `/portal/documents` để thành viên xem, tải.

**Xong khi:** người không có quyền không tải được dù có link; thay tệp mới vẫn giữ được bản cũ.

#### D5. Nhập/xuất CSV thành viên — hạn CN 22/11
Làm trang `/admin/members/import`: `BOARD` tải file CSV lên, xem trước kết quả kiểm tra rồi mới nhập. Làm API xuất danh sách thành viên ra CSV; nút "Xuất CSV" đặt trên trang `/admin/members` của Lương Huỳnh (T5, hạn 15/11), gắn sau khi T5 merge. Được cài `csv-parse`, `csv-stringify`.

**Xong khi:** file có 1 dòng lỗi thì báo đúng dòng, đúng cột và không nhập dòng nào; chỉ `BOARD` nhập/xuất được; thao tác nhập/xuất được ghi `audit(...)`.

### Lưu ý
- Mật khẩu tài khoản mẫu đọc từ biến `SEED_PASSWORD` trong `.env` (đã có trong `.env.example`).
- Dữ liệu mẫu dùng thông tin giả, ví dụ `thanhvien1@example.com`.
- Tài liệu nội bộ kiểm tra quyền ngay lúc tải.
- File CSV mẫu chỉ dùng dữ liệu giả.

### Tài liệu
- [PRD](../01-prd.md): mục 7.8, MEM-08 (nhập CSV)
- [User flow](../03-user-flows.md): FLOW-19, FLOW-25
- [Sitemap](../04-sitemap.md): mục 7.2, 8.3 (`PAGE-MGT-MEM-03`), 8.7

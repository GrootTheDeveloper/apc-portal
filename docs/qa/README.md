# Hướng dẫn Kiểm thử & Kịch bản (QA)

## 1. Chuẩn bị trước khi chạy
- Khởi động hạ tầng: pnpm infra:up
- Xóa dữ liệu cũ và nạp dữ liệu mẫu: pnpm --filter @apc/api exec prisma migrate reset
- Chạy ứng dụng: pnpm dev

## 2. Bảng tài khoản mẫu
| Vai trò / Trạng thái | Tên đăng nhập (Email) | Mật khẩu mẫu | Ghi chú |
| --- | --- | --- | --- |
| Admin hệ thống | admin@example.com | `Password123!` | Toàn quyền quản trị hệ thống |
| Ban quản trị (Board) | board.active@example.com | `Password123!` | Quản lý sự kiện, bài viết, đơn tuyển |
| Thành viên (Member) | member.a@example.com | `Password123!` | Thành viên CLB bình thường |
| Chờ duyệt (Pending) | member.pending@example.com | `Password123!` | Tài khoản đang chờ duyệt / kích hoạt |
| Khóa / Inactive | member.locked@example.com | `Password123!` | Tài khoản bị khóa / không hoạt động |

## 3. Cách báo lỗi
- Tạo GitHub Issue mới tại tab **Issues** của repository với tiêu đề kèm mã kịch bản (ví dụ: [KB-02-03] Mô tả lỗi).
- Gắn nhãn **bug** và assign đúng người phụ trách mảng.
- Lỗi bảo mật tuyệt đối **không** mở Issue công khai mà nhắn trực tiếp cho trưởng dự án.

## 4. Mục lục các file kịch bản
- [01 - Trang công khai](./01-cong-khai.md)
- [02 - Tuyển thành viên](./02-tuyen-thanh-vien.md)
- [03 - Đăng ký sự kiện](./03-dang-ky-su-kien.md)
- [04 - Đăng nhập & Xác thực](./04-dang-nhap.md)
- [05 - Email & Tệp đính kèm](./05-email-tep.md)
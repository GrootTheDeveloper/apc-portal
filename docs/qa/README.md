# Hướng dẫn Kiểm thử & Kịch bản (QA)

## 1. Chuẩn bị trước khi chạy
- Khởi động hạ tầng: pnpm infra:up
- Xóa dữ liệu cũ và nạp dữ liệu mẫu: pnpm --filter @apc/api exec prisma migrate reset
- Chạy ứng dụng: pnpm dev

## 2. Bảng tài khoản mẫu
Dữ liệu mẫu tạo bởi seed (D1). Đăng nhập bằng **tên đăng nhập**, không dùng email. Mật khẩu chung của mọi tài khoản là giá trị `SEED_PASSWORD` trong file `.env` ở gốc repo.

| Tên đăng nhập | Vai trò | Trạng thái | Ban | Ghi chú |
| --- | --- | --- | --- | --- |
| `board` | `BOARD` | `ACTIVE` | — | Ban Chủ nhiệm |
| `techadmin` | `TECH_ADMIN` | `ACTIVE` | — | Quản trị hệ thống |
| `board.pending` | `BOARD` | `ACTIVE` | — | Vai trò `PENDING`, chưa thiết lập 2 lớp |
| `manager.a` | `DEPARTMENT_MANAGER` | `ACTIVE` | Ban A | Trưởng ban A |
| `manager.b` | `DEPARTMENT_MANAGER` | `ACTIVE` | Ban B | Trưởng ban B |
| `member.a` | `MEMBER` | `ACTIVE` | Ban A | Thành viên ban A |
| `member.b` | `MEMBER` | `ACTIVE` | Ban B | Thành viên ban B |
| `pending` | `MEMBER` | `PENDING_ACTIVATION` | Ban A | Chờ kích hoạt, phải đổi mật khẩu |
| `locked` | `MEMBER` | `LOCKED` | Ban A | Đã bị khóa |
| `inactive` | `MEMBER` | `INACTIVE` | Ban A | Đã rời CLB |

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

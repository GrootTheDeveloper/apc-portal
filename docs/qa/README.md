# Hướng dẫn Kiểm thử & Kịch bản (QA)

## 1. Chuẩn bị trước khi chạy
- Khởi động hạ tầng: pnpm infra:up
- Xóa dữ liệu cũ và nạp dữ liệu mẫu: pnpm --filter @apc/api exec prisma migrate reset
- Chạy ứng dụng: pnpm dev

## 2. Bảng tài khoản mẫu
*(Tham khảo thông tin tài khoản mẫu từ phiếu D - mục D1)*

## 3. Cách báo lỗi
- Tạo GitHub Issue mới tại tab **Issues** của repository với tiêu đề kèm mã kịch bản (ví dụ: [KB-02-03] Mô tả lỗi).
- Gắn nhãn ug và assign đúng người phụ trách mảng.
- Lỗi bảo mật tuyệt đối **không** mở Issue công khai mà nhắn trực tiếp cho trưởng dự án.

## 4. Mục lục các file kịch bản
- [01 - Trang công khai](./01-cong-khai.md)
- [02 - Tuyển thành viên](./02-tuyen-thanh-vien.md)
- [03 - Đăng ký sự kiện](./03-dang-ky-su-kien.md)
- [04 - Đăng nhập & Xác thực](./04-dang-nhap.md)
- [05 - Email & Tệp đính kèm](./05-email-tep.md)

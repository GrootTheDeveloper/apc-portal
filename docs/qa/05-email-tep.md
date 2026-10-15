# Kịch bản kiểm tra: Email & Tệp đính kèm (05-email-tep)

## Danh sách kịch bản

### KB-05-01. Kiểm tra email xác nhận qua Mailpit
- Chức năng: O1, O2 · Luồng: FLOW-20 · Nghiệm thu: AC-02
- Tài khoản: không đăng nhập
- Chuẩn bị: hạ tầng Mailpit đang chạy (pnpm infra:up)

| # | Thao tác | Kết quả phải thấy |
| --- | --- | --- |
| 1 | Thực hiện một hành động kích hoạt gửi email (ví dụ: đăng ký tài khoản hoặc nộp đơn) | Hệ thống ghi nhận và gửi email đi |
| 2 | Mở giao diện Mailpit (thường tại http://localhost:8025) | Nhận được email xác nhận với đúng nội dung, tiêu đề và liên kết |

| Ngày chạy | Người chạy | Kết quả | Issue |
| --- | --- | --- | --- |
| | | | |

---

### KB-05-02. Xử lý khi Mailpit bị tắt (Hệ thống không bị treo)
- Chức năng: O1, O2
- Chuẩn bị: tắt container Mailpit bằng lệnh docker stop apc-portal-local-mailpit-1

| # | Thao tác | Kết quả phải thấy |
| --- | --- | --- |
| 1 | Thực hiện hành động nộp đơn hoặc đăng ký khi Mailpit đang tắt | Dữ liệu đơn/đăng ký vẫn được lưu thành công vào database, màn hình vẫn hiển thị mã hồ sơ thành công, hệ thống không bị lỗi crash 500 |
| 2 | Khởi động lại Mailpit bằng pnpm infra:up | Hạ tầng Mailpit hoạt động trở lại bình thường |

| Ngày chạy | Người chạy | Kết quả | Issue |
| --- | --- | --- | --- |
| | | | |

---

### KB-05-03. Upload tệp đính kèm hợp lệ
- Chức năng: D2 · Nghiệm thu: AC-02
- Chuẩn bị: chuẩn bị một tệp định dạng cho phép (ví dụ .png, .pdf) có dung lượng dưới 20 MB

| # | Thao tác | Kết quả phải thấy |
| --- | --- | --- |
| 1 | Tại form có chức năng tải tệp lên, chọn tệp hợp lệ và bấm gửi | Tệp được tải lên thành công, hệ thống chấp nhận |

| Ngày chạy | Người chạy | Kết quả | Issue |
| --- | --- | --- | --- |
| | | | |

---

### KB-05-04. Từ chối tệp đính kèm không hợp lệ (Đổi đuôi file hoặc quá dung lượng)
- Chức năng: D2 · Nghiệm thu: AC-02

| # | Thao tác | Kết quả phải thấy |
| --- | --- | --- |
| 1 | Cố gắng upload tệp .exe nhưng đổi đuôi thành .png | Hệ thống kiểm tra nội dung/định dạng thực tế và từ chối tải lên, hiện thông báo lỗi |
| 2 | Cố gắng upload tệp có dung lượng lớn hơn 20 MB | Bị hệ thống từ chối ngay lập tức kèm thông báo lỗi vượt quá kích thước cho phép |

| Ngày chạy | Người chạy | Kết quả | Issue |
| --- | --- | --- | --- |
| | | | |

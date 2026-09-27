# Email & máy chủ — Đặng Phúc An Khang

Làm lần lượt từ trên xuống, hạn ghi ngay cạnh tên việc. Mỗi việc là 1 nhánh và 1 PR; mở PR xong là sang việc sau được, trừ khi việc sau cần code của việc trước thì chờ PR đó merge.

### Giai đoạn 1 (05/10 – 11/10)
#### O1. Gửi email — hạn CN 11/10
Viết hàm dùng chung `enqueueEmail(...)`: lưu email vào bảng `NotificationDelivery`, gửi sau bằng `nodemailer`. Khi chạy local, email vào Mailpit (`localhost:8025`).

**Xong khi:** tắt Mailpit thì email được thử gửi lại vài lần rồi báo lỗi, còn việc chính (nộp đơn, đăng ký) vẫn thành công. Làm xong nhắn Khương (R3) và Nghĩa (E3) cách dùng.

### Giai đoạn 2 (12/10 – 01/11)
#### O2. Mẫu email — hạn CN 01/11
Làm khung email và 2 mẫu: xác nhận nộp đơn tuyển, xác nhận đăng ký sự kiện.

### Giai đoạn 3 (02/11 – 22/11)
#### O3. Trang theo dõi email — hạn CN 22/11
Làm `/admin/email-deliveries`: xem trạng thái (Chờ gửi / Đang gửi / Chờ thử lại / Đã gửi / Gửi lỗi), bấm gửi lại.

**Xong khi:** Quản lý ban chỉ xem email của ban mình; chỉ `BOARD` bấm gửi lại được.

### Sau này (23/11 – 29/11)
#### O4. Máy chủ thật — hạn T5 26/11
Dựng VPS, Nginx, HTTPS, deploy từ GitHub Actions theo [Kiến trúc](../06-architecture.md) mục 5.

#### O5. Sao lưu & theo dõi — hạn CN 29/11
Sao lưu hằng ngày lên Cloudflare R2, thử khôi phục lại một lần; cài UptimeRobot và Netdata.

### Lưu ý
- Gửi email lỗi không được làm hỏng việc chính.
- Không gửi mật khẩu hay mã bảo mật qua email.
- Lưu hàng đợi email trong database, không cài thêm Redis. Production gửi qua Brevo (SMTP).

### Tài liệu
- [PRD](../01-prd.md): mục 7.11
- [User flow](../03-user-flows.md): FLOW-26
- [Sitemap](../04-sitemap.md): mục 8.9

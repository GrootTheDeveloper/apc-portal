# Sự kiện — Lê Đăng Nghĩa

Làm cả API lẫn giao diện.

### Giai đoạn 1
**E1. Trang Sự kiện.** Làm `/events` và `/events/[slug]` với dữ liệu giả. Dùng lại mẫu của `EventsSection` ở trang chủ.
Xong khi: phân biệt rõ sự kiện sắp diễn ra, đã hủy, đã kết thúc.

### Giai đoạn 2
**E2. Nối dữ liệu thật.** Thêm bảng đăng ký sự kiện (`EventRegistration`). Viết API trả các sự kiện đã công bố và cho trang lấy dữ liệu từ đó.

**E3. Khách đăng ký.** Làm form đăng ký ở `/events/[slug]/register` gồm họ tên, email, MSSV và ô đồng ý xử lý dữ liệu. Đăng ký xong nhận mã đăng ký và email xác nhận. Làm trang `/events/registration-lookup` (route tạm đã có) để tra cứu/hủy bằng email + mã. Giới hạn tần suất bằng `@fastify/rate-limit`.
Xong khi: đăng ký trùng, hết chỗ hoặc quá hạn đều bị chặn, có thông báo rõ.

### Giai đoạn 3
**E4. Quản trị sự kiện.** Làm `/admin/events`: tạo, sửa, công bố, hủy, lưu trữ sự kiện.
Xong khi: Quản lý ban chỉ công bố được sự kiện nội bộ của ban mình; sự kiện công khai hoặc toàn câu lạc bộ do `BOARD` công bố.

**E5. Thành viên đăng ký.** Làm `/portal/events` cho thành viên đăng ký sự kiện nội bộ.

**E6. Danh sách & điểm danh.** Xem danh sách đăng ký, xuất CSV, điểm danh (Chưa điểm danh / Có mặt / Vắng có phép / Vắng mặt).
Xong khi: buổi đã điểm danh hiện trong lịch sử hoạt động của thành viên (trang T3 của Lương Huỳnh).

### Lưu ý
- Chỉ nhận đăng ký khi sự kiện ở trạng thái Đã công bố và còn hạn.
- Kiểm tra số chỗ ở server, trong cùng transaction với lúc lưu đăng ký.
- Chưa tick ô đồng ý thì không gửi được form.
- Tra cứu sai chỉ báo lỗi chung, không cho biết email có tồn tại hay không.
- Gửi email lỗi thì lượt đăng ký vẫn được lưu.
- Lưu ô đồng ý bằng `recordConsent(...)` của Minh (B2); email xác nhận bằng `enqueueEmail(...)` của An Khang (O1).
- Xuất CSV (E6) dùng `csv-stringify`.

### Tài liệu
- [PRD](../01-prd.md): mục 7.5
- [User flow](../03-user-flows.md): FLOW-14, 15, 16
- [Sitemap](../04-sitemap.md): mục 5.2, 8.4

# Tuyển thành viên — Phan Anh Khương

Làm cả API lẫn giao diện.

### Giai đoạn 1
**R1. Trang tuyển thành viên.** Làm `/recruitment` và `/recruitment/[slug]` với dữ liệu giả.
Xong khi: đợt tuyển chưa mở hoặc đã đóng không có nút "Ứng tuyển".

### Giai đoạn 2
**R2. Tạo đợt tuyển.** Ban Chủ nhiệm tạo đợt tuyển và thêm câu hỏi: trả lời ngắn, trả lời dài, chọn một, chọn nhiều. Câu hỏi lưu trong cột JSON `questions` của `RecruitmentRound`, không tạo bảng riêng. Mỗi câu có `id` cố định, `type`, `label`, `required`, `options`, `hidden`; câu trả lời trong đơn (`answers`) lưu theo `id` câu hỏi.
Xong khi: đợt đã có đơn thì không đổi kiểu hoặc xóa được câu hỏi đã có câu trả lời, chỉ ẩn được (REC-15).

**R3. Nộp đơn.** Làm form nhiều bước ở `/recruitment/[slug]/apply`, có ô đồng ý xử lý dữ liệu. Nộp xong nhận mã hồ sơ và email xác nhận (`enqueueEmail` của An Khang). Lưu ô đồng ý bằng `recordConsent(...)` của Minh (B2). Giới hạn tần suất bằng `@fastify/rate-limit`.
Xong khi: cùng email hoặc MSSV không nộp được 2 đơn trong một đợt.

**R4. Tra cứu / rút đơn.** Làm `/recruitment/application-lookup` (route tạm đã có): nhập email + mã hồ sơ để xem trạng thái, rút đơn khi chưa có kết quả. Tra cứu sai chỉ báo lỗi chung và bị giới hạn tần suất.

### Giai đoạn 3
**R5. Xét hồ sơ.** Làm `/admin/recruitment`: lọc hồ sơ, đổi trạng thái (Mới → Đang xét → Mời phỏng vấn → Đã chấp nhận / Không chấp nhận), ghi chú, xuất CSV.
Xong khi: Quản lý ban chỉ thấy hồ sơ nộp vào ban mình; chỉ `BOARD` chốt Đã chấp nhận / Không chấp nhận.

**R6. Chuyển thành thành viên.** Hồ sơ Đã chấp nhận có nút tạo tài khoản thành viên từ thông tin trong đơn. Mật khẩu tạm băm bằng `hashPassword` và hiển thị một lần cho `BOARD`, không gửi email. Xuất CSV (R5) dùng `csv-stringify`.

### Lưu ý
- Một email hoặc một MSSV chỉ có 1 đơn trong mỗi đợt. Đặt ràng buộc unique trong database.
- Mã hồ sơ sinh ngẫu nhiên, không đánh số tăng dần.
- Ghi chú của người xét không hiện cho ứng viên, kể cả trong API tra cứu.
- Thành viên đã đăng nhập không nộp đơn được.

### Tài liệu
- [PRD](../01-prd.md): mục 7.2
- [User flow](../03-user-flows.md): FLOW-03 đến FLOW-08
- [Sitemap](../04-sitemap.md): mục 5.2, 8.2

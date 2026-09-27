# Kiểm thử & nội dung — Nguyễn Tiến Bảo

### Giai đoạn 1 (05/10 – 11/10)
**Q1. Kịch bản kiểm tra.** Viết kịch bản cho giai đoạn 1 và 2 trong `docs/qa/`, mỗi bước dạng: tài khoản → thao tác → kết quả phải thấy.
Xong khi: người không biết code cũng làm theo được.

### Giai đoạn 2 (12/10 – 01/11)
**Q2. Test tự động.** Viết test tự động cho các luồng: xem tin, nộp đơn tuyển, tra cứu đơn. Dùng `@playwright/test`.

### Giai đoạn 3 (02/11 – 22/11)
**Q3. Kiểm tra phần quản trị.** Viết kịch bản và test tự động cho đăng nhập, công bố bài viết, xét hồ sơ.

**Q4. Nội dung thật.** Gom bài viết, dự án, số liệu CLB thật từ các ban và nhập qua trang quản trị.

### Liên tục (đến 29/11)
**Q5. Cập nhật tài liệu.** Có trang mới hoặc thay đổi lớn thì cập nhật `docs/`.

### Lưu ý
- Mỗi kịch bản có cả trường hợp bị chặn, ví dụ `MEMBER` mở `/admin`, Quản lý ban mở dữ liệu ban khác.
- Chỉ test bằng dữ liệu giả.
- Nội dung, logo đối tác chưa được APC cho phép thì không đưa lên.

### Tài liệu
- [PRD](../01-prd.md): mục 12 (tiêu chí nghiệm thu)
- [User flow](../03-user-flows.md)

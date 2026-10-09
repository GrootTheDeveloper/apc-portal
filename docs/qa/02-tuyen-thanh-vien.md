# Kịch bản kiểm tra: Tuyển thành viên (02-tuyen-thanh-vien)

## Danh sách kịch bản

### KB-02-01. Xem danh sách đợt tuyển thành viên đang mở
- Chức năng: R1 · Luồng: FLOW-03 · Nghiệm thu: AC-02
- Tài khoản: không đăng nhập
- Chuẩn bị: dữ liệu mẫu đã có đợt tuyển đang mở

| # | Thao tác | Kết quả phải thấy |
| --- | --- | --- |
| 1 | Mở http://localhost:5173/recruitment | Hiển thị danh sách các đợt tuyển thành viên (đang mở và đã đóng) |
| 2 | Kiểm tra đợt tuyển chưa mở hoặc đã đóng | Đợt tuyển chưa mở hoặc đã đóng **không** có nút **Ứng tuyển** |

| Ngày chạy | Người chạy | Kết quả | Issue |
| --- | --- | --- | --- |
| | | | |

---

### KB-02-02. Nộp đơn tuyển thành viên hợp lệ
- Chức năng: R3 · Luồng: FLOW-04 · Nghiệm thu: AC-02
- Tài khoản: không đăng nhập

| # | Thao tác | Kết quả phải thấy |
| --- | --- | --- |
| 1 | Mở trang đợt tuyển đang mở, bấm **Ứng tuyển** | Mở form nộp đơn tuyển |
| 2 | Điền email ungvien1@example.com, MSSV và các trường hợp lệ, **chưa** tick ô đồng ý, bấm **Nộp đơn** | Bị chặn, không gửi được đơn |
| 3 | Tick chọn ô đồng ý điều khoản, bấm **Nộp đơn** | Gửi đơn thành công, chuyển hướng đến trang thông báo kèm mã hồ sơ |

| Ngày chạy | Người chạy | Kết quả | Issue |
| --- | --- | --- | --- |
| | | | |

---

### KB-02-03. Nộp đơn trùng email trong cùng đợt
- Chức năng: R3 · Luồng: FLOW-04 · Nghiệm thu: AC-02
- Tài khoản: không đăng nhập
- Chuẩn bị: đã chạy KB-02-02 (đã nộp một đơn bằng ungvien1@example.com)

| # | Thao tác | Kết quả phải thấy |
| --- | --- | --- |
| 1 | Mở trang tuyển, bấm đợt tuyển đang mở, bấm **Ứng tuyển** | Trang chi tiết có nút **Ứng tuyển** |
| 2 | Điền email ungvien1@example.com, các trường khác hợp lệ, tick ô đồng ý, bấm **Nộp đơn** | Không tạo đơn mới; hiện câu chung "Không thể nộp đơn với thông tin này...", không nói email hay MSSV bị trùng; dữ liệu đã nhập vẫn còn trên form |

| Ngày chạy | Người chạy | Kết quả | Issue |
| --- | --- | --- | --- |
| | | | |

---

### KB-02-04. Tra cứu đơn tuyển thành viên
- Chức năng: R4 · Luồng: FLOW-04
- Tài khoản: không đăng nhập

| # | Thao tác | Kết quả phải thấy |
| --- | --- | --- |
| 1 | Mở trang tra cứu đơn, nhập mã hồ sơ hợp lệ vừa nhận ở KB-02-02, bấm Tra cứu | Hiển thị trạng thái hồ sơ (ví dụ: Mới) |
| 2 | Nhập mã hồ sơ sai định dạng hoặc không tồn tại, bấm Tra cứu | Hiển thị thông báo chung, không tiết lộ thông tin chi tiết hệ thống |

| Ngày chạy | Người chạy | Kết quả | Issue |
| --- | --- | --- | --- |
| | | | |

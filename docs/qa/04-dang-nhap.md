# Kịch bản kiểm tra: Đăng nhập & Xác thực (04-dang-nhap)

## Danh sách kịch bản

### KB-04-01. Đăng nhập thành công với tài khoản hợp lệ
- Chức năng: A2 · Luồng: FLOW-15 · Nghiệm thu: AC-03
- Tài khoản: tài khoản mẫu hợp lệ (ví dụ: member.a)

| # | Thao tác | Kết quả phải thấy |
| --- | --- | --- |
| 1 | Mở trang http://localhost:5173/login | Hiển thị form đăng nhập với các ô nhập tên đăng nhập và mật khẩu |
| 2 | Nhập thông tin tài khoản hợp lệ, bấm **Đăng nhập** | Đăng nhập thành công, chuyển hướng vào trang quản lý hoặc dashboard cá nhân |

| Ngày chạy | Người chạy | Kết quả | Issue |
| --- | --- | --- | --- |
| | | | |

---

### KB-04-02. Sai tên đăng nhập hoặc mật khẩu (Chính sách bảo mật thông tin)
- Chức năng: A2, A4 · Luồng: FLOW-15 · Nghiệm thu: SEC-08
- Tài khoản: không đăng nhập

| # | Thao tác | Kết quả phải thấy |
| --- | --- | --- |
| 1 | Nhập sai tên đăng nhập hoặc sai mật khẩu, bấm **Đăng nhập** | Hiển thị **cùng một** thông báo lỗi chung chung (SEC-08), không tiết lộ tên tài khoản hay mật khẩu bị sai |

| Ngày chạy | Người chạy | Kết quả | Issue |
| --- | --- | --- | --- |
| | | | |

---

### KB-04-03. Khóa tài khoản sau 5 lần sai mật khẩu liên tiếp
- Chức năng: A4 · Luồng: FLOW-15
- Tài khoản: tài khoản thử nghiệm

| # | Thao tác | Kết quả phải thấy |
| --- | --- | --- |
| 1 | Nhập sai mật khẩu liên tiếp 5 lần cho cùng một tài khoản | Tài khoản bị tạm khóa hoặc yêu cầu phải chờ 15 phút mới được thử lại |

| Ngày chạy | Người chạy | Kết quả | Issue |
| --- | --- | --- | --- |
| | | | |

---

### KB-04-04. Kiểm tra tài khoản pending, locked, inactive
- Chức năng: A2, A4 · Luồng: FLOW-15 · Nghiệm thu: AC-03
- Tài khoản: các tài khoản có trạng thái pending, locked, inactive từ dữ liệu mẫu

| # | Thao tác | Kết quả phải thấy |
| --- | --- | --- |
| 1 | Đăng nhập bằng tài khoản locked hoặc inactive | Bị từ chối đăng nhập, thông báo tài khoản không hoạt động hoặc bị khóa |
| 2 | Đăng nhập bằng tài khoản pending | Đăng nhập thành công nhưng chỉ được chuyển hướng vào trang kích hoạt tài khoản (AC-03) |

| Ngày chạy | Người chạy | Kết quả | Issue |
| --- | --- | --- | --- |
| | | | |

---

### KB-04-05. Kiểm tra giới hạn độ dài mật khẩu mới
- Chức năng: A4 · Nghiệm thu: SEC-11

| # | Thao tác | Kết quả phải thấy |
| --- | --- | --- |
| 1 | Thực hiện đổi mật khẩu mới có độ dài 14 ký tự | Bị hệ thống từ chối (dưới mức tối thiểu quy định) |
| 2 | Đổi mật khẩu mới có độ dài 15 ký tự hoặc 128 ký tự | Được hệ thống chấp nhận thành công |
| 3 | Đổi mật khẩu mới có độ dài 129 ký tự | Bị hệ thống từ chối (vượt quá giới hạn tối đa) |

| Ngày chạy | Người chạy | Kết quả | Issue |
| --- | --- | --- | --- |
| | | | |

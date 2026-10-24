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
- Chức năng: A2 · Luồng: FLOW-15
- Tài khoản: `member.b`

| # | Thao tác | Kết quả phải thấy |
| --- | --- | --- |
| 1 | Mở http://localhost:5173/login, nhập `member.b` với mật khẩu sai, bấm **Đăng nhập**, lặp lại đủ 5 lần | Lần nào cũng hiện "Sai tên đăng nhập hoặc mật khẩu." |
| 2 | Nhập `member.b` với mật khẩu **đúng**, bấm **Đăng nhập** | Vẫn hiện "Sai tên đăng nhập hoặc mật khẩu.", không vào được |
| 3 | Chờ hết 15 phút, đăng nhập lại bằng mật khẩu đúng | Đăng nhập thành công |

| Ngày chạy | Người chạy | Kết quả | Issue |
| --- | --- | --- | --- |
| | | | |

---

### KB-04-04. Kiểm tra tài khoản pending, locked, inactive
- Chức năng: A2, A4 · Luồng: FLOW-15 · Nghiệm thu: AC-03
- Tài khoản: `locked`, `inactive`, `pending`

| # | Thao tác | Kết quả phải thấy |
| --- | --- | --- |
| 1 | Đăng nhập bằng `locked` với mật khẩu đúng | Hiện "Sai tên đăng nhập hoặc mật khẩu.", không báo tài khoản bị khóa (FLOW-10) |
| 2 | Đăng nhập bằng `inactive` với mật khẩu đúng | Hiện "Sai tên đăng nhập hoặc mật khẩu.", không báo tài khoản ngừng hoạt động |
| 3 | Đăng nhập bằng `pending` với mật khẩu đúng | Chuyển tới trang kích hoạt tài khoản `/account/activate` (AC-03) |

| Ngày chạy | Người chạy | Kết quả | Issue |
| --- | --- | --- | --- |
| | | | |

---

### KB-04-05. Kiểm tra điều hướng khi chưa đăng nhập (Protected Routes)
- Chức năng: A2 · Luồng: FLOW-15
- Tài khoản: không đăng nhập

| # | Thao tác | Kết quả phải thấy |
| --- | --- | --- |
| 1 | Chưa đăng nhập, mở http://localhost:5173/portal | Chuyển tới trang đăng nhập, thanh địa chỉ là `/login?returnTo=%2Fportal` |
| 2 | Đăng nhập bằng `member.a` | Quay về `/portal`, thấy tiêu đề "Trang thành viên" |
| 3 | Bấm **Đăng xuất** trên thanh menu | Về trang chủ, thanh menu hiện lại nút **Đăng nhập** |
| 4 | Mở http://localhost:5173/admin | Chuyển tới trang đăng nhập, thanh địa chỉ là `/login?returnTo=%2Fadmin` |
| 5 | Đăng nhập bằng `manager.a` | Quay về `/admin`, thấy tiêu đề "Quản trị" |

| Ngày chạy | Người chạy | Kết quả | Issue |
| --- | --- | --- | --- |
| | | | |

---

### KB-04-06. Kiểm tra phân quyền truy cập trang `/admin`
- Chức năng: A1, A2 · Nghiệm thu: AC-10
- Tài khoản: `member.a`, `board.pending`

| # | Thao tác | Kết quả phải thấy |
| --- | --- | --- |
| 1 | Chưa đăng nhập, mở http://localhost:5173/admin | Chuyển tới trang đăng nhập |
| 2 | Đăng nhập bằng `member.a` | Hiện trang "Không có quyền truy cập" |
| 3 | Bấm **Đăng xuất** trên thanh menu | Về trang chủ, thanh menu hiện lại nút **Đăng nhập** |
| 4 | Mở lại http://localhost:5173/admin | Chuyển tới trang đăng nhập |
| 5 | Đăng nhập bằng `board.pending` | Hiện trang "Không có quyền truy cập" (vai trò chưa thiết lập 2 lớp) |

| Ngày chạy | Người chạy | Kết quả | Issue |
| --- | --- | --- | --- |
| | | | |

---

### KB-04-07. Kiểm tra giới hạn độ dài mật khẩu mới
- Chức năng: A4 · Nghiệm thu: SEC-11

| # | Thao tác | Kết quả phải thấy |
| --- | --- | --- |
| 1 | Thực hiện đổi mật khẩu mới có độ dài 14 ký tự | Bị hệ thống từ chối (dưới mức tối thiểu quy định) |
| 2 | Đổi mật khẩu mới có độ dài 15 ký tự hoặc 128 ký tự | Được hệ thống chấp nhận thành công |
| 3 | Đổi mật khẩu mới có độ dài 129 ký tự | Bị hệ thống từ chối (vượt quá giới hạn tối đa) |

| Ngày chạy | Người chạy | Kết quả | Issue |
| --- | --- | --- | --- |
| | | | |

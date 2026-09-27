# Thành viên & Về APC — Lương Huỳnh

Làm cả API lẫn giao diện.

### Giai đoạn 1 (05/10 – 11/10)
**T1. Trang Về APC.** Làm trang `/about` (sứ mệnh, các ban, liên hệ) với dữ liệu giả.

### Giai đoạn 2 (12/10 – 01/11)
**T2. Nối dữ liệu thật.** Lưu thông tin APC (sứ mệnh, liên hệ, link chính thức) trong một bảng `SiteSetting` có cột JSON; các ban dùng bảng `Department` có sẵn. Viết API cho trang `/about` đọc dữ liệu đó.

### Giai đoạn 3 (02/11 – 22/11)
**T3. Trang của thành viên.** Làm `/portal` (trang chủ thành viên), `/portal/profile` (hồ sơ) và `/portal/activity-history` (lịch sử hoạt động).
Xong khi: thành viên tự sửa được ảnh, email liên hệ, kỹ năng; không sửa được MSSV, ban, vai trò.

**T4. Quản trị thông tin APC.** Làm `/admin/organization`: sửa thông tin APC, thêm/sắp xếp các ban, chọn nội dung nổi bật cho trang chủ.
Xong khi: không lưu trữ được ban còn thành viên đang hoạt động.

**T5. Quản lý thành viên.** Làm `/admin/members`: danh sách thành viên có lọc và tìm kiếm, đổi ban, đổi trạng thái.
Xong khi: chỉ `BOARD` đổi được ban và trạng thái; Quản lý ban chỉ xem thành viên ban mình.

**T6. Nhập/xuất CSV.** `BOARD` nhập danh sách thành viên từ file CSV và xuất danh sách ra CSV. Được cài `csv-parse`, `csv-stringify`.
Xong khi: file có 1 dòng lỗi thì báo đúng dòng đó và không nhập dòng nào.

**T7. Danh bạ.** Làm `/portal/members`.
Xong khi: danh bạ không hiện MSSV, email, số điện thoại.

### Lưu ý
- Trạng thái thành viên (Đang hoạt động / Tạm ngưng / Ngừng tham gia) và trạng thái tài khoản (Chờ kích hoạt / Đang hoạt động / Bị khóa / Ngừng hoạt động) là hai thứ riêng.
- File CSV mẫu chỉ dùng dữ liệu giả.

### Tài liệu
- [PRD](../01-prd.md): mục 7.4, 7.10
- [User flow](../03-user-flows.md): FLOW-12, 13, 24, 25
- [Sitemap](../04-sitemap.md): mục 7.2, 8.3, 8.8

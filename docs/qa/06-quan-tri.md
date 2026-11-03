# Kịch bản kiểm tra - Quản trị & Phân quyền

## Bảng tài khoản mẫu sử dụng
- `board`: Ban Chủ nhiệm (toàn quyền)
- `manager.a`: Trưởng ban Chuyên môn A
- `member.a`: Thành viên Ban A (không có quyền quản trị)
- `techadmin`: Kỹ thuật viên (chỉ quản trị hạ tầng, không xem nội dung/hồ sơ)

---

### KB-06-01. Board đăng nhập, tạo, công bố và gỡ bài viết
- **Chức năng**: C3 · **Tài khoản**: `board`
- **Chuẩn bị**: Đã reset DB (`pnpm --filter @apc/api exec prisma db seed`)

| # | Thao tác | Kết quả phải thấy |
| --- | --- | --- |
| 1 | Mở http://localhost:5173/login, đăng nhập bằng `board` kèm mã TOTP 2FA | Đăng nhập thành công, chuyển hướng vào `/admin` |
| 2 | Vào trang Quản lý bài viết, bấm **Tạo bài viết mới** | Form soạn thảo bài viết hiển thị |
| 3 | Nhập tiêu đề, nội dung, chọn trạng thái **Công bố** và bấm **Lưu** | Bài viết được lưu thành công |
| 4 | Mở trang công khai http://localhost:5173/news | Bài viết mới vừa tạo xuất hiện trên danh sách |
| 5 | Quay lại `/admin`, đổi trạng thái bài viết thành **Gỡ bài / Nháp** và Lưu | Bài viết cập nhật trạng thái |
| 6 | Mở lại http://localhost:5173/news | Bài viết đã biến mất khỏi danh sách công khai |

| Ngày chạy | Người chạy | Kết quả | Issue |
| --- | --- | --- | --- |
| | Nguyễn Tiến Bảo | | |

---

### KB-06-02. Trưởng ban (manager.a) chỉ quản lý bài viết thuộc Ban A
- **Chức năng**: C3, AC-RBAC · **Tài khoản**: `manager.a`

| # | Thao tác | Kết quả phải thấy |
| --- | --- | --- |
| 1 | Đăng nhập bằng `manager.a` vào `/admin` | Vào được giao diện admin của Ban A |
| 2 | Mở danh sách bài viết | Chỉ thấy các bài viết do Ban A tạo |
| 3 | Thử truy cập thẳng URL sửa bài của Ban B (`/admin/content/posts/<id-ban-b>`) | Trang hiển thị 404 hoặc báo Không có quyền (Forbidden) |
| 4 | Mở form sửa bài viết của Ban A | Không xuất hiện nút hoặc tùy chọn **Công bố công khai** |

| Ngày chạy | Người chạy | Kết quả | Issue |
| --- | --- | --- | --- |
| | Nguyễn Tiến Bảo | | |

---

### KB-06-03. Thành viên (member.a) bị chặn hoàn toàn khỏi trang Admin
- **Chức năng**: A2, AC-RBAC · **Tài khoản**: `member.a`

| # | Thao tác | Kết quả phải thấy |
| --- | --- | --- |
| 1 | Đăng nhập bằng tài khoản `member.a` | Đăng nhập thành công vào trang `/portal` |
| 2 | Kiểm tra thanh điều hướng (Navbar / Sidebar) | Không hiển thị menu hoặc liên kết **Quản trị (/admin)** |
| 3 | Cố tình gõ trực tiếp URL http://localhost:5173/admin | Hệ thống từ chối truy cập, chuyển hướng về `/403` (Forbidden) hoặc `/login` |

| Ngày chạy | Người chạy | Kết quả | Issue |
| --- | --- | --- | --- |
| | Nguyễn Tiến Bảo | | |

---

### KB-06-04. Quy trình xét duyệt hồ sơ ứng tuyển của Board
- **Chức năng**: R5 · **Tài khoản**: `board`

| # | Thao tác | Kết quả phải thấy |
| --- | --- | --- |
| 1 | Mở `/admin/recruitment`, chọn danh sách hồ sơ | Danh sách hồ sơ ứng tuyển hiển thị |
| 2 | Chọn 1 hồ sơ trạng thái **Mới**, đổi thành **Đang xét** -> **Mời phỏng vấn** -> **Đã chấp nhận** | Trạng thái hồ sơ được cập nhật trên bảng quản trị |
| 3 | Thêm một ghi chú nội bộ vào hồ sơ đó | Ghi chú lưu thành công |
| 4 | Mở trang tra cứu công khai `/recruitment/lookup` dùng mã hồ sơ đó để tra cứu | Hiển thị trạng thái mới nhưng **KHÔNG** hiển thị ghi chú nội bộ |

| Ngày chạy | Người chạy | Kết quả | Issue |
| --- | --- | --- | --- |
| | Nguyễn Tiến Bảo | | |
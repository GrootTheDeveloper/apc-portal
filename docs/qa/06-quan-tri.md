# Kịch bản kiểm tra - Quản trị & Phân quyền

## Bảng tài khoản mẫu sử dụng
- `board`: Ban Chủ nhiệm (toàn quyền)
- `board.pending`: Ban Chủ nhiệm chưa thiết lập 2FA (bị chặn)
- `manager.a`: Trưởng ban Chuyên môn A
- `manager.b`: Trưởng ban Chuyên môn B
- `member.a`: Thành viên Ban A (không có quyền quản trị)
- `member.b`: Thành viên Ban B
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
| 3 | Cố tình gõ trực tiếp URL http://localhost:5173/admin | Màn hình hiển thị "Không có quyền truy cập" (Forbidden) tại chỗ, giữ nguyên URL hoặc chuyển hướng phù hợp |

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

---

### KB-06-05. Phân quyền Trưởng ban xét hồ sơ ứng tuyển (manager.a)
- **Chức năng**: R5, AC-RBAC · **Tài khoản**: `manager.a`

| # | Thao tác | Kết quả phải thấy |
| --- | --- | --- |
| 1 | Đăng nhập bằng `manager.a`, mở trang duyệt hồ sơ | Chỉ hiển thị các hồ sơ ứng tuyển nộp vào Ban A |
| 2 | Xem chi tiết hồ sơ ứng tuyển | Không xuất hiện các nút chốt trạng thái **Đã chấp nhận** / **Không chấp nhận** (chỉ có ở quyền `board`) |

| Ngày chạy | Người chạy | Kết quả | Issue |
| --- | --- | --- | --- |
| | Nguyễn Tiến Bảo | | |

---

### KB-06-06. Tech Admin bị giới hạn quyền truy cập nội dung nghiệp vụ
- **Chức năng**: AC-RBAC-04 · **Tài khoản**: `techadmin`

| # | Thao tác | Kết quả phải thấy |
| --- | --- | --- |
| 1 | Đăng nhập bằng `techadmin` vào trang quản trị | Chỉ vào được các trang cấu hình kỹ thuật / hệ thống |
| 2 | Cố tình truy cập URL bài viết nháp, hồ sơ ứng tuyển, tài liệu nội bộ, quản lý thành viên | Hệ thống từ chối truy cập (Forbidden / 404), API không trả về dữ liệu nội dung |

| Ngày chạy | Người chạy | Kết quả | Issue |
| --- | --- | --- | --- |
| | Nguyễn Tiến Bảo | | |

---

### KB-06-07. Quyền truy cập tài liệu nội bộ (member.b)
- **Chức năng**: AC-05 · **Tài khoản**: `member.b`

| # | Thao tác | Kết quả phải thấy |
| --- | --- | --- |
| 1 | Đăng nhập bằng `member.b`, cố tình tải/mở link trực tiếp tài liệu thuộc Ban A | Hệ thống báo Không có quyền truy cập |
| 2 | Quản trị viên tải file mới thay thế cho một tài liệu | File mới cập nhật nhưng vẫn bảo lưu được lịch sử / bản cũ |

| Ngày chạy | Người chạy | Kết quả | Issue |
| --- | --- | --- | --- |
| | Nguyễn Tiến Bảo | | |

---

### KB-06-08. Ghi nhận Nhật ký hệ thống (Audit Log)
- **Chức năng**: AC-06 · **Tài khoản**: `board`

| # | Thao tác | Kết quả phải thấy |
| --- | --- | --- |
| 1 | Thực hiện các thao tác: công bố bài viết, đổi trạng thái hồ sơ, khóa tài khoản | Hệ thống tự động sinh các dòng nhật ký audit log tương ứng |
| 2 | Truy cập trang Xem nhật ký hệ thống (`/admin/audit-logs`) | Danh sách dòng nhật ký hiển thị đầy đủ, **KHÔNG** có nút Sửa hoặc Xóa |

| Ngày chạy | Người chạy | Kết quả | Issue |
| --- | --- | --- | --- |
| | Nguyễn Tiến Bảo | | |

---

### KB-06-09. Tài khoản chưa bật 2FA (board.pending) bị chặn khỏi Admin
- **Chức năng**: AC-10 · **Tài khoản**: `board.pending`

| # | Thao tác | Kết quả phải thấy |
| --- | --- | --- |
| 1 | Đăng nhập bằng `board.pending` | Đăng nhập thành công nhưng hệ thống yêu cầu cài đặt 2FA |
| 2 | Cố tình gõ trực tiếp URL `/admin` | Bị chặn không vào được trang quản trị cho tới khi hoàn tất thiết lập 2FA |

| Ngày chạy | Người chạy | Kết quả | Issue |
| --- | --- | --- | --- |
| | Nguyễn Tiến Bảo | | |

---

### KB-06-10. Các kịch bản đang chờ chức năng merge
- [ ] **Nhập / Xuất dữ liệu CSV (AC-08)**: Kiểm tra file có 1 dòng lỗi thì hủy toàn bộ import; file xuất ra chỉ người tạo tải được. *(Viết kịch bản chi tiết ngay khi C6 / B6 merge)*.
- [ ] **Email quản trị & Khắc phục sự cố (AC-09)**: `manager.a` chỉ thấy email Ban A; `techadmin` chỉ xem metadata và gửi lại khi có mã sự cố. *(Viết kịch bản chi tiết ngay khi O6 merge)*.
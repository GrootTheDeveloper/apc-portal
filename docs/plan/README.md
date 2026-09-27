# Kế hoạch APC Portal

## Phân công

| Người | Mảng | Phiếu |
| --- | --- | --- |
| Huỳnh Hoàn Phúc | Đăng nhập & phân quyền | [A-dang-nhap.md](./A-dang-nhap.md) |
| Trương Phúc Minh | Bảo mật & nhật ký | [B-bao-mat.md](./B-bao-mat.md) |
| Nguyễn Gia Bảo | Tin tức & Dự án | [C-noi-dung.md](./C-noi-dung.md) |
| Lê Đăng Nghĩa | Sự kiện | [E-su-kien.md](./E-su-kien.md) |
| Phan Anh Khương | Tuyển thành viên | [R-tuyen-thanh-vien.md](./R-tuyen-thanh-vien.md) |
| Lương Huỳnh | Thành viên & Về APC | [T-thanh-vien.md](./T-thanh-vien.md) |
| Phạm Đăng Hoàng Thiên | Dữ liệu mẫu, tệp, tài liệu, tìm kiếm | [D-tep-tai-lieu.md](./D-tep-tai-lieu.md) |
| Đặng Phúc An Khang | Email & máy chủ | [O-email-ha-tang.md](./O-email-ha-tang.md) |
| Nguyễn Tiến Bảo | Kiểm thử & nội dung | [Q-qa-noi-dung.md](./Q-qa-noi-dung.md) |

Mỗi người làm cả dữ liệu, API và trang web cho mảng của mình.

## Giai đoạn

1. **Khởi động:** đăng nhập, phân quyền, dữ liệu mẫu. Các trang khác làm với dữ liệu giả.
2. **Website công khai:** tin tức, sự kiện, dự án, Về APC, nộp đơn tuyển, đăng ký sự kiện. Dùng dữ liệu thật.
3. **Portal & quản trị:** trang cho thành viên và Ban Chủ nhiệm.

**Sau này:** đưa lên máy chủ thật.

Cuối mỗi giai đoạn có buổi demo.

## Cách làm một việc

1. Chọn việc tiếp theo trong phiếu, ví dụ `R1`.
2. Tạo nhánh: `git switch -c r1-trang-tuyen`.
3. Code (có thể dùng AI).
4. Chạy thử đúng như dòng "Xong khi".
5. Chạy `pnpm check`, phải xanh.
6. Mở Pull Request (điền theo mẫu có sẵn), kèm ảnh chụp màn hình, chờ 1 người review.
7. Cập nhật trạng thái trong `APC-Portal-Ke-hoach-cong-viec.xlsx`.

Kẹt quá 30 phút thì hỏi trong nhóm.

## Có sẵn cho cả nhóm

| Cần | Dùng |
| --- | --- |
| Nút, nhãn tiêu đề | `Button`, `Eyebrow` trong `apps/web/src/components/` |
| Gọi API từ web | `api(...)` trong `apps/web/src/lib/api.ts` |
| Tải dữ liệu cho trang + 4 trạng thái | `useApi(...)` trong `apps/web/src/hooks/useApi.ts` và `<AsyncState>` trong `apps/web/src/components/` |
| Hiện ngày giờ (giờ Việt Nam) | `formatDate`, `formatDateTime` trong `apps/web/src/lib/format.ts` |
| Đọc/ghi database | `db` trong `apps/api/src/db/client.ts` |
| Trả lỗi 404, 403, 409… | `throw notFound()`, `forbidden()`, `conflict()` trong `apps/api/src/lib/errors.ts` |
| Băm mật khẩu | `hashPassword`, `verifyPassword` trong `apps/api/src/lib/password.ts` |
| Phân trang danh sách | `pageQuery`, `pageArgs`, `toPage` trong `apps/api/src/lib/pagination.ts` |
| Mã tra cứu ngẫu nhiên, slug | `publicCode()`, `slugify()` trong `apps/api/src/lib/ids.ts` |
| Xem dữ liệu | `pnpm --filter @apc/api db:studio` |
| Thư viện được cài | Danh sách ở [Kiến trúc](../06-architecture.md) mục 5.1 |

## Luật chung

- Dùng màu, chữ trong [DESIGN.md](../../DESIGN.md) và component có sẵn ở trên.
- Không commit mật khẩu, file `.env` hay dữ liệu thật.
- Không push thẳng lên `main`.
- Tạo migration mà `main` đã có migration mới hơn: xóa migration của mình, merge `main`, chạy lại `db:migrate`.
- Tài liệu không rõ hoặc mâu thuẫn thì hỏi trưởng dự án.

## Đã xong

Duyệt trang chủ · CI + bảo vệ nhánh · Router + layout (PR #1) · Database schema (PR #2).

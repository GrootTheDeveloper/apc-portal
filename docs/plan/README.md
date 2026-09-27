# Kế hoạch APC Portal

> **Mới vào nhóm?** Đọc [Bắt đầu](./bat-dau.md) trước: cài máy, cách giao việc cho AI, mở PR, review, xử lý khi kẹt.

## Phân công

| Người | Mảng | Phiếu |
| --- | --- | --- |
| Huỳnh Hoàn Phúc | Đăng nhập & phân quyền | [A-dang-nhap.md](./A-dang-nhap.md) |
| Trương Phúc Minh | Bảo mật & nhật ký | [B-bao-mat.md](./B-bao-mat.md) |
| Nguyễn Gia Bảo | Tin tức & Dự án | [C-noi-dung.md](./C-noi-dung.md) |
| Lê Đăng Nghĩa | Sự kiện | [E-su-kien.md](./E-su-kien.md) |
| Phan Anh Khương | Tuyển thành viên | [R-tuyen-thanh-vien.md](./R-tuyen-thanh-vien.md) |
| Lương Huỳnh | Thành viên & Về APC | [T-thanh-vien.md](./T-thanh-vien.md) |
| Phạm Đăng Hoàng Thiên | Dữ liệu mẫu, tệp, tài liệu, tìm kiếm, nhập CSV | [D-tep-tai-lieu.md](./D-tep-tai-lieu.md) |
| Đặng Phúc An Khang | Email & máy chủ | [O-email-ha-tang.md](./O-email-ha-tang.md) |
| Nguyễn Tiến Bảo | Kiểm thử & nội dung | [Q-qa-noi-dung.md](./Q-qa-noi-dung.md) |

Mỗi người làm cả dữ liệu, API và trang web cho mảng của mình.

## Lịch

| Mốc | Ngày | Nội dung |
| --- | --- | --- |
| Kickoff | T7 03/10 | Cài máy theo [Phát triển local](../07-local-development.md), đọc phiếu của mình |
| Giai đoạn 1 | 05/10 – 11/10 | Đăng nhập, phân quyền, dữ liệu mẫu, email, upload. Các trang khác làm với dữ liệu giả |
| Giai đoạn 2 | 12/10 – 01/11 | Website công khai dùng dữ liệu thật: tin tức, sự kiện, dự án, Về APC, nộp đơn tuyển, đăng ký sự kiện |
| Giai đoạn 3 | 02/11 – 22/11 | Portal thành viên và trang quản trị |
| Lên máy chủ | 23/11 – 29/11 | VPS, HTTPS, sao lưu; nhập nội dung thật |

Demo vào Chủ nhật cuối mỗi giai đoạn: 11/10, 01/11, 22/11.

Deadline từng việc và trạng thái nằm trong **Google Sheet kế hoạch** (link ghim trong nhóm chat). Biết sẽ trễ thì chuyển việc sang `Blocked` và báo nhóm ngay.

## Cách làm một việc

Tóm tắt: lấy việc chưa làm đầu tiên trong phiếu → tạo nhánh → giao cho AI → tự kiểm tra theo "Xong khi" → `pnpm check` → mở PR, chờ bạn cặp duyệt → cập nhật Sheet. Chi tiết từng lệnh ở [Bắt đầu](./bat-dau.md) mục 3.

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
| Xem sơ đồ database | [apps/api/docs/erd-core-schema.md](../../apps/api/docs/erd-core-schema.md). Thêm bảng xong chạy `pnpm --filter @apc/api db:erd` |
| Thư viện được cài | Danh sách ở [Kiến trúc](../06-architecture.md) mục 5.1 |

## Luật chung

- Dùng màu, chữ trong [DESIGN.md](../../DESIGN.md) và component có sẵn ở trên.
- Không commit mật khẩu, file `.env` hay dữ liệu thật.
- Không push thẳng lên `main`.
- Tạo migration mà `main` đã có migration mới hơn: xóa migration của mình, merge `main`, chạy lại `db:migrate`.
- Tài liệu không rõ hoặc mâu thuẫn thì hỏi trưởng dự án.

## Đã xong

Duyệt trang chủ · CI + bảo vệ nhánh · Router + layout (PR #1) · Database schema (PR #2).

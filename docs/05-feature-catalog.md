# APC Portal - Danh mục chức năng

| Thuộc tính | Giá trị |
| --- | --- |
| Phiên bản | 1.4 |
| Trạng thái | Cập nhật theo tiến độ merge (Q5) |
| Ngày cập nhật | 24/11/2026 |
| Phạm vi | Chia giai đoạn triển khai từ trang chủ đến Portal MVP |

Tài liệu này là backlog mức tính năng. Quy tắc nghiệp vụ chi tiết vẫn nằm trong [PRD](./01-prd.md), [Roles and Permissions](./02-roles-permissions.md) và [User Flows](./03-user-flows.md). Phân công và thứ tự làm nằm trong [docs/plan](./plan/README.md): P0 ứng với Giai đoạn 1, P1 với Giai đoạn 2, P2 với Giai đoạn 3, P3 với Lên máy chủ và Phát hành.

## 1. P0 - Nền tảng và trang chủ

| Mã | Chức năng | Trạng thái |
| --- | --- | --- |
| FND-01 | Monorepo React/Vite và Node.js/Fastify | Hoàn thành |
| FND-02 | Môi trường local PostgreSQL, Mailpit, SeaweedFS | Hoàn thành |
| FND-03 | Kiểm tra lint, type-check, test và build; CI bắt buộc trước khi merge | Hoàn thành |
| PUB-01 | Trang chủ theo thiết kế đã chốt | Hoàn thành giao diện; APC duyệt 05/09/2026 |
| PUB-02 | Header theo [Sitemap](./04-sitemap.md) mục 5.1 | Hoàn thành |
| PUB-03 | Hero, giá trị cốt lõi, hoạt động, dự án, sự kiện, đối tác, CTA và footer | Hoàn thành giao diện (đang dùng dữ liệu mẫu; chờ nội dung thật Q4) |

Hero trang chủ hiển thị dải 4 chỉ số CLB dạng placeholder (số mẫu trong `HeroSection.tsx`, chờ APC xác nhận số thật). Trang chủ không có khối cơ cấu nhân sự riêng; nội dung đó, nếu được duyệt, thuộc trang `Về APC` hoặc trang riêng ở giai đoạn sau.

## 2. P1 - Website công khai

| Chức năng | Trạng thái |
| --- | --- |
| Trang danh sách và chi tiết sự kiện (E1, E2) | Hoàn thành |
| Trang danh sách và chi tiết tin tức (C1, C2) | Hoàn thành |
| Trang danh sách và chi tiết dự án/sản phẩm (C1, C2) | Hoàn thành |
| Trang Gia nhập APC, đợt tuyển đang mở và biểu mẫu ứng tuyển, tra cứu/rút đơn (R1, R3, R4) | Hoàn thành |
| Trang Về APC và thông tin liên hệ (T1, T2) | Hoàn thành |
| Tìm kiếm nội dung công khai và metadata SEO cơ bản (D3) | Hoàn thành |

## 3. P2 - Thành viên và vận hành câu lạc bộ

| Chức năng | Trạng thái |
| --- | --- |
| Đăng nhập, đăng xuất, đổi mật khẩu; Ban Chủ nhiệm cấp lại mật khẩu tạm thời (A2, A4, B3) | Hoàn thành |
| Hồ sơ thành viên và dashboard cá nhân (T3) | Hoàn thành |
| Quản lý thành viên, ban chuyên môn và nhiệm kỳ (T5, O6) | Hoàn thành |
| Quản lý đợt tuyển, hồ sơ ứng viên và chuyển ứng viên thành thành viên (R2, R5, R6) | Hoàn thành |
| Quản lý sự kiện, đăng ký và điểm danh (E4, E5) | Hoàn thành |
| Quản trị tin tức, hoạt động, dự án, thông tin APC và tệp nội bộ (C3, C4, T4, D4, D6) | Hoàn thành |
| Phân quyền `MEMBER`, `DEPARTMENT_MANAGER`, `BOARD`, `TECH_ADMIN` | Hoàn thành |
| Audit log và theo dõi email cho hành động nhạy cảm (O3) | Hoàn thành |

## 4. P3 - Lên máy chủ và phát hành

| Chức năng | Trạng thái |
| --- | --- |
| Lệnh bootstrap tài khoản đặc quyền đầu tiên (A7) | Hoàn thành |
| Staging và production trên VPS, domain, TLS, header bảo mật (O4) | Đang triển khai |
| Sao lưu, diễn tập khôi phục, theo dõi và cảnh báo, kiểm thử tải (O5, Q6) | Đang triển khai |
| Phát hành production (O7) và nhập nội dung thật (Q4) | Kế hoạch T4 02/12/2026 |

## 5. Sau lần phát hành đầu (đến 28/02/2027)

Các hạng mục dời phạm vi theo [PRD](./01-prd.md) mục 13.1: thực thi retention và trang Retention, ẩn danh/xóa dữ liệu ngoài hồ sơ thành viên, khu vận hành `/admin/system/*`, bước xác minh tăng cường cho biểu mẫu công khai.

## 6. Chưa cam kết

- Tích hợp tài khoản UMT hoặc đăng nhập một lần.
- Ứng dụng di động riêng.
- Quản lý task, deadline, source code hoặc thay thế UMTOJ.
- Tích hợp tên đối tác khi APC chưa cung cấp dữ liệu được phép công bố.

## 7. Quy tắc đưa chức năng vào triển khai

Một chức năng chỉ chuyển sang `Ready for development` khi có chủ sở hữu nghiệp vụ, dữ liệu đầu vào, quyền truy cập, trạng thái lỗi và tiêu chí nghiệm thu. Không coi nội dung mẫu trong bản thiết kế là dữ liệu thật.

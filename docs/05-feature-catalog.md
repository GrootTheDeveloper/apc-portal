# APC Portal - Danh mục chức năng

| Thuộc tính | Giá trị |
| --- | --- |
| Phiên bản | 1.2 |
| Trạng thái | Đã duyệt (27/09/2026) |
| Ngày cập nhật | 27/09/2026 |
| Phạm vi | Chia giai đoạn triển khai từ trang chủ đến Portal MVP |

Tài liệu này là backlog mức tính năng. Quy tắc nghiệp vụ chi tiết vẫn nằm trong [PRD](./01-prd.md), [Roles and Permissions](./02-roles-permissions.md) và [User Flows](./03-user-flows.md). Phân công và thứ tự làm nằm trong [docs/plan](./plan/README.md): P0 ứng với Giai đoạn 1, P1 với Giai đoạn 2, P2 với Giai đoạn 3.

## 1. P0 - Nền tảng và trang chủ

| Mã | Chức năng | Trạng thái |
| --- | --- | --- |
| FND-01 | Monorepo React/Vite và Node.js/Fastify | Hoàn thành |
| FND-02 | Môi trường local PostgreSQL, Mailpit, SeaweedFS | Hoàn thành |
| FND-03 | Kiểm tra lint, type-check, test và build; CI bắt buộc trước khi merge | Hoàn thành |
| PUB-01 | Trang chủ theo thiết kế đã chốt | Hoàn thành giao diện; APC duyệt 05/09/2026 |
| PUB-02 | Header theo [Sitemap](./04-sitemap.md) mục 5.1 | Đã có giao diện và route đích (khung trang tạm) |
| PUB-03 | Hero, giá trị cốt lõi, hoạt động, dự án, sự kiện, đối tác, CTA và footer | Đã có nội dung mẫu; chờ nội dung thật |

Hero trang chủ hiển thị dải 4 chỉ số CLB dạng placeholder (số mẫu trong `HeroSection.tsx`, chờ APC xác nhận số thật). Trang chủ không có khối cơ cấu nhân sự riêng; nội dung đó, nếu được duyệt, thuộc trang `Về APC` hoặc trang riêng ở giai đoạn sau.

## 2. P1 - Website công khai

- Trang danh sách và chi tiết sự kiện.
- Trang danh sách và chi tiết tin tức.
- Trang danh sách và chi tiết dự án/sản phẩm.
- Trang Gia nhập APC, đợt tuyển đang mở và biểu mẫu ứng tuyển.
- Trang Về APC và thông tin liên hệ.
- Tìm kiếm nội dung công khai và metadata SEO cơ bản.

## 3. P2 - Thành viên và vận hành câu lạc bộ

- Đăng nhập, đăng xuất, đổi mật khẩu; Ban Chủ nhiệm cấp lại mật khẩu tạm thời.
- Hồ sơ thành viên và dashboard cá nhân.
- Quản lý thành viên, ban chuyên môn và nhiệm kỳ.
- Quản lý đợt tuyển, hồ sơ ứng viên và chuyển ứng viên thành thành viên.
- Quản lý sự kiện, đăng ký và điểm danh.
- Quản trị tin tức, hoạt động, dự án và tệp nội bộ.
- Phân quyền `MEMBER`, `DEPARTMENT_MANAGER`, `BOARD`, `TECH_ADMIN`.
- Audit log cho hành động nhạy cảm.

## 4. Chưa cam kết trong giai đoạn local

- Dựng VPS, domain, TLS và production (phương án đã chốt tại [Kiến trúc](./06-architecture.md) mục 5).
- Tích hợp tài khoản UMT hoặc đăng nhập một lần.
- Ứng dụng di động riêng.
- Quản lý task, deadline, source code hoặc thay thế UMTOJ.
- Tích hợp tên đối tác khi APC chưa cung cấp dữ liệu được phép công bố.

## 5. Quy tắc đưa chức năng vào triển khai

Một chức năng chỉ chuyển sang `Ready for development` khi có chủ sở hữu nghiệp vụ, dữ liệu đầu vào, quyền truy cập, trạng thái lỗi và tiêu chí nghiệm thu. Không coi nội dung mẫu trong bản thiết kế là dữ liệu thật.

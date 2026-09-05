# APC Portal - Documentation Index

| Thuộc tính | Giá trị |
| --- | --- |
| Phiên bản | 1.2 |
| Trạng thái | Bản thảo để APC rà soát |
| Ngày cập nhật | 05/09/2026 |
| Đơn vị sở hữu | Câu lạc bộ Lập trình ứng dụng (APC), Khoa Công Nghệ, UMT |
| Giai đoạn hiện tại | Khởi tạo và phát triển local; chưa chọn hạ tầng production |

## 1. Bản đồ tài liệu

| Nhóm | Tài liệu | Vai trò |
| --- | --- | --- |
| Sản phẩm | [00 - Project Charter](./00-project-charter.md) | Bài toán, mục tiêu và ranh giới MVP |
| Sản phẩm | [01 - PRD](./01-prd.md) | Yêu cầu và tiêu chí nghiệm thu chi tiết |
| Quản trị | [02 - Roles and Permissions](./02-roles-permissions.md) | Vai trò, phạm vi và quyền |
| Trải nghiệm | [03 - User Flows](./03-user-flows.md) | Luồng chính, lỗi và kết quả |
| Trải nghiệm | [04 - Sitemap](./04-sitemap.md) | Trang, route và điều hướng |
| Kế hoạch | [05 - Feature Catalog](./05-feature-catalog.md) | Chia chức năng theo thứ tự triển khai |
| Kỹ thuật | [06 - Architecture](./06-architecture.md) | Kiến trúc local và quyết định còn mở |
| Kỹ thuật | [07 - Local Development](./07-local-development.md) | Cài đặt, chạy và kiểm tra local |
| Bàn giao | [08 - Handover](./08-handover.md) | Điều kiện để APC tiếp nhận repository |
| Giao diện | [Design System](../DESIGN.md) | Màu sắc, chữ, layout và component |

## 2. Thứ tự đọc theo vai trò

- Thành viên APC duyệt sản phẩm: `00` → `05` → `01` → `03` → `04`.
- Người duyệt phân quyền: `01` → `02` → `03`.
- Thành viên phát triển: root `README` → `06` → `07` → tài liệu nghiệp vụ liên quan.
- Người nhận bàn giao: `08`, sau đó chạy lại toàn bộ quickstart và `pnpm check`.

## 3. Trạng thái và nguồn sự thật

- Charter, PRD, Roles, User Flows và Sitemap hiện là baseline chi tiết nhưng vẫn cần APC ký duyệt.
- Feature Catalog quyết định thứ tự triển khai, không thay thế quy tắc nghiệp vụ trong PRD.
- Architecture mô tả những gì repository đang áp dụng. Yêu cầu production cũ chỉ là mục tiêu dự kiến cho đến khi APC chọn hạ tầng.
- Mã đang chạy và kết quả kiểm tra là bằng chứng thực thi; nội dung mẫu trong thiết kế không phải dữ liệu tổ chức đã xác nhận.

Nếu tài liệu mâu thuẫn, dừng triển khai phần bị ảnh hưởng, tạo issue ghi rõ các đoạn xung đột và yêu cầu chủ sở hữu sản phẩm quyết định. Không tự chọn một yêu cầu ảnh hưởng quyền, dữ liệu cá nhân hoặc phạm vi công khai.

## 4. Quy tắc cập nhật

1. Cập nhật ngày, phiên bản và lịch sử thay đổi khi sửa quyết định quan trọng.
2. Yêu cầu mới phải có mã, mức ưu tiên, chủ sở hữu và tiêu chí nghiệm thu.
3. Thay đổi vai trò phải cập nhật PRD, ma trận quyền, User Flow, API authorization và test.
4. Route mới phải có Sitemap, điểm vào, quyền truy cập và trạng thái lỗi.
5. Thay đổi kiến trúc phải cập nhật `06-architecture.md`; quyết định khó đảo ngược cần ADR riêng.
6. Không ghi secret, dữ liệu cá nhân thật hoặc tên đối tác chưa được phép công bố vào docs hay seed data.

## 5. Phạm vi đã chốt cho lần khởi tạo

- React/Vite cho web và Node.js/Fastify cho API.
- PostgreSQL, Mailpit và MinIO chạy local bằng Docker Compose.
- Trang chủ theo bản thiết kế đã duyệt là màn hình đầu tiên tại `/`.
- Hero trang chủ có dải 4 chỉ số CLB dạng placeholder (số mẫu, chờ APC xác nhận số thật); trang chủ vẫn không có khối cơ cấu nhân sự riêng.
- Header dùng nhãn `Gia nhập APC`; nghiệp vụ nội bộ vẫn có thể gọi là tuyển thành viên.
- Chưa có VPS, staging hoặc production trong phạm vi triển khai hiện tại.

## 6. Gate trước khi bắt đầu mỗi chức năng

- Có người chịu trách nhiệm xác nhận nghiệp vụ.
- Có dữ liệu mẫu hợp lệ và phân biệt rõ với dữ liệu thật.
- Có quyền xem/sửa/xóa và hành vi khi vượt quyền.
- Có trạng thái loading, empty, error và success phù hợp.
- Có tiêu chí kiểm thử và tài liệu bị ảnh hưởng.

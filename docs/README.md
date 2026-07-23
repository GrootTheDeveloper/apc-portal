# APC Portal - Documentation Index

| Thuộc tính | Giá trị |
| --- | --- |
| Phiên bản | 1.0 |
| Trạng thái | Chưa thống nhất |
| Ngày cập nhật | 23/07/2026 |
| Đơn vị sở hữu | Ban Chuyên môn Câu lạc bộ Lập trình ứng dụng (APC) |
| Phạm vi | Bộ đặc tả sản phẩm và kiến trúc thông tin trước wireframe và thiết kế kỹ thuật |

## 1. Bộ tài liệu hiện tại

| Thứ tự | Tài liệu | Phiên bản | Nội dung chính |
| --- | --- | --- | --- |
| 00 | [Project Charter](./00-project-charter.md) | 1.0 | Bối cảnh, tầm nhìn, mục tiêu, phạm vi và ràng buộc triển khai |
| 01 | [Product Requirements Document](./01-prd.md) | 1.0 | 208 mã KPI/luồng/yêu cầu, mô hình dữ liệu, tiêu chí nghiệm thu và release gate |
| 02 | [Roles and Permissions](./02-roles-permissions.md) | 1.0 | Vai trò, phạm vi, ma trận quyền, TOTP, audit và kiểm thử vượt quyền |
| 03 | [User Flows](./03-user-flows.md) | 1.0 | Chi tiết `FLOW-01` đến `FLOW-29`, nhánh lỗi, truy vết và 13 sơ đồ |
| 04 | [Sitemap](./04-sitemap.md) | 1.0 | 105 mã trang, 101 route tiếng Anh, 14 trạng thái, menu theo vai trò, route guard, truy vết 29 luồng và 6 sơ đồ |

Mọi tài liệu trong bộ hiện mang trạng thái **Chưa thống nhất**. Phiên bản trong bảng phải khớp metadata của từng file trước mỗi buổi review.

## 2. Thứ tự rà soát

1. Đọc Project Charter để thống nhất bài toán, mục tiêu, người dùng và ranh giới MVP.
2. Đọc PRD để thống nhất yêu cầu chức năng, phi chức năng, dữ liệu và điều kiện production.
3. Đọc Roles and Permissions để thống nhất ai được xem hoặc thay đổi từng loại thông tin.
4. Đọc User Flows để kiểm tra từng bước, lỗi, trạng thái kết thúc và màn hình cần thiết.
5. Đọc Sitemap để thống nhất cây trang, URL, điều hướng, quyền truy cập và bề mặt ngoài Portal.
6. Đối chiếu ma trận truy vết trong PRD, User Flows và Sitemap trước khi thay trạng thái tài liệu.

Không chuyển sang wireframe nếu thay đổi ở một tài liệu làm tài liệu sau không còn nhất quán.

## 3. Ranh giới sản phẩm đã thể hiện trong toàn bộ tài liệu

- Portal quản lý thông tin câu lạc bộ, thành viên, tuyển dụng, sự kiện, nội dung và tài liệu.
- Tài khoản thành viên do Ban Chủ nhiệm cấp; không sử dụng tài khoản UMT để đăng nhập.
- Ứng viên và người đăng ký sự kiện công khai không có tài khoản thành viên.
- Không có vai trò người dùng ngoài phạm vi câu lạc bộ.
- Không có module task, giao việc, deadline, tiến độ hoặc quản lý source code.
- Production của APC Portal chạy trên một VPS riêng, độc lập với hạ tầng UMTOJ.
- Backup bao gồm PostgreSQL và tệp tải lên, lưu ngoài VPS.

## 4. Checklist thống nhất nội dung

### 4.1. Project Charter

- [ ] Bối cảnh, tầm nhìn và mục tiêu phản ánh đúng định hướng APC.
- [ ] Nhóm người dùng và phạm vi MVP đúng nhu cầu vận hành.
- [ ] Ngoài phạm vi không loại nhầm chức năng cần thiết.
- [ ] Kiến trúc VPS riêng cho APC Portal và phạm vi quản trị hạ tầng được chấp nhận.
- [ ] Cấu hình tối thiểu, bảo mật host, firewall, backup ngoài VPS và khả năng khôi phục độc lập đã được chấp nhận.

### 4.2. PRD

- [ ] Toàn bộ yêu cầu mức Bắt buộc thuộc MVP.
- [ ] Trạng thái thực thể và quy tắc chuyển trạng thái đúng nghiệp vụ.
- [ ] Chính sách mật khẩu, TOTP, retention, backup và monitoring phù hợp khả năng vận hành.
- [ ] Release gate production có kiểm thử tải Portal, baseline host/firewall, monitoring, backup, restore và rollback.
- [ ] `AC-01` đến `AC-12` đủ để quyết định phát hành production.

### 4.3. Vai trò và quyền

- [ ] Bốn vai trò có tài khoản đúng cơ cấu APC.
- [ ] `DEPARTMENT_MANAGER` chỉ quản lý dữ liệu trong ban.
- [ ] `BOARD` và `TECH_ADMIN` được tách quyền nghiệp vụ/kỹ thuật.
- [ ] Quy trình TOTP, bootstrap, khôi phục và bàn giao quyền có thể thực hiện được.
- [ ] Có tối thiểu hai tài khoản Ban Chủ nhiệm và hai tài khoản quản trị kỹ thuật do những người khác nhau nắm giữ.
- [ ] Không có tài khoản đồng thời mang cả quyền Ban Chủ nhiệm và quản trị kỹ thuật.

### 4.4. User Flow

- [ ] `FLOW-01` đến `FLOW-29` phản ánh đầy đủ cách vận hành thực tế.
- [ ] Nhánh lỗi và thao tác không thể hoàn tác được mô tả rõ.
- [ ] Mọi luồng có giao diện đủ thông tin để chuyển thành màn hình/wireframe.
- [ ] Mọi luồng nền có trạng thái quản trị, cảnh báo hoặc runbook tương ứng.

### 4.5. Sitemap

- [ ] Năm vùng công khai, xác thực, thành viên, quản trị nghiệp vụ và vận hành kỹ thuật đúng cách APC sử dụng Portal.
- [ ] Mã trang, route tiếng Anh, menu và breadcrumb đủ rõ để chuyển sang wireframe.
- [ ] Quyền truy cập từng nhóm trang khớp Roles and Permissions.
- [ ] `FLOW-01` đến `FLOW-29` đều có trang, trạng thái hoặc bề mặt vận hành tương ứng.
- [ ] Không đưa GitHub, VPS, backup hoặc monitoring ngoài Portal thành chức năng web không có trong PRD.
- [ ] Không có trang task, giao việc, deadline, tiến độ hoặc quản lý source code.

## 5. Quy tắc thay đổi

1. Không sửa một yêu cầu mà bỏ qua User Flow, ma trận quyền hoặc tiêu chí nghiệm thu liên quan.
2. Yêu cầu mới phải có mã liên tục trong đúng nhóm và có điểm truy vết.
3. Luồng mới phải có mã `FLOW`, tác nhân, điều kiện, luồng chính, lỗi, kết quả và sơ đồ khi có nhiều nhánh.
4. Thay đổi vai trò hoặc phạm vi phải cập nhật cả frontend visibility, API authorization và test case.
5. Thay đổi production phải cập nhật release gate, runbook, backup/rollback và cảnh báo liên quan.
6. Không xóa sơ đồ hoặc nội dung lịch sử nếu chưa chuyển thông tin sang phần thay thế có truy vết rõ ràng.
7. Trang hoặc route mới phải có mã Sitemap, quyền truy cập, điểm vào và User Flow liên quan.

## 6. Thuật ngữ dùng chung

| Thuật ngữ | Nghĩa trong dự án |
| --- | --- |
| MVP | Phiên bản nhỏ nhất nhưng đủ vận hành các nghiệp vụ đã xác định và đạt release gate |
| Local | Môi trường chạy trên máy cá nhân của từng thành viên phát triển |
| Staging | Môi trường gần giống production, được khởi tạo để kiểm thử từng bản phát hành và dừng sau khi hoàn tất |
| Production | Môi trường chính thức phục vụ người dùng thật và chứa dữ liệu thật |
| RBAC | Phân quyền dựa trên vai trò, kết hợp phạm vi cá nhân/ban/câu lạc bộ/hệ thống |
| TOTP | Mã xác thực thay đổi theo thời gian từ ứng dụng authenticator |
| CI/CD | Quy trình tự động kiểm tra, build image và hỗ trợ triển khai phiên bản |
| Audit log | Nhật ký bất biến ghi ai làm gì, với dữ liệu nào, khi nào và kết quả ra sao |
| Retention | Chính sách giữ, ẩn danh hoặc xóa dữ liệu sau một thời hạn |
| RPO | Mức dữ liệu tối đa có thể mất khi phải khôi phục, mục tiêu của Portal là 24 giờ |
| RTO | Thời gian mục tiêu để khôi phục dịch vụ, mục tiêu của Portal là 4 giờ |
| Runbook | Hướng dẫn thao tác cụ thể để deploy, rollback, restore hoặc xử lý sự cố |
| Idempotency | Cùng một yêu cầu gửi lặp không tạo thêm bản ghi hoặc tác dụng ngoài ý muốn |
| Sitemap | Kiến trúc phân cấp các trang, route và quan hệ điều hướng của Portal |
| `sitemap.xml` | Tệp máy đọc liệt kê URL công khai cho công cụ tìm kiếm; không phải tài liệu Sitemap |

## 7. Điều kiện chuyển sang bước tiếp theo

Bộ tài liệu được chuyển sang trạng thái **Đã thống nhất** khi:

- Checklist mục 4 hoàn tất.
- Không còn mâu thuẫn giữa Charter, PRD, Roles and Permissions, User Flows và Sitemap.
- Mỗi mã yêu cầu PRD được ánh xạ tới User Flow hoặc điểm kiểm tra xuyên suốt.
- Toàn bộ sơ đồ Mermaid render thành công.
- Product Owner ghi nhận phiên bản được dùng làm đầu vào thiết kế.

Sau khi Sitemap được thống nhất, bước tiếp theo là wireframe đen trắng cho toàn bộ họ màn hình, rồi prototype Figma.

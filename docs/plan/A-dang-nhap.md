# Đăng nhập & phân quyền — Huỳnh Hoàn Phúc

Làm cả API lẫn giao diện. Làm lần lượt từ trên xuống, hạn ghi ngay cạnh tên việc. Mỗi việc là 1 nhánh và 1 PR; mở PR xong là sang việc sau được, trừ khi việc sau cần code của việc trước thì chờ PR đó merge.

### Giai đoạn 1 (05/10 – 11/10)
#### A1. Phân quyền — hạn T5 08/10
Viết các hàm dùng chung cho mọi API: `requireAuth` (đã đăng nhập), `requireRole` (đúng vai trò), `requireScope` (đúng ban). Vai trò đọc từ bảng `user_roles`. Lỗi dùng `unauthenticated()`, `forbidden()`, `notFound()` có sẵn trong `src/lib/errors.ts`. Test gán sẵn `request.user` giả, chưa cần đăng nhập thật.

**Xong khi:** có test cho 4 vai trò; Quản lý ban A truy cập dữ liệu ban B thì nhận lỗi 404. Làm xong nhắn cả nhóm cách dùng.

#### A2. Đăng nhập — hạn CN 11/10
Làm API đăng nhập, đăng xuất, `/auth/me`. Làm trang `/login`. Chưa đăng nhập mà vào `/portal`, `/admin` thì chuyển về `/login`. Trang gọi API bằng `api(...)` có sẵn trong `apps/web/src/lib/api.ts`; mật khẩu kiểm bằng `verifyPassword` trong `src/lib/password.ts`. Được cài `@fastify/cookie` và `@fastify/rate-limit`. Test tự tạo tài khoản bằng `db` + `hashPassword`, không chờ dữ liệu mẫu D1.

**Xong khi:** đăng nhập được bằng tài khoản mẫu; sai mật khẩu 5 lần liên tiếp thì phải chờ 15 phút; đăng nhập xong quay lại đúng trang đang định vào (không có thì về `/portal`). Phiên theo quyết định ở [Kiến trúc](../06-architecture.md) mục 5 (bảng `sessions`, cookie `apc_session`).

### Giai đoạn 2 (12/10 – 01/11)
#### A3. Khung trang portal & admin — hạn T5 22/10
Làm layout chung cho `/portal` và `/admin`, menu hiện theo vai trò.

**Xong khi:** thành viên thường không thấy menu quản trị; thêm trang mới vào menu chỉ cần sửa 1 chỗ.

#### A4. Đổi mật khẩu — hạn CN 01/11
Tài khoản mới phải đổi mật khẩu tạm ở `/account/activate` trước khi dùng. Làm thêm trang đổi mật khẩu trong mục tài khoản.

**Xong khi:** mật khẩu tạm quá 72 giờ thì không dùng được; đổi mật khẩu xong thì các phiên đăng nhập cũ bị đăng xuất.

### Giai đoạn 3 (02/11 – 22/11)
#### A5. Quản lý tài khoản — hạn CN 22/11
Làm trang `/admin/accounts`: Ban Chủ nhiệm tạo tài khoản, khóa/mở khóa, cấp lại mật khẩu tạm, gán vai trò.

**Xong khi:** người bị khóa bị đăng xuất ngay; không ai tự nâng quyền cho chính mình được.
Vai trò lưu trong bảng `user_roles` (đã có sẵn): mỗi dòng là một vai trò quản lý kèm phạm vi ban, trạng thái và ngày hết hạn.

### Lưu ý
- Mật khẩu dài 15–128 ký tự, băm bằng Argon2id. Không ghi ra log, không trả về trong API, không gửi qua email.
- Không có chức năng tự đăng ký hay quên mật khẩu. Trang `/login` ghi: "Liên hệ Ban Chủ nhiệm để được cấp lại mật khẩu".
- Đăng nhập sai chỉ báo "Sai tên đăng nhập hoặc mật khẩu".
- `TECH_ADMIN` không xem được dữ liệu nghiệp vụ, trừ khi xử lý sự cố đã ghi nhận.
- Không lưu mật khẩu hay token trong `localStorage`.

### Tài liệu
- [Vai trò & quyền](../02-roles-permissions.md) (đọc hết)
- [User flow](../03-user-flows.md): FLOW-09, 10, 11, 20
- [Sitemap](../04-sitemap.md): mục 6, 10, 11
